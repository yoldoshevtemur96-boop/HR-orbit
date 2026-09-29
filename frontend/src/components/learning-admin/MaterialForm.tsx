'use client';

import { useState } from 'react';
import { MATERIAL_TYPE_LABEL, MaterialCover, TypeBadge, formatDuration } from '@/components/learning/materialUi';
import { FIELD_CLASS } from '@/components/learning-admin/formParts';
import type { LearningMaterialType } from '@/types/learning';

export type PublishStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface MaterialFormValues {
  title: string;
  description: string;
  type: LearningMaterialType;
  coverUrl: string;
  contentUrl: string;
  durationMinutes: number;
  author: string;
  tags: string[];
  requiresApproval: boolean;
}

export const EMPTY_MATERIAL: MaterialFormValues = {
  title: '',
  description: '',
  type: 'VIDEO',
  coverUrl: '',
  contentUrl: '',
  durationMinutes: 30,
  author: '',
  tags: [],
  requiresApproval: false,
};

const TYPES: LearningMaterialType[] = ['COURSE', 'VIDEO', 'AUDIO', 'ARTICLE', 'BOOK'];

const CONTENT_HINT: Record<LearningMaterialType, string> = {
  COURSE: 'Kurs sahifasi havolasi',
  VIDEO: 'YouTube, Vimeo yoki video fayl havolasi',
  AUDIO: 'Podkast yoki audio fayl havolasi',
  ARTICLE: 'Maqola havolasi',
  BOOK: 'Kitob (PDF) yoki uning sahifasi havolasi',
};

// Material yaratish/tahrirlash formasi + o'ngda xodim ko'radigan kartochka
export function MaterialForm({
  initial,
  currentStatus,
  isSaving,
  error,
  onSubmit,
}: {
  initial: MaterialFormValues;
  currentStatus: PublishStatus | null; // null — yangi material
  isSaving: boolean;
  error: string | null;
  onSubmit: (values: MaterialFormValues, status: PublishStatus) => void;
}) {
  const [values, setValues] = useState<MaterialFormValues>(initial);
  const [tagInput, setTagInput] = useState('');

  function set<K extends keyof MaterialFormValues>(key: K, value: MaterialFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (tag && !values.tags.includes(tag) && values.tags.length < 10) set('tags', [...values.tags, tag]);
    setTagInput('');
  }

  const canSave = values.title.trim().length > 0;
  const canPublish = canSave && values.contentUrl.trim().length > 0;
  const previewMaterial = { id: values.title || 'yangi', type: values.type, coverUrl: values.coverUrl || null, title: values.title };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-5 rounded-xl border border-stone-200 bg-white p-6">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-stone-500">Turi</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set('type', t)}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                  values.type === t ? 'border-accent bg-accent text-white' : 'border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                {MATERIAL_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Nomi *</label>
          <input value={values.title} onChange={(e) => set('title', e.target.value)} className={FIELD_CLASS} maxLength={300} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Tavsif</label>
          <textarea
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            rows={4}
            placeholder="Nimani o'rgatadi, kimlar uchun"
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Kontent havolasi (nashr qilish uchun majburiy)</label>
          <input
            type="url"
            value={values.contentUrl}
            onChange={(e) => set('contentUrl', e.target.value)}
            placeholder="https://"
            className={FIELD_CLASS}
          />
          <p className="mt-1 text-xs text-stone-400">{CONTENT_HINT[values.type]}. Xodim &quot;Boshlash&quot;ni bosganda shu havola ochiladi.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Davomiyligi (daqiqa)</label>
            <input
              type="number"
              min={0}
              value={values.durationMinutes}
              onChange={(e) => set('durationMinutes', Math.max(0, Number(e.target.value) || 0))}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Muallif</label>
            <input value={values.author} onChange={(e) => set('author', e.target.value)} className={FIELD_CLASS} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Muqova rasmi havolasi (ixtiyoriy)</label>
          <input
            type="url"
            value={values.coverUrl}
            onChange={(e) => set('coverUrl', e.target.value)}
            placeholder="https:// — bo'sh qolsa, rangli muqova avtomatik"
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Teglar (qidiruv uchun, 10 tagacha)</label>
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-stone-200 px-2 py-1.5">
            {values.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => set('tags', values.tags.filter((t) => t !== tag))}
                className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600 hover:bg-rose-50 hover:text-rose-600"
              >
                #{tag} ✕
              </button>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder={values.tags.length ? '' : "masalan: excel — Enter bilan qo'shing"}
              className="min-w-[160px] flex-1 px-1 py-1 text-sm outline-none"
            />
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={values.requiresApproval}
            onChange={(e) => set('requiresApproval', e.target.checked)}
          />
          <span>
            Rahbar tasdig&apos;i kerak
            <span className="block text-xs text-stone-400">
              Xodim avval rahbardan so&apos;raydi — kontent tasdiqdan keyin ochiladi (tayinlanganlarga darhol ochiq).
            </span>
          </span>
        </label>
      </div>

      <aside className="sticky top-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Xodim shunday ko&apos;radi</p>
          <MaterialCover material={previewMaterial} className="aspect-[4/3] w-full rounded-lg border border-stone-200" />
          <div>
            <TypeBadge type={values.type} />
          </div>
          <p className="line-clamp-2 text-sm font-semibold text-stone-800">{values.title || 'Material nomi'}</p>
          <p className="text-xs text-stone-400">{formatDuration(values.durationMinutes)}</p>
        </div>

        {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="flex flex-col gap-2">
          {currentStatus !== 'PUBLISHED' && (
            <button
              type="button"
              disabled={!canPublish || isSaving}
              onClick={() => onSubmit(values, 'PUBLISHED')}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {isSaving ? 'Saqlanmoqda...' : 'Nashr qilish'}
            </button>
          )}
          {currentStatus === 'PUBLISHED' && (
            <button
              type="button"
              disabled={!canPublish || isSaving}
              onClick={() => onSubmit(values, 'PUBLISHED')}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {isSaving ? 'Saqlanmoqda...' : "O'zgarishlarni saqlash"}
            </button>
          )}
          {currentStatus !== 'PUBLISHED' && (
            <button
              type="button"
              disabled={!canSave || isSaving}
              onClick={() => onSubmit(values, 'DRAFT')}
              className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-40"
            >
              Qoralama sifatida saqlash
            </button>
          )}
          {!canPublish && canSave && (
            <p className="text-xs text-stone-400">Nashr qilish uchun kontent havolasini kiriting.</p>
          )}
          <p className="text-xs text-stone-400">Qoralama xodimlarga ko&apos;rinmaydi.</p>
        </div>
      </aside>
    </div>
  );
}
