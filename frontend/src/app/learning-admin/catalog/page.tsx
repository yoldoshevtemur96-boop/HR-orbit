'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { MATERIAL_TYPE_LABEL, MATERIAL_TYPE_STYLE, MaterialCover, formatDate, formatDuration } from '@/components/learning/materialUi';
import type { PublishStatus } from '@/components/learning-admin/MaterialForm';
import type { LearningMaterialType } from '@/types/learning';

interface CatalogRow {
  id: string;
  title: string;
  type: LearningMaterialType;
  coverUrl: string | null;
  durationMinutes: number;
  author: string | null;
  tags: string[];
  status: PublishStatus;
  requiresApproval: boolean;
  updatedAt: string;
  activeAssignments: number;
  completions: number;
}

interface CatalogList {
  counts: Record<PublishStatus, number>;
  rows: CatalogRow[];
}

const STATUS_TABS: { key: PublishStatus; label: string }[] = [
  { key: 'PUBLISHED', label: 'Nashr qilingan' },
  { key: 'DRAFT', label: 'Qoralamalar' },
  { key: 'ARCHIVED', label: 'Arxiv' },
];

const TYPES: ('' | LearningMaterialType)[] = ['', 'COURSE', 'VIDEO', 'AUDIO', 'ARTICLE', 'BOOK', 'INSTRUCTION', 'PRESENTATION'];

export default function CatalogAdminPage() {
  const [status, setStatus] = useState<PublishStatus>('PUBLISHED');
  const [type, setType] = useState<'' | LearningMaterialType>('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<CatalogList | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<CatalogList>('/learning-admin/catalog', { params: { status, type: type || undefined, search: query || undefined } })
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik yuz berdi'));
  }, [status, type, query]);

  useEffect(() => {
    load();
  }, [load]);

  async function setMaterialStatus(row: CatalogRow, next: PublishStatus) {
    setError(null);
    try {
      await api.patch(`/learning-admin/catalog/${row.id}`, { status: next });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Xatolik yuz berdi');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">Katalog</h1>
          <p className="mt-1 text-sm text-stone-500">O&apos;quv materiallari: yaratish, tahrirlash, nashr qilish</p>
        </div>
        <Link
          href="/learning-admin/catalog/new"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + Material yaratish
        </Link>
      </div>

      <nav className="flex gap-1 border-b border-stone-200">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatus(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              status === t.key ? 'border-accent text-accent' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {t.label}
            {data && <span className="ml-1.5 text-xs text-stone-400">{data.counts[t.key]}</span>}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
          }}
          className="flex-1"
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => setQuery(search.trim())}
            placeholder="Nomi, muallifi yoki teg bo'yicha qidirish"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </form>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t || 'all'}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                type === t ? 'border-accent bg-accent text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
              }`}
            >
              {t ? MATERIAL_TYPE_LABEL[t] : 'barchasi'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {data === null ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : data.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400">
          {status === 'DRAFT' ? "Qoralamalar yo'q." : status === 'ARCHIVED' ? "Arxiv bo'sh." : 'Material topilmadi.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Turi</th>
                <th className="px-4 py-3">Tayinlangan</th>
                <th className="px-4 py-3">Tugatgan</th>
                <th className="px-4 py-3">O&apos;zgartirilgan</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <Link href={`/learning-admin/catalog/${row.id}`} className="flex items-center gap-3">
                      <MaterialCover material={row} className="h-10 w-10 flex-shrink-0 rounded-md" iconClassName="h-5 w-5" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-stone-800 hover:text-accent">{row.title}</span>
                        <span className="block text-xs text-stone-400">
                          {formatDuration(row.durationMinutes)}
                          {row.author && ` · ${row.author}`}
                          {row.requiresApproval && ' · rahbar tasdig\'i bilan'}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${MATERIAL_TYPE_STYLE[row.type]}`}>
                      {MATERIAL_TYPE_LABEL[row.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{row.activeAssignments}</td>
                  <td className="px-4 py-3 text-stone-600">{row.completions}</td>
                  <td className="px-4 py-3 text-stone-500">{formatDate(row.updatedAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link href={`/learning-admin/catalog/${row.id}`} className="text-sm text-stone-500 hover:text-accent">
                      Tahrirlash
                    </Link>
                    {row.status === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => setMaterialStatus(row, 'PUBLISHED')}
                        className="ml-3 text-sm font-medium text-accent hover:underline"
                      >
                        Nashr qilish
                      </button>
                    )}
                    {row.status === 'ARCHIVED' && (
                      <button type="button" onClick={() => setMaterialStatus(row, 'DRAFT')} className="ml-3 text-sm text-stone-500 hover:text-accent">
                        Qaytarish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
