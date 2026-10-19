// Demo rejimda yuklangan fayllar: metama'lumot bazada, kontent brauzer
// xotirasida. Kichik fayllar (≤1.5 MB) localStorage'da ham saqlanadi —
// sahifa yangilanganda ham ochiladi; kattalari faqat joriy sessiyada.
import { newId, nowIso, type DemoDb } from './store';

const objectUrls = new Map<string, string>();
const FILE_KEY_PREFIX = 'hr-orbit-demo-file:';
const PERSIST_LIMIT = 1.5 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function putFile(db: DemoDb, file: File, isPublic: boolean) {
  const id = newId();
  objectUrls.set(id, URL.createObjectURL(file));
  if (file.size <= PERSIST_LIMIT) {
    try {
      window.localStorage.setItem(FILE_KEY_PREFIX + id, await readAsDataUrl(file));
    } catch {
      // joy yetmasa — faqat shu sessiyada qoladi
    }
  }
  const row = {
    id,
    organizationId: db.organization.id,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    isPublic,
    createdAt: nowIso(),
  };
  db.files.push(row);
  return row;
}

/** "/files/<id>..." manzilini brauzerdagi haqiqiy URL'ga aylantiradi */
export function resolveDemoFileUrl(url: string): string | null {
  const id = url.replace(/^\/files\//, '').split(/[/?]/)[0];
  const live = objectUrls.get(id);
  if (live) return live;
  try {
    return window.localStorage.getItem(FILE_KEY_PREFIX + id);
  } catch {
    return null;
  }
}
