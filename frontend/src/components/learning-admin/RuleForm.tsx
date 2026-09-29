'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { FIELD_CLASS, MaterialPicker, OptionList, PreviewSummary, Section } from '@/components/learning-admin/formParts';
import {
  ASSIGNMENT_REASON_LABEL,
  RULE_TYPE_LABEL,
  type AssignableMaterial,
  type AssignmentPreview,
  type AssignmentReason,
  type AudienceOptions,
  type RuleType,
} from '@/types/learningAdmin';

export interface RuleFormValues {
  name: string;
  description: string;
  tag: string;
  type: RuleType;
  materialId: string;
  checkHistory: boolean;
  historyDays: number;
  reason: AssignmentReason;
  reasonText: string;
  dueMode: 'days' | 'date' | 'none';
  dueInDays: number;
  dueDate: string;
  cancelOutOfScope: boolean;
  note: string;
  allOrganization: boolean;
  departmentIds: string[];
  positionIds: string[];
  branchIds: string[];
  onlyNewHires: boolean;
  hiredWithinDays: number;
}

export const EMPTY_RULE: RuleFormValues = {
  name: '',
  description: '',
  tag: '',
  type: 'PERMANENT',
  materialId: '',
  checkHistory: true,
  historyDays: 365,
  reason: 'ONBOARDING',
  reasonText: '',
  dueMode: 'days',
  dueInDays: 14,
  dueDate: '',
  cancelOutOfScope: true,
  note: '',
  allOrganization: false,
  departmentIds: [],
  positionIds: [],
  branchIds: [],
  onlyNewHires: false,
  hiredWithinDays: 30,
};

// Backend'dagi qoida -> forma qiymatlari (tahrirlash uchun)
export function ruleToFormValues(rule: Record<string, any>): RuleFormValues {
  const due = rule.dueDate ? new Date(new Date(rule.dueDate).getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10) : '';
  return {
    name: rule.name ?? '',
    description: rule.description ?? '',
    tag: rule.tag ?? '',
    type: rule.type,
    materialId: rule.materialId,
    checkHistory: Boolean(rule.skipIfCompletedWithinDays),
    historyDays: rule.skipIfCompletedWithinDays ?? 365,
    reason: rule.reason,
    reasonText: rule.reasonText ?? '',
    dueMode: due ? 'date' : rule.dueInDays ? 'days' : 'none',
    dueInDays: rule.dueInDays ?? 14,
    dueDate: due,
    cancelOutOfScope: Boolean(rule.cancelOutOfScope),
    note: rule.note ?? '',
    allOrganization: Boolean(rule.allOrganization),
    departmentIds: rule.departmentIds ?? [],
    positionIds: rule.positionIds ?? [],
    branchIds: rule.branchIds ?? [],
    onlyNewHires: Boolean(rule.hiredWithinDays),
    hiredWithinDays: rule.hiredWithinDays ?? 30,
  };
}

export function ruleToPayload(v: RuleFormValues) {
  return {
    name: v.name.trim(),
    description: v.description.trim() || null,
    tag: v.tag.trim() || null,
    materialId: v.materialId,
    type: v.type,
    allOrganization: v.allOrganization,
    departmentIds: v.departmentIds,
    positionIds: v.positionIds,
    branchIds: v.branchIds,
    hiredWithinDays: v.onlyNewHires ? v.hiredWithinDays : null,
    reason: v.reason,
    reasonText: v.reason === 'OTHER' ? v.reasonText : undefined,
    note: v.note || undefined,
    dueInDays: v.dueMode === 'days' ? v.dueInDays : null,
    dueDate: v.dueMode === 'date' && v.dueDate ? v.dueDate : null,
    skipIfCompletedWithinDays: v.checkHistory ? v.historyDays : null,
    cancelOutOfScope: v.cancelOutOfScope,
  };
}

const REASONS: AssignmentReason[] = ['LEGAL', 'POSITION', 'ONBOARDING', 'DEVELOPMENT', 'OTHER'];

const RULE_TYPE_HINT: Record<RuleType, string> = {
  PERMANENT:
    "Hozir mos kelganlarga tayinlanadi va keyin ham avtomatik ishlaydi: yangi kelgan yoki shu bo'lim/lavozimga o'tgan xodimga darhol tayinlanadi.",
  ONE_TIME: "Faqat hozir mos kelgan xodimlarga bir marta tayinlanadi, keyin 'Bajarildi' holatiga o'tadi.",
};

