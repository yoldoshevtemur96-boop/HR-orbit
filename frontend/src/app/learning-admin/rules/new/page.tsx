'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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

const REASONS: AssignmentReason[] = ['LEGAL', 'POSITION', 'ONBOARDING', 'DEVELOPMENT', 'OTHER'];

const RULE_TYPE_HINT: Record<RuleType, string> = {
  PERMANENT:
    "Hozir mos kelganlarga tayinlanadi va keyin ham avtomatik ishlaydi: yangi kelgan yoki shu bo'lim/lavozimga o'tgan xodimga darhol tayinlanadi.",
  ONE_TIME: "Faqat hozir mos kelgan xodimlarga bir marta tayinlanadi. Keyin qo'shilganlarga tayinlanmaydi.",
};

type DueMode = 'none' | 'date' | 'days';

export default function NewRulePage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-400">Yuklanmoqda...</p>}>
      <NewRule />
    </Suspense>
  );
}

function NewRule() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [materials, setMaterials] = useState<AssignableMaterial[] | null>(null);
  const [options, setOptions] = useState<AudienceOptions | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<RuleType>('PERMANENT');
  const [materialId, setMaterialId] = useState(searchParams.get('materialId') ?? '');
  const [allOrganization, setAllOrganization] = useState(false);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [positionIds, setPositionIds] = useState<string[]>([]);
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [onlyNewHires, setOnlyNewHires] = useState(false);
  const [hiredWithinDays, setHiredWithinDays] = useState(30);
  const [reason, setReason] = useState<AssignmentReason>('ONBOARDING');
  const [reasonText, setReasonText] = useState('');
  const [dueMode, setDueMode] = useState<DueMode>('days');
  const [dueDate, setDueDate] = useState('');
  const [dueInDays, setDueInDays] = useState(14);
  const [checkHistory, setCheckHistory] = useState(true);
  const [historyDays, setHistoryDays] = useState(365);
  const [cancelOutOfScope, setCancelOutOfScope] = useState(true);
  const [note, setNote] = useState('');

  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<AssignableMaterial[]>('/learning-admin/materials').then((res) => setMaterials(res.data));
    api.get<AudienceOptions>('/learning-admin/audience-options').then((res) => setOptions(res.data));
  }, []);

  // Doimiy qoidada aniq sana ma'nosiz — "N kun ichida"ga o'tkazamiz
  useEffect(() => {
    if (type === 'PERMANENT' && dueMode === 'date') setDueMode('days');
  }, [type, dueMode]);

  const hasAudience = allOrganization || departmentIds.length > 0 || positionIds.length > 0 || branchIds.length > 0;

  const payload = useMemo(
    () => ({
      name: name.trim() || 'Qoida',
      materialId,
      type,
      allOrganization,
      departmentIds,
      positionIds,
      branchIds,
      hiredWithinDays: onlyNewHires ? hiredWithinDays : null,
      reason,
      reasonText: reason === 'OTHER' ? reasonText : undefined,
      note: note || undefined,
      dueInDays: dueMode === 'days' ? dueInDays : null,
      dueDate: dueMode === 'date' && dueDate ? dueDate : null,
      skipIfCompletedWithinDays: checkHistory ? historyDays : null,
      cancelOutOfScope,
    }),
    [
      name, materialId, type, allOrganization, departmentIds, positionIds, branchIds, onlyNewHires, hiredWithinDays,
      reason, reasonText, note, dueMode, dueInDays, dueDate, checkHistory, historyDays, cancelOutOfScope,
    ],
  );

  useEffect(() => {
    if (!materialId || !hasAudience || (reason === 'OTHER' && !reasonText.trim())) {
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
  }, [payload, materialId, hasAudience, reason, reasonText]);

  function toggle(setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) {
    setter((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/learning-admin/rules', { ...payload, name: name.trim() });
      router.push('/learning-admin/rules');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.response?.data?.error?.issues?.[0]?.message ?? 'Saqlashda xatolik');
      setIsSubmitting(false);
    }
  }

  const canSubmit =
    name.trim().length > 0 &&
    Boolean(materialId) &&
    hasAudience &&
    (reason !== 'OTHER' || reasonText.trim()) &&
    (dueMode !== 'date' || dueDate) &&
    !isPreviewing;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/learning-admin/rules" className="text-sm text-stone-500 hover:text-accent">
        ← Qoidalar ro&apos;yxati
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <Section step={1} title="Qoida">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">Nomi</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masalan: Yangi xodimlar — axborot xavfsizligi"
                className={FIELD_CLASS}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {(['PERMANENT', 'ONE_TIME'] as RuleType[]).map((t) => (
                <label
                  key={t}
                  className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition ${
                    type === t ? 'border-accent bg-accent/5' : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <span className="flex items-center gap-2 font-semibold text-stone-800">
                    <input type="radio" checked={type === t} onChange={() => setType(t)} />
                    {RULE_TYPE_LABEL[t]}
                  </span>
                  <span className="text-xs text-stone-500">{RULE_TYPE_HINT[t]}</span>
                </label>
              ))}
            </div>
          </Section>

          <Section step={2} title="Material">
            <MaterialPicker materials={materials} value={materialId} onChange={setMaterialId} />
          </Section>

          <Section step={3} title="Kimga">
            {options === null ? (
              <p className="text-sm text-stone-400">Yuklanmoqda...</p>
            ) : (
              <>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 text-sm">
                  <input type="checkbox" checked={allOrganization} onChange={(e) => setAllOrganization(e.target.checked)} />
                  <span className="font-medium text-stone-800">Butun tashkilot</span>
                </label>
                {!allOrganization && (
                  <div className="grid gap-3 md:grid-cols-3">
                    <OptionList
                      title="Bo'limlar"
                      items={options.departments}
                      selected={departmentIds}
                      onToggle={(id) => toggle(setDepartmentIds, id)}
                    />
                    <OptionList
                      title="Lavozimlar"
                      items={options.positions}
                      selected={positionIds}
                      onToggle={(id) => toggle(setPositionIds, id)}
                    />
                    <OptionList
                      title="Filiallar"
                      items={options.branches}
                      selected={branchIds}
                      onToggle={(id) => toggle(setBranchIds, id)}
                    />
                  </div>
                )}
                <label className="flex flex-wrap items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" checked={onlyNewHires} onChange={(e) => setOnlyNewHires(e.target.checked)} />
                  Faqat ishga kirganiga
                  <input
                    type="number"
                    min={1}
                    value={hiredWithinDays}
                    disabled={!onlyNewHires}
                    onChange={(e) => setHiredWithinDays(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-sm disabled:opacity-50"
                  />
                  kundan oshmagan xodimlar
                </label>
                <p className="text-xs text-stone-400">
                  Bir nechta bo&apos;lim/lavozim/filial tanlansa — ularning birortasiga mos xodimlar olinadi.
                </p>
              </>
            )}
          </Section>

          <Section step={4} title="Parametrlar">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-500">Tayinlash sababi</label>
                <select value={reason} onChange={(e) => setReason(e.target.value as AssignmentReason)} className={FIELD_CLASS}>
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {ASSIGNMENT_REASON_LABEL[r]}
                    </option>
                  ))}
                </select>
                {reason === 'OTHER' && (
                  <input
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    placeholder="Sababni yozing"
                    className={`${FIELD_CLASS} mt-2`}
                  />
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-500">Topshirish muddati</label>
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={dueMode === 'days'} onChange={() => setDueMode('days')} />
                    Tayinlangandan keyin
                    <input
                      type="number"
                      min={1}
                      max={730}
                      value={dueInDays}
                      onChange={(e) => setDueInDays(Math.max(1, Number(e.target.value) || 1))}
                      onFocus={() => setDueMode('days')}
                      className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-sm"
                    />
                    kun ichida
                  </label>
                  {type === 'ONE_TIME' && (
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={dueMode === 'date'} onChange={() => setDueMode('date')} />
                      Aniq sana
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => {
                          setDueDate(e.target.value);
                          setDueMode('date');
                        }}
                        className="rounded-lg border border-stone-200 px-2 py-1 text-sm"
                      />
                    </label>
                  )}
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={dueMode === 'none'} onChange={() => setDueMode('none')} />
                    Muddatsiz
                  </label>
                </div>
              </div>
            </div>

            <label className="flex flex-wrap items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={checkHistory} onChange={(e) => setCheckHistory(e.target.checked)} />
              Oxirgi
              <input
                type="number"
                min={1}
                value={historyDays}
                disabled={!checkHistory}
                onChange={(e) => setHistoryDays(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-sm disabled:opacity-50"
              />
              kun ichida o&apos;tganlarga tayinlamaslik
            </label>

            {type === 'PERMANENT' && (
              <label className="flex items-start gap-2 text-sm text-stone-700">
                <input type="checkbox" className="mt-0.5" checked={cancelOutOfScope} onChange={(e) => setCancelOutOfScope(e.target.checked)} />
                <span>
                  Xodim shartdan chiqsa (boshqa bo&apos;limga o&apos;tsa, ishdan ketsa) — tugallanmagan tayinlovi bekor qilinsin
                </span>
              </label>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">Izoh xodim uchun (ixtiyoriy)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={FIELD_CLASS} />
            </div>
          </Section>
        </div>

        <aside className="sticky top-4 flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-5">
          <p className="text-sm font-semibold text-stone-900">Hozir ishga tushsa</p>
          <PreviewSummary
            ready={Boolean(materialId) && hasAudience}
            preview={preview}
            isLoading={isPreviewing}
            emptyHint="Material va auditoriyani tanlang."
          />
          {type === 'PERMANENT' && (
            <p className="text-xs text-stone-400">Keyin shartga mos kelgan yangi xodimlarga ham avtomatik tayinlanadi.</p>
          )}
          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button
            type="button"
            disabled={!canSubmit || isSubmitting}
            onClick={handleSubmit}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {isSubmitting ? 'Saqlanmoqda...' : type === 'PERMANENT' ? 'Qoidani yaratish va yoqish' : 'Qoidani yaratish va bajarish'}
          </button>
          {!name.trim() && <p className="text-xs text-stone-400">Qoida nomini kiriting.</p>}
        </aside>
      </div>
    </div>
  );
}
