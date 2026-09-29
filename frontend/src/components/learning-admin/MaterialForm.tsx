'use client';

import { useEffect, useState } from 'react';
import { api, resolveFileUrl } from '@/lib/api';
import { MATERIAL_TYPE_LABEL, MaterialCover, TypeBadge, formatDuration } from '@/components/learning/materialUi';
import { FIELD_CLASS, OptionList } from '@/components/learning-admin/formParts';
import { FileUpload, formatBytes, type UploadedFile } from '@/components/learning-admin/FileUpload';
import {
  LANGUAGE_LABEL,
  LEVEL_LABEL,
  type LearningCompletionRule,
  type LearningContentSource,
  type LearningDisplayMode,
  type LearningLevel,
  type LearningMaterialType,
  type LearningVisibility,
} from '@/types/learning';
import {
  ASSIGNMENT_REASON_LABEL,
  RULE_STATUS_LABEL,
  RULE_TYPE_LABEL,
  type AssignmentReason,
  type AssignmentRuleRow,
  type AudienceOptions,
} from '@/types/learningAdmin';

export type PublishStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface MaterialFormValues {
  title: string;
  description: string;
  type: LearningMaterialType;
  coverUrl: string; // '' | tashqi havola | /files/<id>
  contentSource: LearningContentSource;
  contentUrl: string;
  contentFile: Omit<UploadedFile, 'url'> & { url?: string } | null;
  displayMode: LearningDisplayMode;
  completionRule: LearningCompletionRule;
  durationMinutes: number;
  author: string;
  level: '' | LearningLevel;
  language: '' | 'uz' | 'ru' | 'en';
  tags: string[];
  requiresApproval: boolean;
  allowDownload: boolean;
  visibility: LearningVisibility;
  visibleDepartmentIds: string[];
  visiblePositionIds: string[];
  visibleBranchIds: string[];
  availableFrom: string; // yyyy-mm-dd
  availableUntil: string;
  assign: AssignSettings;
  attachedRuleIds: string[]; // biriktiriladigan global qoidalar (faqat yangi materialda)
}

// "Majburiy qilish" bloki — material saqlanganda tayinlov yoki doimiy qoida yaratiladi
export interface AssignSettings {
  enabled: boolean;
  mode: 'ONE_TIME' | 'PERMANENT';
  sameAsVisibility: boolean;
  allOrganization: boolean;
  departmentIds: string[];
  positionIds: string[];
  branchIds: string[];
  reason: AssignmentReason;
  reasonText: string;
  dueMode: 'days' | 'date' | 'none';
  dueInDays: number;
  dueDate: string;
  checkHistory: boolean;
  historyDays: number;
}

export const EMPTY_ASSIGN: AssignSettings = {
  enabled: false,
  mode: 'PERMANENT',
  sameAsVisibility: true,
  allOrganization: false,
  departmentIds: [],
  positionIds: [],
  branchIds: [],
  reason: 'POSITION',
  reasonText: '',
  dueMode: 'days',
  dueInDays: 14,
  dueDate: '',
  checkHistory: true,
  historyDays: 365,
};

// Backend'dagi saqlangan (qoralama) sozlamadan forma holatiga
export function assignFromPending(pending: Record<string, any> | null | undefined): AssignSettings {
  if (!pending) return EMPTY_ASSIGN;
  return {
    ...EMPTY_ASSIGN,
    enabled: true,
    mode: pending.mode ?? 'PERMANENT',
    sameAsVisibility: Boolean(pending.sameAsVisibility),
    allOrganization: Boolean(pending.allOrganization),
    departmentIds: pending.departmentIds ?? [],
    positionIds: pending.positionIds ?? [],
    branchIds: pending.branchIds ?? [],
    reason: pending.reason ?? 'POSITION',
    reasonText: pending.reasonText ?? '',
    dueMode: pending.dueDate ? 'date' : pending.dueInDays ? 'days' : 'none',
    dueInDays: pending.dueInDays ?? 14,
    dueDate: pending.dueDate ?? '',
    checkHistory: Boolean(pending.skipIfCompletedWithinDays),
    historyDays: pending.skipIfCompletedWithinDays ?? 365,
  };
}