// Qoida formasi — Pulsdagi kabi 4 bo'lim: Ma'lumotlar, Materiallar,
// Parametrlar, Maqsadli guruh. O'ngda "hozir ishga tushsa" natijasi.
export function RuleForm({
  initial,
  mode,
  isSaving,
  error,
  onSubmit,
}: {
  initial: RuleFormValues;
  mode: 'create' | 'edit';
  isSaving: boolean;
  error: string | null;
  onSubmit: (values: RuleFormValues, activate: boolean) => void;
}) {
  const [v, setV] = useState<RuleFormValues>(initial);
  const [materials, setMaterials] = useState<AssignableMaterial[] | null>(null);
  const [options, setOptions] = useState<AudienceOptions | null>(null);
  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    api.get<AssignableMaterial[]>('/learning-admin/materials').then((res) => setMaterials(res.data));
    api.get<AudienceOptions>('/learning-admin/audience-options').then((res) => setOptions(res.data));
  }, []);

  function set<K extends keyof RuleFormValues>(key: K, value: RuleFormValues[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  function toggle(key: 'departmentIds' | 'positionIds' | 'branchIds', id: string) {
    setV((prev) => ({ ...prev, [key]: prev[key].includes(id) ? prev[key].filter((x) => x !== id) : [...prev[key], id] }));
  }

  // Doimiy qoidada aniq sana ma'nosiz — "N kun ichida"ga o'tkazamiz
  useEffect(() => {
    if (v.type === 'PERMANENT' && v.dueMode === 'date') set('dueMode', 'days');
  }, [v.type, v.dueMode]);

  const hasAudience = v.allOrganization || v.departmentIds.length + v.positionIds.length + v.branchIds.length > 0;
  const payload = useMemo(() => ({ ...ruleToPayload(v), name: v.name.trim() || 'Qoida' }), [v]);

  useEffect(() => {
    if (!v.materialId || !hasAudience || (v.reason === 'OTHER' && !v.reasonText.trim())) {
      setPreview(null);
      return;
    }
    setIsPreviewing(true);
    const timer = setTimeout(() => {
      api
        .post<AssignmentPreview>('/learning-admin/rules/preview', payload)
        .then((res) => setPreview(res.data))
        .catch(() => setPreview(null))
        .finally(() => setIsPreviewing(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [payload, v.materialId, hasAudience, v.reason, v.reasonText]);

  const canSave =
    v.name.trim().length > 0 &&
    Boolean(v.materialId) &&
    hasAudience &&
    (v.reason !== 'OTHER' || v.reasonText.trim().length > 0) &&
    (v.dueMode !== 'date' || Boolean(v.dueDate));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-5">
        {/* 1. Ma'lumotlar */}
        <Section step={1} title="Ma'lumotlar">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Nomi *</label>
            <input
              value={v.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Masalan: Yangi xodimlar — axborot xavfsizligi"
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Tavsif</label>
            <textarea
              value={v.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              placeholder="Qoida nima uchun kerak, qaysi talab asosida"
              className={FIELD_CLASS}
            />
          </div>
          <div className="md:w-1/2">
            <label className="mb-1 block text-xs font-medium text-stone-500">Teg (guruhlash uchun)</label>
            <input value={v.tag} onChange={(e) => set('tag', e.target.value)} placeholder="masalan: onboarding" className={FIELD_CLASS} />
          </div>
        </Section>

        {/* 2. Materiallar */}
        <Section step={2} title="Materiallar">
          <MaterialPicker materials={materials} value={v.materialId} onChange={(id) => set('materialId', id)} />
          <label className="flex flex-wrap items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={v.checkHistory} onChange={(e) => set('checkHistory', e.target.checked)} />
            O&apos;quv tarixini tekshirish: oxirgi
            <input
              type="number"
              min={1}
              value={v.historyDays}
              disabled={!v.checkHistory}
              onChange={(e) => set('historyDays', Math.max(1, Number(e.target.value) || 1))}
              className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-sm disabled:opacity-50"
            />
            kun ichida o&apos;tganlarga tayinlamaslik
          </label>
        </Section>

        {/* 3. Parametrlar */}
        <Section step={3} title="Parametrlar">
          <div className="grid gap-2 md:grid-cols-2">
            {(['PERMANENT', 'ONE_TIME'] as RuleType[]).map((t) => (
              <label
                key={t}
                className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition ${
                  v.type === t ? 'border-accent bg-accent/5' : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <span className="flex items-center gap-2 font-semibold text-stone-800">
                  <input type="radio" checked={v.type === t} onChange={() => set('type', t)} />
                  {RULE_TYPE_LABEL[t]}
                </span>
                <span className="text-xs text-stone-500">{RULE_TYPE_HINT[t]}</span>
              </label>
            ))}
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Majburiy</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">Tayinlash sababi</label>
              <select value={v.reason} onChange={(e) => set('reason', e.target.value as AssignmentReason)} className={FIELD_CLASS}>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {ASSIGNMENT_REASON_LABEL[r]}
                  </option>
                ))}
              </select>
              {v.reason === 'OTHER' && (
                <input
                  value={v.reasonText}
                  onChange={(e) => set('reasonText', e.target.value)}
                  placeholder="Sababni yozing"
                  className={`${FIELD_CLASS} mt-2`}
                />
              )}
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <span className="text-xs font-medium text-stone-500">Muddat (dedlayn)</span>
              <label className="flex items-center gap-2">
                <input type="radio" checked={v.dueMode === 'days'} onChange={() => set('dueMode', 'days')} />
                Tayinlangandan keyin
                <input
                  type="number"
                  min={1}
                  max={730}
                  value={v.dueInDays}
                  onChange={(e) => set('dueInDays', Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-sm"
                />
                kun ichida
              </label>
              {v.type === 'ONE_TIME' && (
                <label className="flex items-center gap-2">
                  <input type="radio" checked={v.dueMode === 'date'} onChange={() => set('dueMode', 'date')} />
                  Aniq sana
                  <input
                    type="date"
                    value={v.dueDate}
                    onChange={(e) => setV((prev) => ({ ...prev, dueDate: e.target.value, dueMode: 'date' }))}
                    className="rounded-lg border border-stone-200 px-2 py-1 text-sm"
                  />
                </label>
              )}
              <label className="flex items-center gap-2">
                <input type="radio" checked={v.dueMode === 'none'} onChange={() => set('dueMode', 'none')} />
                Muddatsiz
              </label>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Qo&apos;shimcha</p>
          <p className="text-sm text-stone-600">
            ✓ Faol tayinlovi bor xodimlarga qayta tayinlanmaydi (doim tekshiriladi). ✓ Xodimga bildirishnoma va muddatdan 3 kun oldin eslatma
            yuboriladi.
          </p>
          {v.type === 'PERMANENT' && (
            <label className="flex items-start gap-2 text-sm text-stone-700">
              <input type="checkbox" className="mt-0.5" checked={v.cancelOutOfScope} onChange={(e) => set('cancelOutOfScope', e.target.checked)} />
              <span>Xodim shartdan chiqsa (boshqa bo&apos;limga o&apos;tsa, ishdan ketsa) — tugallanmagan tayinlovi bekor qilinsin</span>
            </label>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Izoh xodim uchun (ixtiyoriy)</label>
            <textarea value={v.note} onChange={(e) => set('note', e.target.value)} rows={2} className={FIELD_CLASS} />
          </div>
        </Section>

        {/* 4. Maqsadli guruh */}
        <Section step={4} title="Maqsadli guruh">
          {options === null ? (
            <p className="text-sm text-stone-400">Yuklanmoqda...</p>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 text-sm">
                <input type="checkbox" checked={v.allOrganization} onChange={(e) => set('allOrganization', e.target.checked)} />
                <span className="font-medium text-stone-800">Butun tashkilot</span>
              </label>
              {!v.allOrganization && (
                <div className="grid gap-3 md:grid-cols-3">
                  <OptionList title="Bo'limlar" items={options.departments} selected={v.departmentIds} onToggle={(id) => toggle('departmentIds', id)} />
                  <OptionList title="Lavozimlar" items={options.positions} selected={v.positionIds} onToggle={(id) => toggle('positionIds', id)} />
                  <OptionList title="Filiallar" items={options.branches} selected={v.branchIds} onToggle={(id) => toggle('branchIds', id)} />
                </div>
              )}
              <label className="flex flex-wrap items-center gap-2 text-sm text-stone-700">
                <input type="checkbox" checked={v.onlyNewHires} onChange={(e) => set('onlyNewHires', e.target.checked)} />
                Faqat ishga kirganiga
                <input
                  type="number"
                  min={1}
                  value={v.hiredWithinDays}
                  disabled={!v.onlyNewHires}
                  onChange={(e) => set('hiredWithinDays', Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-sm disabled:opacity-50"
                />
                kundan oshmagan xodimlar
              </label>
              <p className="text-xs text-stone-400">Bir nechta bo&apos;lim/lavozim/filial tanlansa — ularning birortasiga mos xodimlar olinadi.</p>
            </>
          )}
        </Section>
      </div>

      <aside className="sticky top-4 flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-5">
        <p className="text-sm font-semibold text-stone-900">Hozir ishga tushsa</p>
        <PreviewSummary
          ready={Boolean(v.materialId) && hasAudience}
          preview={preview}
          isLoading={isPreviewing}
          emptyHint="Material va maqsadli guruhni tanlang."
        />
        {v.type === 'PERMANENT' && <p className="text-xs text-stone-400">Keyin shartga mos kelgan yangi xodimlarga ham avtomatik tayinlanadi.</p>}
        {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button
          type="button"
          disabled={!canSave || isSaving}
          onClick={() => onSubmit(v, true)}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {isSaving ? 'Saqlanmoqda...' : 'Saqlash va faollashtirish'}
        </button>
        <button
          type="button"
          disabled={!canSave || isSaving}
          onClick={() => onSubmit(v, false)}
          className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-40"
        >
          {mode === 'create' ? 'Qoralama sifatida saqlash' : 'Faollashtirmasdan saqlash'}
        </button>
        {!v.name.trim() && <p className="text-xs text-stone-400">Qoida nomini kiriting.</p>}
      </aside>
    </div>
  );
}
