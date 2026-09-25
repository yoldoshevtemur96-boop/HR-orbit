'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
  MaterialCover,
  PageBackLink,
  ProgressBar,
  TypeBadge,
  formatDate,
  formatDuration,
} from '@/components/learning/materialUi';
import type { LearningMaterialDetail } from '@/types/learning';

const PROGRESS_STEPS = [25, 50, 75];

export default function LearningMaterialPage() {
  const params = useParams<{ id: string }>();
  const [material, setMaterial] = useState<LearningMaterialDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get<LearningMaterialDetail>(`/learning/materials/${params.id}`)
      .then((res) => setMaterial(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik yuz berdi'));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setIsBusy(true);
    setError(null);
    try {
      await action();
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Xatolik yuz berdi');
    } finally {
      setIsBusy(false);
    }
  }

  // Kontent yangi oynada ochiladi — oyna foydalanuvchi bosgan paytda
  // ochilishi kerak (aks holda brauzer popup'ni bloklaydi), shuning uchun
  // havola so'rovdan oldin ochiladi.
  async function handleOpen() {
    if (!material) return;
    if (material.contentUrl) window.open(material.contentUrl, '_blank', 'noopener');
    await run(() => api.post(`/learning/materials/${material.id}/start`));
    if (!material.contentUrl) setError("Bu material uchun havola hali qo'shilmagan");
  }

  if (!material) {
    return error ? (
      <div className="flex flex-col gap-4">
        <PageBackLink />
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      </div>
    ) : (
      <p className="text-sm text-stone-400">Yuklanmoqda...</p>
    );
  }

  const progress = material.myProgress?.progress ?? 0;
  const isStarted = Boolean(material.myProgress);
  const isCompleted = material.myProgress?.status === 'COMPLETED';

  return (
    <div className="flex flex-col gap-6">
      <PageBackLink />

      <div className="grid gap-8 md:grid-cols-[320px_1fr]">
        <MaterialCover material={material} className="aspect-[4/3] w-full rounded-2xl border border-stone-200" iconClassName="h-16 w-16" />

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={material.type} />
            <span className="text-sm text-stone-400">{formatDuration(material.durationMinutes)}</span>
            {material.author && <span className="text-sm text-stone-400">· {material.author}</span>}
          </div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">{material.title}</h1>
          {material.description && <p className="text-sm leading-relaxed text-stone-600">{material.description}</p>}

          {material.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {material.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {material.assignment && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Sizga tayinlangan
              {material.assignment.dueDate && <> · muddat: {formatDate(material.assignment.dueDate)}</>}
              {material.assignment.note && <> · {material.assignment.note}</>}
            </p>
          )}

          {isStarted && (
            <div className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-stone-700">{isCompleted ? 'Tugatilgan' : 'Progress'}</span>
                <span className="font-semibold text-stone-800">{progress} %</span>
              </div>
              <ProgressBar value={progress} />
              {!isCompleted && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-stone-400">Qayergacha yetdingiz?</span>
                  {PROGRESS_STEPS.map((step) => (
                    <button
                      key={step}
                      type="button"
                      disabled={isBusy || step <= progress}
                      onClick={() => run(() => api.put(`/learning/materials/${material.id}/progress`, { progress: step }))}
                      className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:border-stone-300 disabled:opacity-40"
                    >
                      {step} %
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            {material.hasAccess ? (
              <>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleOpen}
                  className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {isCompleted ? 'Qayta ochish' : isStarted ? 'Davom ettirish' : 'Boshlash'}
                </button>
                {isStarted && !isCompleted && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => run(() => api.put(`/learning/materials/${material.id}/progress`, { progress: 100 }))}
                    className="rounded-lg border border-emerald-300 px-5 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                  >
                    ✓ Tugatdim
                  </button>
                )}
              </>
            ) : material.request?.status === 'PENDING' ? (
              <span className="rounded-lg bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
                So&apos;rovingiz rahbar tomonidan ko&apos;rib chiqilmoqda
              </span>
            ) : (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => run(() => api.post('/learning/requests', { materialId: material.id }))}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Rahbardan so&apos;rash
              </button>
            )}

            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                run(() =>
                  material.isFavorite
                    ? api.delete(`/learning/materials/${material.id}/favorite`)
                    : api.put(`/learning/materials/${material.id}/favorite`),
                )
              }
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
                material.isFavorite
                  ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                  : 'border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {material.isFavorite ? '♥ Sevimlilarda' : '♡ Sevimlilarga qo‘shish'}
            </button>
          </div>

          {!material.hasAccess && (
            <p className="text-xs text-stone-400">
              Bu material uchun rahbar tasdig&apos;i kerak. So&apos;rov tasdiqlangach, uni ochishingiz mumkin bo&apos;ladi.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
