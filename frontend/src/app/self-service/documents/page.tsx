'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface EmployeeDocument {
  id: string;
  name: string;
  fileUrl: string;
  createdAt: string;
  uploadedByUser: { id: string; email: string } | null;
}

export default function MyDocumentsPage() {
  const [documents, setDocuments] = useState<EmployeeDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/hr/employees/me')
      .then((res) => api.get<EmployeeDocument[]>(`/hr/employees/${res.data.id}/documents`))
      .then((res) => setDocuments(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik yuz berdi'));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Self-Service</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Mening hujjatlarim</h1>
      </div>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        {documents === null ? (
          <p className="p-5 text-sm text-stone-400">Yuklanmoqda...</p>
        ) : documents.length === 0 ? (
          <p className="p-5 text-sm text-stone-400">Hujjatlar hali yuklanmagan.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-stone-800">{doc.name}</p>
                  <p className="mt-0.5 text-xs text-stone-400">{new Date(doc.createdAt).toLocaleDateString('uz-UZ')}</p>
                </div>
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Yuklab olish
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
