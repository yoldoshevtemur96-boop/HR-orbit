'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { BatchTable } from '@/components/learning-admin/BatchTable';
import {
  ASSIGNMENT_SOURCE_LABEL,
  BATCH_STATE_LABEL,
  type AssignableMaterial,
  type AssignmentSource,
  type BatchList,
  type BatchState,
} from '@/types/learningAdmin';

const FIELD_CLASS =
  'rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15';

const STATES: BatchState[] = ['IN_PROGRESS', 'HAS_OVERDUE', 'COMPLETED', 'CANCELLED'];
const SOURCES: AssignmentSource[] = ['MANUAL', 'RULE', 'FILE'];

export default function AssignmentsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-400">Yuklanmoqda...</p>}>
      <Batches />
    </Suspense>
  );
}

// Tayinlovlar ro'yxati — har bir qator bitta tayinlash amali. Xodimlar
// tayinlov sahifasining ichida (/learning-admin/assignments/:id).
function Batches() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<BatchList | null>(null);
  const [materials, setMaterials] = useState<AssignableMaterial[]>([]);
  const [filters, setFilters] = useState({
    materialId: searchParams.get('materialId') ?? '',
    source: '' as '' | AssignmentSource,
    state: '' as '' | BatchState,
    search: '',
  });
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const flash = searchParams.get('msg');

  useEffect(() => {
    api.get<AssignableMaterial[]>('/learning-admin/materials').then((res) => setMaterials(res.data));
  }, []);

  const load = useCallback(() => {
    api
      .get<BatchList>('/learning-admin/batches', {
        params: {
          materialId: filters.materialId || undefined,
          source: filters.source || undefined,
          state: filters.state || undefined,
          search: filters.search || undefined,
        },
      })
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik yuz berdi'));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const hasFilters = Boolean(filters.materialId || filters.source || filters.state || filters.search);
  const totalBatches = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">Tayinlovlar</h1>
          <p className="mt-1 text-sm text-stone-500">Har bir tayinlov — bitta tayinlash amali. Xodimlar ro&apos;yxati uning ichida.</p>
        </div>
        <Link
          href="/learning-admin/assignments/new"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + Yangi tayinlash
        </Link>
      </div>

      {flash && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{flash}</p>}

      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, state: '' }))}
            className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition ${
              filters.state === '' ? 'border-accent bg-accent/5' : 'border-stone-200 bg-white hover:border-stone-300'
            }`}
          >
            <span className="text-2xl font-semibold text-stone-900">{totalBatches}</span>
            <span className="text-xs text-stone-500">Barcha tayinlovlar</span>
          </button>
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilters((f) => ({ ...f, state: f.state === s ? '' : s }))}
              className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition ${
                filters.state === s ? 'border-accent bg-accent/5' : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <span className={`text-2xl font-semibold ${s === 'HAS_OVERDUE' && data.counts[s] > 0 ? 'text-rose-600' : 'text-stone-900'}`}>
                {data.counts[s]}
              </span>
              <span className="text-xs text-stone-500">{BATCH_STATE_LABEL[s]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFilters((f) => ({ ...f, search: search.trim() }));
          }}
        >
          <label className="mb-1 block text-xs font-medium text-stone-500">Qidiruv</label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => setFilters((f) => ({ ...f, search: search.trim() }))}
            placeholder="Tayinlov yoki material nomi"
            className={`${FIELD_CLASS} w-full sm:w-64`}
          />
        </form>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Material</label>
          <select
            value={filters.materialId}
            onChange={(e) => setFilters((f) => ({ ...f, materialId: e.target.value }))}
            className={`${FIELD_CLASS} max-w-xs`}
          >
            <option value="">Barchasi</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Manba</label>
          <select
            value={filters.source}
            onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value as '' | AssignmentSource }))}
            className={FIELD_CLASS}
          >
            <option value="">Barchasi</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {ASSIGNMENT_SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setFilters({ materialId: '', source: '', state: '', search: '' });
              setSearch('');
            }}
            className="px-2 py-2 text-sm text-stone-500 hover:text-stone-800"
          >
            Tozalash
          </button>
        )}
      </div>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {data === null ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : data.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400">
          {hasFilters ? "Filtr bo'yicha tayinlov topilmadi." : 'Hali tayinlov yo‘q.'}
        </p>
      ) : (
        <BatchTable rows={data.rows} />
      )}
    </div>
  );
}
