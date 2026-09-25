'use client';

import Link from 'next/link';
import type { LearningMaterial, LearningMaterialType } from '@/types/learning';

export const MATERIAL_TYPE_LABEL: Record<LearningMaterialType, string> = {
  AUDIO: 'audio',
  VIDEO: 'video',
  ARTICLE: 'maqola',
  BOOK: 'kitob',
  COURSE: 'kurs',
};

export const MATERIAL_TYPE_STYLE: Record<LearningMaterialType, string> = {
  AUDIO: 'bg-amber-50 text-amber-700',
  VIDEO: 'bg-sky-50 text-sky-700',
  ARTICLE: 'bg-orange-50 text-orange-700',
  BOOK: 'bg-rose-50 text-rose-700',
  COURSE: 'bg-violet-50 text-violet-700',
};

const TYPE_ICON: Record<LearningMaterialType, JSX.Element> = {
  AUDIO: <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0M12 19v3" />,
  VIDEO: <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm5 5v6l5-3-5-3Z" />,
  ARTICLE: <path d="M6 3h9l4 4v14H6V3Zm9 0v4h4M9 11h6M9 15h6" />,
  BOOK: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm0 14a2 2 0 0 1 2-2h13" />,
  COURSE: <path d="M3 8l9-4 9 4-9 4-9-4Zm4 2v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5" />,
};

// Muqova rasmi bo'lmasa — material id'sidan barqaror gradient tanlanadi,
// shunda katalog rang-barang, lekin har safar bir xil ko'rinadi.
const COVER_GRADIENTS = [
  'from-sky-200 via-sky-100 to-emerald-100',
  'from-emerald-200 via-lime-100 to-amber-100',
  'from-amber-200 via-orange-100 to-rose-100',
  'from-violet-200 via-fuchsia-100 to-sky-100',
  'from-rose-200 via-pink-100 to-violet-100',
  'from-teal-200 via-cyan-100 to-indigo-100',
];

function hashIndex(id: string, size: number) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % size;
}

export function TypeIcon({ type, className = 'h-4 w-4' }: { type: LearningMaterialType; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {TYPE_ICON[type]}
    </svg>
  );
}

export function MaterialCover({
  material,
  className = '',
  iconClassName = 'h-10 w-10',
}: {
  material: Pick<LearningMaterial, 'id' | 'type' | 'coverUrl' | 'title'>;
  className?: string;
  iconClassName?: string;
}) {
  if (material.coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={material.coverUrl} alt="" className={`object-cover ${className}`} />;
  }
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br text-stone-700/70 ${
        COVER_GRADIENTS[hashIndex(material.id, COVER_GRADIENTS.length)]
      } ${className}`}
    >
      <TypeIcon type={material.type} className={iconClassName} />
    </div>
  );
}

export function TypeBadge({ type }: { type: LearningMaterialType }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${MATERIAL_TYPE_STYLE[type]}`}>
      <TypeIcon type={type} className="h-3.5 w-3.5" />
      {MATERIAL_TYPE_LABEL[type]}
    </span>
  );
}

export function formatDuration(minutes: number) {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes} daq.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} soat ${rest} daq.` : `${hours} soat`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-stone-200 ${className}`}>
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

// "So'nggi qo'shilganlar" va katalog uchun vertikal kartochka
export function MaterialCard({ material }: { material: LearningMaterial }) {
  return (
    <Link href={`/learning/materials/${material.id}`} className="group flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl border border-stone-200">
        <MaterialCover material={material} className="aspect-[4/3] w-full transition group-hover:scale-[1.02]" />
        {material.isFavorite && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-1.5 py-0.5 text-xs text-rose-600">♥</span>
        )}
        {material.myProgress?.status === 'COMPLETED' && (
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-emerald-700">
            ✓ tugatilgan
          </span>
        )}
      </div>
      <div>
        <TypeBadge type={material.type} />
      </div>
      <p className="line-clamp-2 text-sm font-semibold text-stone-800 group-hover:text-accent">{material.title}</p>
      <p className="flex items-center gap-1 text-xs text-stone-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
          <path d="M12 8v4l3 2M12 3a9 9 0 1 0 .01 0Z" />
        </svg>
        {formatDuration(material.durationMinutes)}
      </p>
    </Link>
  );
}

// "Davom ettirish" / "Tayinlangan" / "Tarix" tablari uchun gorizontal qator
export function MaterialRow({ material, extra }: { material: LearningMaterial; extra?: React.ReactNode }) {
  const progress = material.myProgress?.progress ?? 0;
  const isCompleted = material.myProgress?.status === 'COMPLETED';
  return (
    <Link
      href={`/learning/materials/${material.id}`}
      className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-3 transition hover:border-stone-300 hover:shadow-sm"
    >
      <MaterialCover material={material} className="h-16 w-16 flex-shrink-0 rounded-lg" iconClassName="h-7 w-7" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold text-stone-800">{material.title}</p>
        <p className="mt-0.5 text-xs text-stone-400">
          {MATERIAL_TYPE_LABEL[material.type]} · {formatDuration(material.durationMinutes)}
          {extra}
        </p>
      </div>
      <div className="flex w-24 flex-shrink-0 flex-col items-end gap-1">
        {isCompleted ? (
          <span className="text-xs font-semibold text-emerald-700">✓ tugatilgan</span>
        ) : (
          <>
            <span className="text-xs font-semibold text-stone-700">{progress} %</span>
            <ProgressBar value={progress} className="w-full" />
          </>
        )}
      </div>
    </Link>
  );
}

export function PageBackLink({ href = '/learning', label = "O'qish bosh sahifasi" }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-accent">
      ← {label}
    </Link>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400">{children}</p>;
}
