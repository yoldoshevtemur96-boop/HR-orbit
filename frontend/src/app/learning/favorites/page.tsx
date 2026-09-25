'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { EmptyState, MaterialCard, PageBackLink } from '@/components/learning/materialUi';
import type { LearningMaterial } from '@/types/learning';

export default function LearningFavoritesPage() {
  const [materials, setMaterials] = useState<LearningMaterial[] | null>(null);

  useEffect(() => {
    api.get<LearningMaterial[]>('/learning/my/favorites').then((res) => setMaterials(res.data));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageBackLink />
      <div>
        <h1 className="font-display text-2xl font-semibold text-stone-900">Sevimlilar</h1>
        <p className="mt-1 text-sm text-stone-500">Keyinroq o&apos;qish uchun saqlangan materiallar</p>
      </div>

      {materials === null ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : materials.length === 0 ? (
        <EmptyState>Hali hech narsa saqlanmagan. Material sahifasida &quot;Sevimlilarga qo&apos;shish&quot; tugmasini bosing.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {materials.map((m) => (
            <MaterialCard key={m.id} material={m} />
          ))}
        </div>
      )}
    </div>
  );
}
