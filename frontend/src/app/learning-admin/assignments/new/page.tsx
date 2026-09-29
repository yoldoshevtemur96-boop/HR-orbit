'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { FIELD_CLASS, MaterialPicker, OptionList, PreviewSummary, Section } from '@/components/learning-admin/formParts';
import {
  ASSIGNMENT_REASON_LABEL,
  type AssignableMaterial,
  type AssignmentPreview,
  type AssignmentReason,
  type Audience,
  type AudienceOptions,
} from '@/types/learningAdmin';

const REASONS: AssignmentReason[] = ['LEGAL', 'POSITION', 'ONBOARDING', 'DEVELOPMENT', 'OTHER'];

const EMPTY_AUDIENCE: Audience = { allOrganization: false, departmentIds: [], positionIds: [], branchIds: [], employeeIds: [] };

type DueMode = 'none' | 'date' | 'days';

export default function NewAssignmentPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-400">Yuklanmoqda...</p>}>
      <NewAssignment />
    </Suspense>
  );
}

function NewAssignment() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [materials, setMaterials] = useState<AssignableMaterial[] | null>(null);
  const [options, setOptions] = useState<AudienceOptions | null>(null);

  const [materialId, setMaterialId] = useState(searchParams.get('materialId') ?? '');
  const [audience, setAudience] = useState<Audience>(EMPTY_AUDIENCE);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [reason, setReason] = useState<AssignmentReason>('DEVELOPMENT');
  const [reasonText, setReasonText] = useState('');
  const [dueMode, setDueMode] = useState<DueMode>('days');
  const [dueDate, setDueDate] = useState('');
  const [dueInDays, setDueInDays] = useState(30);
  const [checkHistory, setCheckHistory] = useState(true);
  const [historyDays, setHistoryDays] = useState(365);
  const [note, setNote] = useState('');

  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<AssignableMaterial[]>('/learning-admin/materials').then((res) => setMaterials(res.data));
    api.get<AudienceOptions>('/learning-admin/audience-options').then((res) => setOptions(res.data));
  }, []);

  const hasAudience =
    audience.allOrganization ||
    audience.departmentIds.length > 0 ||
    audience.positionIds.length > 0 ||
    audience.branchIds.length > 0 ||
    audience.employeeIds.length > 0;

  const payload = useMemo(
    () => ({
      materialId,
      audience,
      reason,
      reasonText: reason === 'OTHER' ? reasonText : undefined,
      note: note || undefined,
      dueDate: dueMode === 'date' && dueDate ? dueDate : undefined,
      dueInDays: dueMode === 'days' ? dueInDays : undefined,
      skipIfCompletedWithinDays: checkHistory ? historyDays : undefined,
    }),
    [materialId, audience, reason, reasonText, note, dueMode, dueDate, dueInDays, checkHistory, historyDays],
  );

  // Material va auditoriya tanlanganda — kimga tushishini jonli hisoblaymiz
  useEffect(() => {
    if (!materialId || !hasAudience) {
      setPreview(null);
      return;
    }
    setIsPreviewing(true);
    const timer = setTimeout(() => {
      api
        .post<AssignmentPreview>('/learning-admin/assignments/preview', payload)
        .then((res) => setPreview(res.data))
        .catch(() => setPreview(null))
        .finally(() => setIsPreviewing(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [payload, materialId, hasAudience]);

  function toggle(key: 'departmentIds' | 'positionIds' | 'branchIds' | 'employeeIds', id: string) {
    setAudience((a) => ({
      ...a,
      [key]: a[key].includes(id) ? a[key].filter((x) => x !== id) : [...a[key], id],
    }));
  }

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/learning-admin/assignments', payload);
      router.push(`/learning-admin/assignments`);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.response?.data?.error?.issues?.[0]?.message ?? 'Tayinlashda xatolik');
      setIsSubmitting(false);
    }
  }

  const es = employeeSearch.trim().toLowerCase();
  const visibleEmployees = (options?.employees ?? []).filter(
    (e) => !es || e.fullName.toLowerCase().includes(es) || e.employeeCode.toLowerCase().includes(es),
  );

  const canSubmit =
    Boolean(materialId) &&
    hasAudience &&
    (reason !== 'OTHER' || reasonText.trim()) &&
    (dueMode !== 'date' || dueDate) &&
    (preview?.toAssignCount ?? 0) > 0 &&
    !isPreviewing;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/learning-admin/assignments" className="text-sm text-stone-500 hover:text-accent">
        ← Tayinlovlar ro&apos;yxati
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          {/* 1. Material */}
          <Section step={1} title="Material">
            <MaterialPicker materials={materials} value={materialId} onChange={setMaterialId} />
          </Section>

          {/* 2. Kimga */}
          <Section step={2} title="Kimga">
            {options === null ? (
              <p className="text-sm text-stone-400">Yuklanmoqda...</p>
            ) : (
              <>
                {options.canAssignWholeOrganization && (
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={audience.allOrganization}
                      onChange={(e) => setAudience((a) => ({ ...a, allOrganization: e.target.checked }))}
                    />
                    <span className="font-medium text-stone-800">Butun tashkilot</span>
                    <span className="text-stone-400">({options.employees.length} xodim)</span>
                  </label>
                )}
                {!audience.allOrganization && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <OptionList
                      title="Bo'limlar"
                      items={options.departments}
                      selected={audience.departmentIds}
                      onToggle={(id) => toggle('departmentIds', id)}
                    />
                    <OptionList
                      title="Lavozimlar"
                      items={options.positions}
                      selected={audience.positionIds}
                      onToggle={(id) => toggle('positionIds', id)}
                    />
                    {options.branches.length > 0 && (
                      <OptionList
                        title="Filiallar"
                        items={options.branches}
                        selected={audience.branchIds}
                        onToggle={(id) => toggle('branchIds', id)}
                      />
                    )}
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium text-stone-500">
                        Aniq xodimlar {audience.employeeIds.length > 0 && `(${audience.employeeIds.length})`}
                      </p>
                      <input
                        type="search"
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        placeholder="F.I.Sh. yoki tabel raqami"
                        className={FIELD_CLASS}
                      />
                      <div className="max-h-44 overflow-y-auto rounded-lg border border-stone-200">
                        {visibleEmployees.slice(0, 200).map((e) => (
                          <label
                            key={e.id}
                            className="flex cursor-pointer items-center gap-2 border-b border-stone-100 px-3 py-1.5 text-sm last:border-0 hover:bg-stone-50"
                          >
                            <input
                              type="checkbox"
                              checked={audience.employeeIds.includes(e.id)}
                              onChange={() => toggle('employeeIds', e.id)}
                            />
                            <span className="flex-1 truncate text-stone-700">{e.fullName}</span>
                            <span className="text-xs text-stone-400">{e.employeeCode}</span>
                          </label>
                        ))}
                        {visibleEmployees.length === 0 && <p className="px-3 py-2 text-sm text-stone-400">Topilmadi</p>}
                      </div>
                    </div>
                  </div>
                )}
                <p className="text-xs text-stone-400">Bir nechta mezon tanlansa — ularning birortasiga mos xodimlar olinadi.</p>
              </>
            )}
          </Section>

          {/* 3. Parametrlar */}
          <Section step={3} title="Parametrlar">
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
              kun ichida o&apos;tganlarga qayta tayinlamaslik
            </label>
            <p className="-mt-2 text-xs text-stone-400">
              Faol tayinlovi bor xodimlar doim o&apos;tkazib yuboriladi. Avval o&apos;tgan xodimga qayta tayinlansa, progress noldan
              boshlanadi.
            </p>

            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">Izoh xodim uchun (ixtiyoriy)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={FIELD_CLASS} />
            </div>
          </Section>
        </div>

        {/* Natija paneli */}
        <aside className="sticky top-4 flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-5">
          <p className="text-sm font-semibold text-stone-900">Natija</p>
          <PreviewSummary
            ready={Boolean(materialId) && hasAudience}
            preview={preview}
            isLoading={isPreviewing}
            emptyHint="Material va auditoriyani tanlang."
          />

          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <button
            type="button"
            disabled={!canSubmit || isSubmitting}
            onClick={handleSubmit}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {isSubmitting ? 'Tayinlanmoqda...' : 'Tayinlash'}
          </button>
          <p className="text-xs text-stone-400">Xodimlarga bildirishnoma yuboriladi, muddatdan 3 kun oldin eslatiladi.</p>
        </aside>
      </div>
    </div>
  );
}