export const EMPTY_MATERIAL: MaterialFormValues = {
  title: '',
  description: '',
  type: 'VIDEO',
  coverUrl: '',
  contentSource: 'FILE',
  contentUrl: '',
  contentFile: null,
  displayMode: 'EMBED',
  completionRule: 'MANUAL',
  durationMinutes: 30,
  author: '',
  level: '',
  language: 'uz',
  tags: [],
  requiresApproval: false,
  allowDownload: true,
  visibility: 'ALL',
  visibleDepartmentIds: [],
  visiblePositionIds: [],
  visibleBranchIds: [],
  availableFrom: '',
  availableUntil: '',
  assign: EMPTY_ASSIGN,
  attachedRuleIds: [],
};

// Backend'ga yuboriladigan ko'rinish
export function toMaterialPayload(values: MaterialFormValues) {
  const { contentFile, level, language, availableFrom, availableUntil, assign, ...rest } = values;
  return {
    ...rest,
    assignment: assign.enabled
      ? {
          mode: assign.mode,
          sameAsVisibility: assign.sameAsVisibility,
          allOrganization: assign.allOrganization,
          departmentIds: assign.departmentIds,
          positionIds: assign.positionIds,
          branchIds: assign.branchIds,
          reason: assign.reason,
          reasonText: assign.reason === 'OTHER' ? assign.reasonText : null,
          dueInDays: assign.dueMode === 'days' ? assign.dueInDays : null,
          dueDate: assign.dueMode === 'date' && assign.mode === 'ONE_TIME' ? assign.dueDate || null : null,
          skipIfCompletedWithinDays: assign.checkHistory ? assign.historyDays : null,
        }
      : null,
    contentFileId: values.contentSource === 'FILE' ? contentFile?.id ?? null : null,
    contentUrl: values.contentSource === 'LINK' ? values.contentUrl : '',
    level: level || null,
    language: language || null,
    availableFrom: availableFrom || null,
    availableUntil: availableUntil || null,
  };
}

const TYPES: LearningMaterialType[] = ['COURSE', 'VIDEO', 'AUDIO', 'ARTICLE', 'BOOK', 'INSTRUCTION', 'PRESENTATION'];

const CONTENT_ACCEPT =
  '.pdf,.doc,.docx,.ppt,.pptx,.xlsx,.mp4,.webm,.mp3,.m4a,.wav,.ogg,.jpg,.jpeg,.png,.webp';

function isMediaMime(mime: string | undefined) {
  return Boolean(mime && (mime.startsWith('video/') || mime.startsWith('audio/')));
}

// Platforma ichida ko'rsatib bo'ladigan fayllar: PDF, video, audio, rasm
function isEmbeddableMime(mime: string | undefined) {
  return Boolean(mime && (mime === 'application/pdf' || isMediaMime(mime) || mime.startsWith('image/')));
}

