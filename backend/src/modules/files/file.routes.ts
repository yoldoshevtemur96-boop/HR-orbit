import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate, requireRole } from '@/middleware/auth';
import { AppError } from '@/common/errors/AppError';
import {
  CONTENT_MIME_TYPES,
  COVER_MIME_TYPES,
  MAX_UPLOAD_BYTES_SUPABASE,
  isSupabaseStorageEnabled,
  maxUploadBytes,
  publicFilePath,
  saveFile,
  serveFile,
  signedFilePath,
} from './file.service';

// Fayllarni berish — helmet'dan OLDIN ulanadi (app.ts): rasm, video va PDF
// frontend domenida (<img>, <video>, <iframe>) ochilishi kerak.
export const filePublicRouter = Router();

filePublicRouter.get('/:id', async (req, res) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const query = z
    .object({ exp: z.string().optional(), sig: z.string().optional(), download: z.string().optional() })
    .parse(req.query);
  await serveFile(req.params.id, query, req.headers.range, res);
});

// Yuklash — faqat L&D admin (HR)
export const fileUploadRouter = Router();
fileUploadRouter.use(authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES_SUPABASE } });

fileUploadRouter.get('/limits', (_req, res) => {
  res.json({ maxBytes: maxUploadBytes(), storage: isSupabaseStorageEnabled() ? 'SUPABASE' : 'DB' });
});

const purposeSchema = z.object({ purpose: z.enum(['cover', 'content']) });

fileUploadRouter.post('/', upload.single('file'), async (req, res) => {
  const { purpose } = purposeSchema.parse(req.query);
  const file = req.file;
  if (!file) throw AppError.badRequest('Fayl tanlanmagan');

  const allowed = purpose === 'cover' ? COVER_MIME_TYPES : CONTENT_MIME_TYPES;
  if (!allowed.includes(file.mimetype)) {
    throw AppError.badRequest(
      purpose === 'cover'
        ? 'Muqova uchun JPG, PNG yoki WebP rasm yuklang'
        : "Bu fayl turi qo'llab-quvvatlanmaydi (PDF, Word, PowerPoint, Excel, MP4, MP3 va rasm mumkin)",
    );
  }
  if (purpose === 'cover' && file.size > 5 * 1024 * 1024) {
    throw AppError.badRequest('Muqova rasmi 5 MB dan oshmasin');
  }

  // Brauzer UTF-8 nomni latin1 sifatida yuboradi (multer) — qayta dekodlaymiz
  const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
  const saved = await saveFile({
    organizationId: req.auth!.organizationId,
    uploadedByUserId: req.auth!.userId,
    fileName,
    mimeType: file.mimetype,
    buffer: file.buffer,
    isPublic: purpose === 'cover',
  });

  res.status(201).json({
    ...saved,
    // Muqova — doimiy ochiq manzil; kontent — admin ko'rib chiqishi uchun vaqtinchalik havola
    url: saved.isPublic ? publicFilePath(saved.id) : signedFilePath(saved.id),
  });
});
