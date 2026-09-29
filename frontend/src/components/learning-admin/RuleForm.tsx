'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { FIELD_CLASS, OptionList, PreviewSummary, Section } from '@/components/learning-admin/formParts';
import {
  ASSIGNMENT_REASON_LABEL,
  RULE_TYPE_LABEL,
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
  employeeCodesText: string; // tabel raqamlari — vergul, bo'sh joy yoki yangi qator bilan
  hiredFrom: string; // yyyy-mm-dd
  hiredTo: string;
  notifyOnAssign: boolean;
  remindBefore: boolean;
  remindBeforeDays: number;
  remindAfter: boolean;
  remindAfterDays: number;
  resetProgress: boolean;
}

function parseCodes(text: string) {
  return [...new Set(text.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean))];
}

function isoToDateInput(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
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
  employeeCodesText: '',
  hiredFrom: '',
  hiredTo: '',
  notifyOnAssign: true,
  remindBefore: true,
  remindBeforeDays: 3,
  remindAfter: false,
  remindAfterDays: 3,
  resetProgress: false,
};

// Backend'dagi qoida -> forma qiymatlari (tahrirlash uchun)
export function ruleToFormValues(rule: Record<string, any>): RuleFormValues {
  const due = rule.dueDate ? new Date(new Date(rule.dueDate).getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10) : '';
  return {
    name: rule.name ?? '',
    description: rule.description ?? '',
    tag: rule.tag ?? '',
    type: rule.type,
    materialId: rule.materialId ?? '',
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
    employeeCodesText: (rule.employeeCodes ?? []).join(', '),
    hiredFrom: isoToDateInput(rule.hiredFrom),
    hiredTo: isoToDateInput(rule.hiredTo),
    notifyOnAssign: rule.notifyOnAssign ?? true,
    remindBefore: rule.remindBeforeDays != null,
    remindBeforeDays: rule.remindBeforeDays ?? 3,
    remindAfter: rule.remindAfterDays != null,
    remindAfterDays: rule.remindAfterDays ?? 3,
    resetProgress: Boolean(rule.resetProgress),
  };
}

export function ruleToPayload(v: RuleFormValues) {
  return {
    name: v.name.trim(),
    description: v.description.trim() || null,
    tag: v.tag.trim() || null,
    materialId: v.materialId || null, // bo'sh — global qoida
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
    employeeCodes: parseCodes(v.employeeCodesText),
    hiredFrom: v.hiredFrom || null,
    hiredTo: v.hiredTo || null,
    notifyOnAssign: v.notifyOnAssign,
    remindBeforeDays: v.remindBefore ? v.remindBeforeDays : null,
    remindAfterDays: v.remindAfter ? v.remindAfterDays : null,
    resetProgress: v.resetProgress,
  };
}

const REASONS: AssignmentReason[] = ['LEGAL', 'POSITION', 'ONBOARDING', 'DEVELOPMENT', 'OTHER'];

const RULE_TYPE_HINT: Record<RuleType, string> = {
  PERMANENT:
    "Hozir mos kelganlarga tayinlanadi va keyin ham avtomatik ishlaydi: yangi kelgan yoki shu bo'lim/lavozimga o'tgan xodimga darhol tayinlanadi.",
  ONE_TIME: "Faqat hozir mos kelgan xodimlarga bir marta tayinlanadi, keyin 'Bajarildi' holatiga o'tadi.",
};

