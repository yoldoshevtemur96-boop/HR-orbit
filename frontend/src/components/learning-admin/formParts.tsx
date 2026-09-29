'use client';

import { useState } from 'react';
import { MATERIAL_TYPE_LABEL, MaterialCover, formatDuration } from '@/components/learning/materialUi';
import type { AssignableMaterial, AssignmentPreview, AudienceOption } from '@/types/learningAdmin';

// "Yangi tayinlash" va "Yangi qoida" formalari uchun umumiy bo'laklar.

export const FIELD_CLASS =
  'w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15';

export function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function OptionList({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: AudienceOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-stone-500">
        {title} {selected.length > 0 && `(${selected.length})`}
      </p>
      <div className="max-h-44 overflow-y-auto rounded-lg border border-stone-200">
        {items.length === 0 && <p className="px-3 py-2 text-sm text-stone-400">Yo&apos;q</p>}
        {items.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-2 border-b border-stone-100 px-3 py-1.5 text-sm last:border-0 hover:bg-stone-50"
          >
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
            <span className="flex-1 truncate text-stone-700">{item.name}</span>
            <span className="text-xs text-stone-400">{item.employeeCount}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function MaterialPicker({
  materials,
  value,
  onChange,
}: {
  materials: AssignableMaterial[] | null;
  value: string;
  onChange: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const selected = materials?.find((m) => m.id === value) ?? null;

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/5 p-3">
        <MaterialCover material={selected} className="h-12 w-12 flex-shrink-0 rounded-md" iconClassName="h-6 w-6" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-stone-800">{selected.title}</p>
          <p className="text-xs text-stone-500">
            {MATERIAL_TYPE_LABEL[selected.type]} · {formatDuration(selected.durationMinutes)}
          </p>
        </div>
        <button type="button" onClick={() => onChange('')} className="text-sm text-stone-500 hover:text-stone-800">
          O&apos;zgartirish
        </button>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const visible = (materials ?? []).filter((m) => !q || m.title.toLowerCase().includes(q));
  return (
    <>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Katalogdan qidirish"
        className={FIELD_CLASS}
      />
      <div className="max-h-72 overflow-y-auto rounded-lg border border-stone-200">
        {materials === null ? (
          <p className="px-3 py-2 text-sm text-stone-400">Yuklanmoqda...</p>
        ) : visible.length === 0 ? (
          <p className="px-3 py-2 text-sm text-stone-400">Topilmadi</p>
        ) : (
          visible.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              className="flex w-full items-center gap-3 border-b border-stone-100 px-3 py-2 text-left last:border-0 hover:bg-stone-50"
            >
              <MaterialCover material={m} className="h-9 w-9 flex-shrink-0 rounded" iconClassName="h-4 w-4" />
              <span className="min-w-0 flex-1 truncate text-sm text-stone-800">{m.title}</span>
              <span className="text-xs text-stone-400">{MATERIAL_TYPE_LABEL[m.type]}</span>
              {m.activeAssignments > 0 && <span className="text-xs text-stone-400">· {m.activeAssignments} ta tayinlangan</span>}
            </button>
          ))
        )}
      </div>
    </>
  );
}

// O'ng paneldagi "N ta xodimga tayinlanadi" natijasi
export function PreviewSummary({
  ready,
  preview,
  isLoading,
  emptyHint,
  countLabel = 'xodimga tayinlanadi',
}: {
  ready: boolean;
  preview: AssignmentPreview | null;
  isLoading: boolean;
  emptyHint: string;
  countLabel?: string;
}) {
  if (!ready) return <p className="text-sm text-stone-400">{emptyHint}</p>;
  if (isLoading && !preview) return <p className="text-sm text-stone-400">Hisoblanmoqda...</p>;
  if (!preview) return <p className="text-sm text-stone-400">Hisoblab bo&apos;lmadi</p>;
  return (
    <div className={`flex flex-col gap-2 text-sm ${isLoading ? 'opacity-60' : ''}`}>
      <p className="text-3xl font-semibold text-accent">{preview.toAssignCount}</p>
      <p className="-mt-1 text-stone-500">{countLabel}</p>
      {preview.skippedActiveCount > 0 && (
        <p className="text-xs text-stone-500">{preview.skippedActiveCount} tasida faol tayinlov bor — o&apos;tkazib yuboriladi</p>
      )}
      {preview.skippedCompletedCount > 0 && (
        <p className="text-xs text-stone-500">{preview.skippedCompletedCount} tasi yaqinda o&apos;tgan — o&apos;tkazib yuboriladi</p>
      )}
      {preview.toAssign.length > 0 && (
        <details className="text-xs text-stone-600">
          <summary className="cursor-pointer text-stone-500">Ro&apos;yxatni ko&apos;rish</summary>
          <ul className="mt-2 max-h-48 overflow-y-auto">
            {preview.toAssign.map((e) => (
              <li key={e.id} className="py-0.5">
                {e.fullName}
                {e.department && <span className="text-stone-400"> · {e.department}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
