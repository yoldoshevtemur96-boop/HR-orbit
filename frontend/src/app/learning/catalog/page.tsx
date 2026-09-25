'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { EmptyState, MATERIAL_TYPE_LABEL, MaterialCard, PageBackLink } from '@/components/learning/materialUi';
import type { LearningMaterial, LearningMaterialType } from '@/types/learning';

const TYPE_FILTERS: ('' | LearningMaterialType)[] = ['', 'COURSE', 'VIDEO', 'AUDIO', 'ARTICLE', 'BOOK'];

export default function LearningCatalogPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-400">Yuklanmoqda...</p>}>
      <Catalog />
    </Suspense>
  );
}

function Catalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const type = (searchParams.get('type') ?? '') as '' | LearningMaterialType;

  const [search, setSearch] = useState(q);
  const [materials, setMaterials] = useState<LearningMaterial[] | null>(null);

  useEffect(() => {
    setSearch(q);
    setMaterials(null);
    api
      .get<LearningMaterial[]>('/learning/materials', { params: { search: q || undefined, type: type || undefined } })
      .then((res) => setMaterials(res.data));
  }, [q, type]);

  function updateParams(next: { q?: string; type?: string }) {
    const params = new URLSearchParams();
    const nextQ = next.q ?? q;
    const nextType = next.type ?? type;
    if (nextQ) params.set('q', nextQ);
    if (nextType) params.set('type', nextType);
    const query = params.toString();
    router.replace(query ? `/learning/catalog?${query}` : '/learning/catalog');
  }

  return (
    <div className="flex flex-col gap-6">
      <PageBackLink />
      <h1 className="font-display text-2xl font-semibold text-stone-900">Katalog</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParams({ q: search.trim() });
        }}
        className="flex flex-col gap-3"
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nomi, muallifi yoki teg bo'yicha qidirish"
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t || 'all'}
              type="button"
              onClick={() => updateParams({ type: t })}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                type === t ? 'border-accent bg-accent text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
              }`}
            >
              {t ? MATERIAL_TYPE_LABEL[t] : 'barchasi'}
            </button>
          ))}
        </div>
      </form>

      {materials === null ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : materials.length === 0 ? (
        <EmptyState>Hech narsa topilmadi.</EmptyState>
      ) : (
        <>
          <p className="text-sm text-stone-500">{materials.length} ta material</p>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {materials.map((m) => (
              <MaterialCard key={m.id} material={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