// Qoida formasi — 3 bo'lim: Ma'lumotlar, Parametrlar, Maqsadli guruh.
// Material tanlanmaydi: global qoida kurs sahifasida kursga biriktiriladi.
// Parametrlar, Maqsadli guruh. O'ngda "hozir ishga tushsa" natijasi.
// Global qoida — materialsiz (kurslar unga kurs ichida biriktiriladi).
// Lokal qoida — localMaterial berilganda: faqat shu kurs uchun.
export function RuleForm({
  initial,
  mode,
  isSaving,
  error,
  onSubmit,
  localMaterial = null,
  attachedMaterials = [],
}: {
  initial: RuleFormValues;
  mode: 'create' | 'edit';
  isSaving: boolean;
  error: string | null;
  onSubmit: (values: RuleFormValues, activate: boolean) => void;
  localMaterial?: { id: string; title: string } | null;
  attachedMaterials?: { id: string; title: string }[];
}) {
  const [v, setV] = useState<RuleFormValues>({ ...initial, materialId: localMaterial?.id ?? '' });
  const [options, setOptions] = useState<AudienceOptions | null>(null);
  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
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

  const hasAudience =
    v.allOrganization || v.departmentIds.length + v.positionIds.length + v.branchIds.length > 0 || parseCodes(v.employeeCodesText).length > 0;
  const payload = useMemo(() => ({ ...ruleToPayload(v), name: v.name.trim() || 'Qoida' }), [v]);

  useEffect(() => {
    if (!hasAudience || (v.reason === 'OTHER' && !v.reasonText.trim())) {
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
  }, [payload, hasAudience, v.reason, v.reasonText]);

  const canSave =
    v.name.trim().length > 0 &&
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

        {/* Lokal qoida — qaysi kurs uchun (faqat ko'rsatiladi, tanlanmaydi) */}
        {localMaterial && (
          <p className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            Lokal qoida: faqat <span className="font-semibold">{localMaterial.title}</span> kursiga ta&apos;sir qiladi.
          </p>
        )}

        {/* 3. Parametrlar */}
        <Section step={2} title="Parametrlar">
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
            kun ichida kursni o&apos;tganlarga tayinlamaslik
          </label>

          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Qo&apos;shimcha</p>
          <p className="text-sm text-stone-600">✓ Faol tayinlovi bor xodimlarga qayta tayinlanmaydi (doim tekshiriladi).</p>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={v.notifyOnAssign} onChange={(e) => set('notifyOnAssign', e.target.checked)} />
            Tayinlanganda xodimga bildirishnoma yuborish
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={v.remindBefore} onChange={(e) => set('remindBefore', e.target.checked)} />
            Muddatdan
            <input
              type="number"
              min={1}
              max={365}
              value={v.remindBeforeDays}
              disabled={!v.remindBefore}
              onChange={(e) => set('remindBeforeDays', Math.max(1, Number(e.target.value) || 1))}
              className="w-16 rounded-lg border border-stone-200 px-2 py-1 text-sm disabled:opacity-50"
            />
            kun oldin eslatish
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={v.remindAfter} onChange={(e) => set('remindAfter', e.target.checked)} />
            Muddat o&apos;tgach
            <input
              type="number"
              min={1}
              max={365}
              value={v.remindAfterDays}
              disabled={!v.remindAfter}
              onChange={(e) => set('remindAfterDays', Math.max(1, Number(e.target.value) || 1))}
              className="w-16 rounded-lg border border-stone-200 px-2 py-1 text-sm disabled:opacity-50"
            />
            kundan keyin eslatish (tugatmagan bo&apos;lsa)
          </label>
          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input type="checkbox" className="mt-0.5" checked={v.resetProgress} onChange={(e) => set('resetProgress', e.target.checked)} />
            <span>
              Progressni nollash
              <span className="block text-xs text-stone-400">
                Kursni boshlab qo&apos;yganlar ham noldan boshlaydi (tugatganlar har doim noldan boshlaydi).
              </span>
            </span>
          </label>
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
        <Section step={3} title="Maqsadli guruh">
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
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-500">Tabel raqamlari (ixtiyoriy)</label>
                <textarea
                  value={v.employeeCodesText}
                  onChange={(e) => set('employeeCodesText', e.target.value)}
                  rows={2}
                  placeholder="EMP-00005, EMP-00012 — vergul, bo'sh joy yoki yangi qator bilan (Excel'dan nusxalash mumkin)"
                  className={FIELD_CLASS}
                />
                {parseCodes(v.employeeCodesText).length > 0 && (
                  <p className="mt-1 text-xs text-stone-400">{parseCodes(v.employeeCodesText).length} ta tabel raqami</p>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">Ishga kirgan sana — dan (ixtiyoriy)</label>
                  <input type="date" value={v.hiredFrom} onChange={(e) => set('hiredFrom', e.target.value)} className={FIELD_CLASS} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">gacha (ixtiyoriy)</label>
                  <input type="date" value={v.hiredTo} onChange={(e) => set('hiredTo', e.target.value)} className={FIELD_CLASS} />
                </div>
              </div>
              <p className="text-xs text-stone-400">
                Bo&apos;lim / lavozim / filial / tabel raqamlaridan birortasiga mos xodimlar olinadi; ishga kirgan sana va &quot;yangi
                xodimlar&quot; sharti ularni qo&apos;shimcha cheklaydi.
              </p>
            </>
          )}
        </Section>
      </div>

      <aside className="sticky top-4 flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-5">
        <p className="text-sm font-semibold text-stone-900">{localMaterial ? 'Hozir ishga tushsa' : 'Maqsadli guruh'}</p>
        <PreviewSummary
          ready={hasAudience}
          preview={preview}
          isLoading={isPreviewing}
          emptyHint="Maqsadli guruhni tanlang."
          countLabel={localMaterial ? 'xodimga tayinlanadi' : 'xodim mos keladi'}
        />
        {preview?.unmatchedCodes && preview.unmatchedCodes.length > 0 && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Topilmagan tabel raqamlari: {preview.unmatchedCodes.slice(0, 20).join(', ')}
            {preview.unmatchedCodes.length > 20 && ` va yana ${preview.unmatchedCodes.length - 20} ta`}
          </p>
        )}
        {!localMaterial && (
          <p className="text-xs text-stone-400">
            Material tanlanmaydi — qoidani kurs sahifasidagi &quot;Tayinlovlar&quot; tabida istalgan kursga biriktirasiz.
          </p>
        )}
        {!localMaterial && attachedMaterials.length > 0 && (
          <div className="border-t border-stone-100 pt-3">
            <p className="text-xs font-medium text-stone-500">Biriktirilgan kurslar ({attachedMaterials.length})</p>
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-stone-600">
              {attachedMaterials.map((m) => (
                <li key={m.id}>· {m.title}</li>
              ))}
            </ul>
          </div>
        )}
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