export function isEmbeddableLink(url: string) {
  return /(?:youtube\.com\/watch|youtu\.be\/|vimeo\.com\/\d)/.test(url);
}

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-6">
      <div>
        <h2 className="text-base font-semibold text-stone-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-stone-400">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; hint?: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {options.map((o) => (
        <label
          key={o.value}
          className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm transition ${
            o.disabled ? 'cursor-not-allowed opacity-40' : ''
          } ${value === o.value ? 'border-accent bg-accent/5' : 'border-stone-200 hover:border-stone-300'}`}
        >
          <span className="flex items-center gap-2 font-medium text-stone-800">
            <input type="radio" checked={value === o.value} disabled={o.disabled} onChange={() => onChange(o.value)} />
            {o.label}
          </span>
          {o.hint && <span className="pl-5 text-xs text-stone-500">{o.hint}</span>}
        </label>
      ))}
    </div>
  );
}

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
  const [coverMode, setCoverMode] = useState<'auto' | 'upload' | 'url'>(
    !initial.coverUrl ? 'auto' : initial.coverUrl.startsWith('/files/') ? 'upload' : 'url',
  );
  const [audience, setAudience] = useState<AudienceOptions | null>(null);
  const [globalRules, setGlobalRules] = useState<AssignmentRuleRow[] | null>(null);

  useEffect(() => {
    api.get<AudienceOptions>('/learning-admin/audience-options').then((res) => setAudience(res.data));
    if (currentStatus === null) {
      api
        .get<AssignmentRuleRow[]>('/learning-admin/rules', { params: { scope: 'GLOBAL' } })
        .then((res) => setGlobalRules(res.data.filter((r) => r.status !== 'ARCHIVED')));
    }
  }, [currentStatus]);

  function toggleRule(id: string) {
    setValues((v) => ({
      ...v,
      attachedRuleIds: v.attachedRuleIds.includes(id) ? v.attachedRuleIds.filter((x) => x !== id) : [...v.attachedRuleIds, id],
    }));
  }

  function set<K extends keyof MaterialFormValues>(key: K, value: MaterialFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleIn(key: 'visibleDepartmentIds' | 'visiblePositionIds' | 'visibleBranchIds', id: string) {
    setValues((v) => ({ ...v, [key]: v[key].includes(id) ? v[key].filter((x) => x !== id) : [...v[key], id] }));
  }

  function setAssign<K extends keyof AssignSettings>(key: K, value: AssignSettings[K]) {
    setValues((v) => ({ ...v, assign: { ...v.assign, [key]: value } }));
  }

  function toggleAssign(key: 'departmentIds' | 'positionIds' | 'branchIds', id: string) {
    setValues((v) => ({
      ...v,
      assign: { ...v.assign, [key]: v.assign[key].includes(id) ? v.assign[key].filter((x) => x !== id) : [...v.assign[key], id] },
    }));
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (tag && !values.tags.includes(tag) && values.tags.length < 10) set('tags', [...values.tags, tag]);
    setTagInput('');
  }

  // Tanlangan manbaga qarab mavjud bo'lmagan variantlarni avtomatik tuzatamiz
  const fileMime = values.contentFile?.mimeType;
  const canEmbed =
    values.contentSource === 'FILE' ? isEmbeddableMime(fileMime) : isEmbeddableLink(values.contentUrl);
  const canFinishTracking = values.contentSource === 'FILE' && isMediaMime(fileMime) && values.displayMode === 'EMBED';

  useEffect(() => {
    if (!canEmbed && values.displayMode === 'EMBED' && (values.contentFile || values.contentUrl)) set('displayMode', 'NEW_TAB');
    if (!canFinishTracking && values.completionRule === 'ON_FINISH') set('completionRule', 'MANUAL');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEmbed, canFinishTracking]);

  const hasContent = values.contentSource === 'FILE' ? Boolean(values.contentFile) : values.contentUrl.trim().length > 0;
  const audienceSize = values.visibleDepartmentIds.length + values.visiblePositionIds.length + values.visibleBranchIds.length;
  const canSave = values.title.trim().length > 0;
  const a = values.assign;
  // Yashirin materialda "ko'rinadiganlarga" varianti ma'nosiz — alohida auditoriya kerak
  const assignUsesVisibility = a.sameAsVisibility && values.visibility !== 'HIDDEN';
  const assignAudienceOk =
    !a.enabled ||
    (assignUsesVisibility
      ? true
      : a.allOrganization || a.departmentIds.length + a.positionIds.length + a.branchIds.length > 0);
  const assignValid = assignAudienceOk && (!a.enabled || a.reason !== 'OTHER' || a.reasonText.trim().length > 0);
  const canPublish = canSave && hasContent && (values.visibility !== 'AUDIENCE' || audienceSize > 0) && assignValid;
  const previewMaterial = { id: values.title || 'yangi', type: values.type, coverUrl: values.coverUrl || null, title: values.title };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-5">
        {/* 1. Asosiy */}
        <Block title="Asosiy">
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
        </Block>

        {/* 2. Muqova */}
        <Block title="Muqova" hint="Katalog kartochkasida ko'rinadi. Tavsiya: 4:3 nisbat, kamida 800×600.">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['auto', 'Avtomatik rangli'],
                ['upload', 'Rasm yuklash'],
                ['url', 'Rasm havolasi'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setCoverMode(mode);
                  if (mode === 'auto') set('coverUrl', '');
                }}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                  coverMode === mode ? 'border-accent bg-accent/10 text-accent' : 'border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {coverMode === 'upload' &&
            (values.coverUrl.startsWith('/files/') ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveFileUrl(values.coverUrl) ?? ''} alt="" className="h-20 w-28 rounded-md border border-stone-200 object-cover" />
                <button type="button" onClick={() => set('coverUrl', '')} className="text-sm text-stone-500 hover:text-rose-600">
                  Boshqa rasm
                </button>
              </div>
            ) : (
              <FileUpload
                purpose="cover"
                accept=".jpg,.jpeg,.png,.webp"
                hint="JPG, PNG yoki WebP"
                onUploaded={(f) => set('coverUrl', f.url)}
              />
            ))}
          {coverMode === 'url' && (
            <input
              type="url"
              value={values.coverUrl}
              onChange={(e) => set('coverUrl', e.target.value)}
              placeholder="https://..."
              className={FIELD_CLASS}
            />
          )}
        </Block>

        {/* 3. Kontent */}
        <Block title="Kontent" hint="Xodim 'Boshlash'ni bosganda nima ochiladi.">
          <Choice<LearningContentSource>
            value={values.contentSource}
            onChange={(v) => set('contentSource', v)}
            options={[
              { value: 'FILE', label: 'Fayl yuklash', hint: 'PDF, Word, PowerPoint, Excel, video, audio' },
              { value: 'LINK', label: 'Havola', hint: 'YouTube, Vimeo, tashqi kurs yoki sayt' },
            ]}
          />

          {values.contentSource === 'FILE' &&
            (values.contentFile ? (
              <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-stone-800">{values.contentFile.fileName}</span>
                  <span className="block text-xs text-stone-400">
                    {values.contentFile.mimeType} · {formatBytes(values.contentFile.sizeBytes)}
                  </span>
                </span>
                {values.contentFile.url && (
                  <a
                    href={resolveFileUrl(values.contentFile.url) ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-stone-500 hover:text-accent"
                  >
                    Ko&apos;rish
                  </a>
                )}
                <button type="button" onClick={() => set('contentFile', null)} className="text-sm text-stone-500 hover:text-rose-600">
                  Almashtirish
                </button>
              </div>
            ) : (
              <FileUpload
                purpose="content"
                accept={CONTENT_ACCEPT}
                hint="PDF, DOCX, PPTX, XLSX, MP4, MP3"
                onUploaded={(f) => {
                  set('contentFile', f);
                  if (f.mimeType.startsWith('video/')) set('type', 'VIDEO');
                  else if (f.mimeType.startsWith('audio/')) set('type', 'AUDIO');
                  else if (f.mimeType.includes('presentation')) set('type', 'PRESENTATION');
                }}
              />
            ))}

          {values.contentSource === 'LINK' && (
            <input
              type="url"
              value={values.contentUrl}
              onChange={(e) => set('contentUrl', e.target.value)}
              placeholder="https://"
              className={FIELD_CLASS}
            />
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-500">Qanday ochiladi</label>
            <Choice<LearningDisplayMode>
              value={values.displayMode}
              onChange={(v) => set('displayMode', v)}
              options={[
                {
                  value: 'EMBED',
                  label: 'Platforma ichida',
                  hint: canEmbed ? "Ko'ruvchi yoki pleyer sahifaning o'zida" : 'PDF, video, audio, rasm yoki YouTube/Vimeo uchun',
                  disabled: !canEmbed,
                },
                { value: 'NEW_TAB', label: 'Yangi oynada', hint: 'Fayl yoki havola alohida oynada ochiladi' },
              ]}
            />
          </div>

          {values.contentSource === 'FILE' && (
            <label className="flex items-start gap-2 text-sm text-stone-700">
              <input type="checkbox" className="mt-0.5" checked={values.allowDownload} onChange={(e) => set('allowDownload', e.target.checked)} />
              <span>
                Yuklab olishga ruxsat
                <span className="block text-xs text-stone-400">O&apos;chirilsa — &quot;Yuklab olish&quot; tugmasi ko&apos;rinmaydi (ichki hujjatlar uchun).</span>
              </span>
            </label>
          )}
        </Block>

        {/* 4. Tugatish sharti */}
        <Block title="Tugatish sharti" hint="Material qachon 'tugatilgan' hisoblanadi.">
          <Choice<LearningCompletionRule>
            value={values.completionRule}
            onChange={(v) => set('completionRule', v)}
            options={[
              { value: 'MANUAL', label: "'Tugatdim' tugmasi", hint: 'Xodim o‘zi belgilaydi' },
              { value: 'ON_OPEN', label: 'Ochilganda', hint: 'Qisqa yo‘riqnoma, e’lon uchun' },
              {
                value: 'ON_FINISH',
                label: 'Oxirigacha ko‘rilganda',
                hint: canFinishTracking ? 'Video/audio tugaganda avtomatik' : 'Faqat platforma ichidagi video/audio uchun',
                disabled: !canFinishTracking,
              },
            ]}
          />
        </Block>

        {/* 5. Qo'shimcha */}
        <Block title="Qo'shimcha">
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
              <label className="mb-1 block text-xs font-medium text-stone-500">Muallif / ekspert</label>
              <input value={values.author} onChange={(e) => set('author', e.target.value)} className={FIELD_CLASS} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">Daraja</label>
              <select value={values.level} onChange={(e) => set('level', e.target.value as MaterialFormValues['level'])} className={FIELD_CLASS}>
                <option value="">Ko&apos;rsatilmagan</option>
                {(Object.keys(LEVEL_LABEL) as LearningLevel[]).map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABEL[l]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">Til</label>
              <select
                value={values.language}
                onChange={(e) => set('language', e.target.value as MaterialFormValues['language'])}
                className={FIELD_CLASS}
              >
                <option value="">Ko&apos;rsatilmagan</option>
                {Object.entries(LANGUAGE_LABEL).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Teglar va ko&apos;nikmalar (qidiruv uchun, 10 tagacha)</label>
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
        </Block>

        {/* 6. Kirish va ko'rinish */}
        <Block title="Kirish va ko'rinish" hint="Katalogda kim ko'radi. Tayinlangan xodim materialni har doim ko'radi.">
          <Choice<LearningVisibility>
            value={values.visibility}
            onChange={(v) => set('visibility', v)}
            options={[
              { value: 'ALL', label: 'Hammaga', hint: 'Katalogda barcha xodimlar ko‘radi' },
              { value: 'AUDIENCE', label: 'Faqat tanlanganlarga', hint: 'Bo‘lim, lavozim yoki filial' },
              { value: 'HIDDEN', label: 'Yashirin', hint: 'Faqat tayinlanganlar oladi' },
            ]}
          />
          {values.visibility === 'AUDIENCE' &&
            (audience ? (
              <div className="grid gap-3 md:grid-cols-3">
                <OptionList
                  title="Bo'limlar"
                  items={audience.departments}
                  selected={values.visibleDepartmentIds}
                  onToggle={(id) => toggleIn('visibleDepartmentIds', id)}
                />
                <OptionList
                  title="Lavozimlar"
                  items={audience.positions}
                  selected={values.visiblePositionIds}
                  onToggle={(id) => toggleIn('visiblePositionIds', id)}
                />
                <OptionList
                  title="Filiallar"
                  items={audience.branches}
                  selected={values.visibleBranchIds}
                  onToggle={(id) => toggleIn('visibleBranchIds', id)}
                />
              </div>
            ) : (
              <p className="text-sm text-stone-400">Yuklanmoqda...</p>
            ))}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">Ko&apos;rinadi — dan (ixtiyoriy)</label>
              <input type="date" value={values.availableFrom} onChange={(e) => set('availableFrom', e.target.value)} className={FIELD_CLASS} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">gacha (ixtiyoriy)</label>
              <input type="date" value={values.availableUntil} onChange={(e) => set('availableUntil', e.target.value)} className={FIELD_CLASS} />
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input type="checkbox" className="mt-0.5" checked={values.requiresApproval} onChange={(e) => set('requiresApproval', e.target.checked)} />
            <span>
              Rahbar tasdig&apos;i kerak
              <span className="block text-xs text-stone-400">
                Xodim avval rahbardan so&apos;raydi — kontent tasdiqdan keyin ochiladi (tayinlanganlarga darhol ochiq).
              </span>
            </span>
          </label>
        </Block>

        {/* 7. Tayinlash: global qoidalar + faqat shu kurs uchun (lokal) */}
        <Block title="Tayinlash" hint="Global qoida — umumiy, istalgan kursga biriktiriladi. Lokal — faqat shu kurs uchun.">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-stone-800">Global qoidalar</p>
            {currentStatus !== null ? (
              <p className="text-sm text-stone-500">Global qoidalarni biriktirish va ajratish — tepadagi &quot;Tayinlovlar&quot; tabida.</p>
            ) : globalRules === null ? (
              <p className="text-sm text-stone-400">Yuklanmoqda...</p>
            ) : globalRules.length === 0 ? (
              <p className="text-sm text-stone-400">Hali global qoida yo&apos;q — uni &quot;Qoidalar&quot; bo&apos;limida yaratish mumkin.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-stone-200">
                {globalRules.map((r) => (
                  <label
                    key={r.id}
                    className="flex cursor-pointer items-start gap-2 border-b border-stone-100 px-3 py-2 text-sm last:border-0 hover:bg-stone-50"
                  >
                    <input type="checkbox" className="mt-0.5" checked={values.attachedRuleIds.includes(r.id)} onChange={() => toggleRule(r.id)} />
                    <span className="min-w-0">
                      <span className="block font-medium text-stone-800">{r.name}</span>
                      <span className="block text-xs text-stone-400">
                        {RULE_TYPE_LABEL[r.type]} · {RULE_STATUS_LABEL[r.status]}
                        {r.materials.length > 0 && ` · ${r.materials.length} ta kursda`}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-stone-100 pt-4">
            <label className="flex items-center gap-2 text-sm font-medium text-stone-800">
              <input type="checkbox" checked={a.enabled} onChange={(e) => setAssign('enabled', e.target.checked)} />
              Faqat shu kurs uchun tayinlash (lokal)
            </label>
            <p className="mt-1 text-xs text-stone-400">
              {currentStatus === 'PUBLISHED'
                ? 'Saqlashda bir martalik tayinlov yoki lokal doimiy qoida yaratiladi.'
                : 'Qoralamada sozlama saqlanadi va nashr qilinganda bajariladi.'}
            </p>
          </div>

          {a.enabled && (
            <>
              <Choice<'ONE_TIME' | 'PERMANENT'>
                value={a.mode}
                onChange={(v) => setAssign('mode', v)}
                options={[
                  { value: 'PERMANENT', label: 'Doimiy', hint: 'Hozirgilarga va keyin qo‘shiladiganlarga avtomatik (lokal qoida)' },
                  { value: 'ONE_TIME', label: 'Bir martalik', hint: 'Faqat hozir mos kelganlarga' },
                ]}
              />

              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-stone-500">Kimga</p>
                <label className={`flex items-center gap-2 text-sm ${values.visibility === 'HIDDEN' ? 'opacity-40' : ''}`}>
                  <input
                    type="radio"
                    disabled={values.visibility === 'HIDDEN'}
                    checked={assignUsesVisibility}
                    onChange={() => setAssign('sameAsVisibility', true)}
                  />
                  Ko&apos;rinadiganlarning hammasiga
                  <span className="text-xs text-stone-400">
                    ({values.visibility === 'ALL' ? 'butun tashkilot' : values.visibility === 'AUDIENCE' ? 'tanlangan bo‘lim/lavozim/filial' : 'yashirin materialda mavjud emas'})
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={!assignUsesVisibility} onChange={() => setAssign('sameAsVisibility', false)} />
                  Boshqa auditoriya
                </label>
              </div>

              {!assignUsesVisibility &&
                (audience ? (
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={a.allOrganization} onChange={(e) => setAssign('allOrganization', e.target.checked)} />
                      Butun tashkilot
                    </label>
                    {!a.allOrganization && (
                      <div className="grid gap-3 md:grid-cols-3">
                        <OptionList title="Bo'limlar" items={audience.departments} selected={a.departmentIds} onToggle={(id) => toggleAssign('departmentIds', id)} />
                        <OptionList title="Lavozimlar" items={audience.positions} selected={a.positionIds} onToggle={(id) => toggleAssign('positionIds', id)} />
                        <OptionList title="Filiallar" items={audience.branches} selected={a.branchIds} onToggle={(id) => toggleAssign('branchIds', id)} />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-stone-400">Yuklanmoqda...</p>
                ))}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">Sabab</label>
                  <select value={a.reason} onChange={(e) => setAssign('reason', e.target.value as AssignmentReason)} className={FIELD_CLASS}>
                    {(Object.keys(ASSIGNMENT_REASON_LABEL) as AssignmentReason[]).map((r) => (
                      <option key={r} value={r}>
                        {ASSIGNMENT_REASON_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  {a.reason === 'OTHER' && (
                    <input
                      value={a.reasonText}
                      onChange={(e) => setAssign('reasonText', e.target.value)}
                      placeholder="Sababni yozing"
                      className={`${FIELD_CLASS} mt-2`}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-2 text-sm">
                  <span className="text-xs font-medium text-stone-500">Muddat</span>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={a.dueMode === 'days'} onChange={() => setAssign('dueMode', 'days')} />
                    <input
                      type="number"
                      min={1}
                      value={a.dueInDays}
                      onChange={(e) => setAssign('dueInDays', Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-sm"
                    />
                    kun ichida
                  </label>
                  {a.mode === 'ONE_TIME' && (
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={a.dueMode === 'date'} onChange={() => setAssign('dueMode', 'date')} />
                      <input
                        type="date"
                        value={a.dueDate}
                        onChange={(e) => {
                          setAssign('dueDate', e.target.value);
                          setAssign('dueMode', 'date');
                        }}
                        className="rounded-lg border border-stone-200 px-2 py-1 text-sm"
                      />
                    </label>
                  )}
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={a.dueMode === 'none'} onChange={() => setAssign('dueMode', 'none')} />
                    Muddatsiz
                  </label>
                </div>
              </div>

              <label className="flex flex-wrap items-center gap-2 text-sm text-stone-700">
                <input type="checkbox" checked={a.checkHistory} onChange={(e) => setAssign('checkHistory', e.target.checked)} />
                Oxirgi
                <input
                  type="number"
                  min={1}
                  value={a.historyDays}
                  disabled={!a.checkHistory}
                  onChange={(e) => setAssign('historyDays', Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-sm disabled:opacity-50"
                />
                kun ichida o&apos;tganlarga tayinlamaslik
              </label>
            </>
          )}
        </Block>
      </div>

      <aside className="sticky top-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Xodim shunday ko&apos;radi</p>
          <MaterialCover material={previewMaterial} className="aspect-[4/3] w-full rounded-lg border border-stone-200" />
          <div>
            <TypeBadge type={values.type} />
          </div>
          <p className="line-clamp-2 text-sm font-semibold text-stone-800">{values.title || 'Material nomi'}</p>
          <p className="text-xs text-stone-400">
            {formatDuration(values.durationMinutes)}
            {values.level && ` · ${LEVEL_LABEL[values.level]}`}
          </p>
        </div>

        {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={!canPublish || isSaving}
            onClick={() => onSubmit(values, 'PUBLISHED')}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {isSaving ? 'Saqlanmoqda...' : currentStatus === 'PUBLISHED' ? "O'zgarishlarni saqlash" : 'Nashr qilish'}
          </button>
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
          {canSave && !hasContent && <p className="text-xs text-stone-400">Nashr qilish uchun kontent faylini yuklang yoki havola kiriting.</p>}
          {a.enabled && !assignValid && (
            <p className="text-xs text-stone-400">Tayinlash uchun auditoriya va sababni to&apos;ldiring.</p>
          )}
          {a.enabled && (
            <p className="text-xs text-stone-500">
              {a.mode === 'PERMANENT' ? 'Doimiy qoida yaratiladi' : 'Bir martalik tayinlanadi'}
              {currentStatus === 'PUBLISHED' ? ' — saqlanganda.' : ' — nashr qilinganda.'}
            </p>
          )}
          {values.visibility === 'AUDIENCE' && audienceSize === 0 && (
            <p className="text-xs text-stone-400">Ko&apos;rinish uchun kamida bitta bo&apos;lim, lavozim yoki filial tanlang.</p>
          )}
          <p className="text-xs text-stone-400">Qoralama xodimlarga ko&apos;rinmaydi.</p>
        </div>
      </aside>
    </div>
  );
}
