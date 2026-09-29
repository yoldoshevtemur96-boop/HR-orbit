'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export interface UploadedFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string; // nisbiy: /files/<id>...
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

let limitsCache: Promise<{ maxBytes: number; storage: 'DB' | 'SUPABASE' }> | null = null;
function getLimits() {
  limitsCache ??= api.get('/uploads/limits').then((res) => res.data);
  return limitsCache;
}

// Faylni tanlash yoki sudrab tashlash orqali yuklash (yuklanish foizi bilan)
export function FileUpload({
  purpose,
  accept,
  hint,
  onUploaded,
}: {
  purpose: 'cover' | 'content';
  accept: string;
  hint: string;
  onUploaded: (file: UploadedFile) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [maxBytes, setMaxBytes] = useState<number | null>(null);

  useEffect(() => {
    getLimits()
      .then((l) => setMaxBytes(purpose === 'cover' ? Math.min(l.maxBytes, 5 * 1024 * 1024) : l.maxBytes))
      .catch(() => setMaxBytes(null));
  }, [purpose]);

  async function upload(file: File) {
    setError(null);
    if (maxBytes && file.size > maxBytes) {
      setError(`Fayl juda katta (${formatBytes(file.size)}) — ${formatBytes(maxBytes)} gacha ruxsat`);
      return;
    }
    const form = new FormData();
    form.append('file', file);
    setProgress(0);
    try {
      const res = await api.post<UploadedFile>(`/uploads?purpose=${purpose}`, form, {
        onUploadProgress: (e) => setProgress(e.total ? Math.round((e.loaded / e.total) * 100) : null),
      });
      onUploaded(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Yuklab bo'lmadi");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={progress !== null}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition ${
          isDragging ? 'border-accent bg-accent/5' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
        }`}
      >
        {progress !== null ? (
          <>
            <span className="font-medium text-stone-700">Yuklanmoqda... {progress}%</span>
            <span className="h-1.5 w-40 overflow-hidden rounded-full bg-stone-200">
              <span className="block h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
            </span>
          </>
        ) : (
          <>
            <span className="font-medium text-stone-700">Faylni tanlang yoki shu yerga tashlang</span>
            <span className="text-xs text-stone-400">
              {hint}
              {maxBytes && ` · ${formatBytes(maxBytes)} gacha`}
            </span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
