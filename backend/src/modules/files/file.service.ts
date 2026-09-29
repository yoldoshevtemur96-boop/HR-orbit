import crypto from 'crypto';
import type { Response } from 'express';
import { prisma } from '@/config/prisma';
import { env } from '@/config/env';
import { AppError } from '@/common/errors/AppError';

// Fayl saqlash. Supabase Storage sozlangan bo'lsa (SUPABASE_URL +
// SUPABASE_SERVICE_KEY) — fayl o'sha yerga yuklanadi, aks holda vaqtincha
// bazaning o'zida saqlanadi (kichik hajm cheklovi bilan). Frontend ikkala
// holatda ham bir xil manzildan oladi: /api/files/:id.
//
// Ochiq fayllar (muqova) — to'g'ridan-to'g'ri; yopiq fayllar (material
// kontenti) — faqat vaqtinchalik imzoli havola bilan (?exp=&sig=).

export const MAX_UPLOAD_BYTES_SUPABASE = 50 * 1024 * 1024;
export const MAX_UPLOAD_BYTES_DB = 10 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 4 * 60 * 60;

export function isSupabaseStorageEnabled() {
  return Boolean(env.supabase.url && env.supabase.serviceKey);
}

export function maxUploadBytes() {
  return isSupabaseStorageEnabled() ? MAX_UPLOAD_BYTES_SUPABASE : MAX_UPLOAD_BYTES_DB;
}

export const COVER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const CONTENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/msword',
  'application/vnd.ms-powerpoint',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/ogg',
  ...COVER_MIME_TYPES,
];

function supabaseObjectUrl(key: string) {
  return `${env.supabase.url}/storage/v1/object/${env.supabase.bucket}/${key}`;
}

function supabaseHeaders(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${env.supabase.serviceKey}`, apikey: env.supabase.serviceKey, ...extra };
}

export async function saveFile(input: {
  organizationId: string;
  uploadedByUserId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  isPublic: boolean;
}) {
  if (input.buffer.length > maxUploadBytes()) {
    throw AppError.badRequest(`Fayl juda katta — ${Math.round(maxUploadBytes() / 1024 / 1024)} MB gacha ruxsat`);
  }

  if (isSupabaseStorageEnabled()) {
    const safeName = input.fileName.replace(/[^\w.\-]+/g, '_').slice(-80);
    const key = `${input.organizationId}/${crypto.randomUUID()}-${safeName}`;
    const res = await fetch(supabaseObjectUrl(key), {
      method: 'POST',
      headers: supabaseHeaders({ 'Content-Type': input.mimeType, 'x-upsert': 'false' }),
      body: input.buffer,
    });
    if (!res.ok) {
      throw AppError.badRequest(`Faylni saqlab bo'lmadi (Storage: ${res.status})`);
    }
    return prisma.storedFile.create({
      data: {
        organizationId: input.organizationId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        storage: 'SUPABASE',
        storageKey: key,
        isPublic: input.isPublic,
        uploadedByUserId: input.uploadedByUserId,
      },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, isPublic: true },
    });
  }

  return prisma.storedFile.create({
    data: {
      organizationId: input.organizationId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      storage: 'DB',
      data: input.buffer,
      isPublic: input.isPublic,
      uploadedByUserId: input.uploadedByUserId,
    },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, isPublic: true },
  });
}

// ---------------------------------------------------------------------------
// Imzoli havola
// ---------------------------------------------------------------------------

function sign(fileId: string, exp: number) {
  return crypto.createHmac('sha256', env.jwt.accessSecret).update(`file:${fileId}:${exp}`).digest('base64url');
}

// Frontend api bazaviy manziliga qo'shib ishlatadigan nisbiy yo'l
export function publicFilePath(fileId: string) {
  return `/files/${fileId}`;
}

export function signedFilePath(fileId: string, download = false) {
  const exp = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  return `/files/${fileId}?exp=${exp}&sig=${sign(fileId, exp)}${download ? '&download=1' : ''}`;
}

function isValidSignature(fileId: string, exp: string | undefined, sig: string | undefined) {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(fileId, expNum));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// ---------------------------------------------------------------------------
// Faylni berish (Range qo'llab-quvvatlanadi — video/audio'ni o'rtasidan ochish uchun)
// ---------------------------------------------------------------------------

function contentDisposition(fileName: string, download: boolean) {
  const encoded = encodeURIComponent(fileName);
  return `${download ? 'attachment' : 'inline'}; filename="${encoded}"; filename*=UTF-8''${encoded}`;
}

export async function serveFile(
  fileId: string,
  query: { exp?: string; sig?: string; download?: string },
  rangeHeader: string | undefined,
  res: Response,
) {
  const file = await prisma.storedFile.findUnique({ where: { id: fileId } });
  if (!file) throw AppError.notFound('Fayl topilmadi');
  if (!file.isPublic && !isValidSignature(file.id, query.exp, query.sig)) {
    throw AppError.forbidden("Havola muddati o'tgan — sahifani yangilang");
  }

  const download = query.download === '1';
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', contentDisposition(file.fileName, download));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', file.isPublic ? 'public, max-age=86400' : 'private, max-age=3600');

  if (file.storage === 'SUPABASE' && file.storageKey) {
    const upstream = await fetch(supabaseObjectUrl(file.storageKey), {
      headers: supabaseHeaders(rangeHeader ? { Range: rangeHeader } : {}),
    });
    if (!upstream.ok && upstream.status !== 206) throw AppError.notFound('Fayl topilmadi');
    res.status(upstream.status);
    for (const header of ['content-length', 'content-range']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    const body = Buffer.from(await upstream.arrayBuffer());
    res.end(body);
    return;
  }

  const data = file.data ? Buffer.from(file.data) : Buffer.alloc(0);
  const total = data.length;
  const match = rangeHeader?.match(/bytes=(\d*)-(\d*)/);
  if (match && total > 0) {
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
    if (start >= total || start > end) {
      res.status(416).setHeader('Content-Range', `bytes */${total}`);
      res.end();
      return;
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', String(end - start + 1));
    res.end(data.subarray(start, end + 1));
    return;
  }
  res.setHeader('Content-Length', String(total));
  res.end(data);
}

export async function assertFileInOrganization(organizationId: string, fileId: string) {
  const file = await prisma.storedFile.findFirst({
    where: { id: fileId, organizationId },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, isPublic: true },
  });
  if (!file) throw AppError.badRequest('Fayl topilmadi — qayta yuklang');
  return file;
}
