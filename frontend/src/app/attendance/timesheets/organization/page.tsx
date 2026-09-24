'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { TimesheetStatusBadge } from '@/components/attendance/TimesheetStatusBadge';
import { TimesheetGridTable } from '@/components/attendance/TimesheetGridTable';
import { Modal } from '@/components/hr/Modal';
import { useAuthStore } from '@/store/authStore';
import type { DepartmentTimesheet, OrganizationTimesheet } from '@/types/attendance';
import type { Department } from '@/types/core-hr';

const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_MANAGER', 'TIMEKEEPER'];

type TabKey = 'incoming' | 'approved' | 'archive';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'incoming', label: 'Joriy' },
  { key: 'approved', label: 'Tasdiqlangan' },
  { key: 'archive', label: 'Arxiv' },
];

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

const FIELD_CLASS =
  'rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15';

// "Joriy" tabidagi bo'lim holati — tabel umuman yaratilmagan bo'lishi
// ham mumkin (departament rahbari sahifasini hali ochmagan).
type IncomingState = 'MISSING' | 'DRAFT' | 'DEPT_REJECTED' | 'DEPT_SUBMITTED';

const INCOMING_STATE_LABEL: Record<IncomingState, string> = {
  MISSING: 'Yaratilmagan',
  DRAFT: 'Yubormagan',
  DEPT_REJECTED: 'Rad etilgan',
  DEPT_SUBMITTED: 'Tasdiq kutmoqda',
};

const INCOMING_STATE_STYLE: Record<IncomingState, string> = {
  MISSING: 'bg-stone-100 text-stone-500',
  DRAFT: 'bg-stone-100 text-stone-600',
  DEPT_REJECTED: 'bg-rose-50 text-rose-700',
  DEPT_SUBMITTED: 'bg-amber-50 text-amber-700',
};

interface IncomingRow {
  departmentId: string;
  year: number;
  month: number;
  state: IncomingState;
  timesheet: DepartmentTimesheet | null;
}

// HR tasdiqlab o'tkazish oynasi — bitta bo'lim yoki bir nechtasi uchun.
interface OverrideTarget {
  rows: IncomingRow[];
}

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function periodLabel(y: number, m: number) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

function canOverride(row: IncomingRow) {
  return row.state !== 'DEPT_SUBMITTED';
}

function FilterBar({ children, onReset, showReset }: { children: React.ReactNode; onReset: () => void; showReset: boolean }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-4">
      {children}
      {showReset && (
        <button type="button" onClick={onReset} className="px-2 py-2 text-sm text-stone-500 hover:text-stone-800">
          Tozalash
        </button>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-stone-500">{label}</label>
      {children}
    </div>
  );
}

export default function OrganizationTimesheetListPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user ? MANAGE_ROLES.includes(user.role) : false;
  const { year, month } = currentYearMonth();

  const [tab, setTab] = useState<TabKey>('incoming');
  const [deptTimesheets, setDeptTimesheets] = useState<DepartmentTimesheet[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [orgTimesheets, setOrgTimesheets] = useState<OrganizationTimesheet[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overrideTarget, setOverrideTarget] = useState<OverrideTarget | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [isOverriding, setIsOverriding] = useState(false);

  // Joriy tab filtrlari
  const [incomingDept, setIncomingDept] = useState('');
  const [incomingState, setIncomingState] = useState<'' | IncomingState>('');
  // Tasdiqlangan tab filtrlari
  const [approvedDept, setApprovedDept] = useState('');
  const [approvedSearch, setApprovedSearch] = useState('');
  // Arxiv tab filtrlari
  const [archiveYear, setArchiveYear] = useState('');
  const [archiveMonth, setArchiveMonth] = useState('');

  const loadDeptTimesheets = useCallback(() => {
    api.get<DepartmentTimesheet[]>('/attendance/timesheets/department', { params: { year } }).then((res) => setDeptTimesheets(res.data));
  }, [year]);

  const loadOrgTimesheets = useCallback(() => {
    api.get<OrganizationTimesheet[]>('/attendance/timesheets/organization').then((res) => setOrgTimesheets(res.data));
  }, []);

  useEffect(() => {
    loadDeptTimesheets();
    loadOrgTimesheets();
    api.get('/hr/departments').then((res) => setDepartments(res.data));
  }, [loadDeptTimesheets, loadOrgTimesheets]);

  const departmentNameById = new Map(departments.map((d) => [d.id, d.name]));
  const activeDepartments = departments.filter((d) => d.status === 'ACTIVE');

  const currentMonthSheets = (deptTimesheets ?? []).filter((t) => t.year === year && t.month === month);
  const currentSheetByDept = new Map(currentMonthSheets.map((t) => [t.departmentId, t]));

  // Joriy oy: hali tasdiqlanmagan har bir faol bo'lim. Oldingi oylardan
  // qolib ketgan, tasdiq kutayotgan tabellar ham ro'yxat oxiriga qo'shiladi.
  const incomingRows: IncomingRow[] = [
    ...activeDepartments.flatMap((d): IncomingRow[] => {
      const t = currentSheetByDept.get(d.id);
      if (!t) return [{ departmentId: d.id, year, month, state: 'MISSING', timesheet: null }];
      if (t.status === 'DEPT_APPROVED' || t.status === 'CONSOLIDATED') return [];
      return [{ departmentId: d.id, year, month, state: t.status, timesheet: t }];
    }),
    ...(deptTimesheets ?? [])
      .filter((t) => t.status === 'DEPT_SUBMITTED' && !(t.year === year && t.month === month))
      .map((t): IncomingRow => ({ departmentId: t.departmentId, year: t.year, month: t.month, state: 'DEPT_SUBMITTED', timesheet: t })),
  ];

  const filteredIncoming = incomingRows.filter(
    (r) => (!incomingDept || r.departmentId === incomingDept) && (!incomingState || r.state === incomingState),
  );
  const overridableFiltered = filteredIncoming.filter(canOverride);

  const approved = currentMonthSheets.filter((t) => t.status === 'DEPT_APPROVED');
  const archive = (orgTimesheets ?? []).filter((t) => t.status === 'APPROVED');

  const submittedCount = incomingRows.filter((r) => r.state === 'DEPT_SUBMITTED' && r.year === year && r.month === month).length;
  const notSubmittedCount = incomingRows.filter(canOverride).length;
  const missingFromApproved = activeDepartments.filter((d) => currentSheetByDept.get(d.id)?.status !== 'DEPT_APPROVED');

  const search = approvedSearch.trim().toLowerCase();
  const combinedRows = approved
    .filter((t) => !approvedDept || t.departmentId === approvedDept)
    .flatMap((t) => t.summaryData)
    .filter(
      (r) =>
        !search ||
        r.fullName.toLowerCase().includes(search) ||
        r.employeeCode.toLowerCase().includes(search) ||
        (r.positionName ?? '').toLowerCase().includes(search),
    );

  const archiveYears = Array.from(new Set(archive.map((t) => t.year))).sort((a, b) => b - a);
  const filteredArchive = archive
    .filter((t) => (!archiveYear || t.year === Number(archiveYear)) && (!archiveMonth || t.month === Number(archiveMonth)))
    .sort((a, b) => b.year - a.year || b.month - a.month);

  const isDeptDataLoading = deptTimesheets === null;
  const tabCounts: Record<TabKey, number | null> = {
    incoming: isDeptDataLoading ? null : incomingRows.length,
    approved: isDeptDataLoading ? null : approved.length,
    archive: orgTimesheets === null ? null : archive.length,
  };

  function openOverride(rows: IncomingRow[]) {
    setOverrideTarget({ rows });
    setOverrideReason('');
    setOverrideError(null);
  }

  async function handleOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!overrideTarget) return;
    const reason = overrideReason.trim();
    if (!reason) {
      setOverrideError('Sabab majburiy');
      return;
    }
    setOverrideError(null);
    setIsOverriding(true);
    const failed: string[] = [];
    const failedRows: IncomingRow[] = [];
    for (const row of overrideTarget.rows) {
      try {
        await api.post('/attendance/timesheets/department/hr-approve', {
          departmentId: row.departmentId,
          year: row.year,
          month: row.month,
          reason,
        });
      } catch (err: any) {
        const name = departmentNameById.get(row.departmentId) ?? row.departmentId;
        failed.push(`${name}: ${err?.response?.data?.error?.message ?? 'xatolik'}`);
        failedRows.push(row);
      }
    }
    setIsOverriding(false);
    loadDeptTimesheets();
    if (failedRows.length > 0) {
      setOverrideTarget({ rows: failedRows });
      setOverrideError(failed.join('\n'));
    } else {
      setOverrideTarget(null);
    }
  }

  async function handleEditCell(employeeId: string, day: number, hours: number, comment: string) {
    await api.put('/attendance/timesheets/cells', {
      employeeId,
      date: `${periodLabel(year, month)}-${String(day).padStart(2, '0')}`,
      hours,
      comment,
    });
    loadDeptTimesheets();
  }

  async function handleSendToLeadership() {
    if (missingFromApproved.length > 0) {
      const names = missingFromApproved.map((d) => d.name).join(', ');
      const ok = window.confirm(
        `${missingFromApproved.length} ta bo'lim tabelga kirmaydi (tasdiqlanmagan): ${names}.\n\nBaribir rahbariyatga yuborilsinmi?`,
      );
      if (!ok) return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await api.post<OrganizationTimesheet>('/attendance/timesheets/organization/consolidate', { year, month });
      await api.post(`/attendance/timesheets/organization/${res.data.id}/submit`);
      loadDeptTimesheets();
      loadOrgTimesheets();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Yuborishda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Attendance</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Tashkilot tabeli</h1>
      </div>

      <nav className="grid grid-cols-3 gap-3">
        {TABS.map((t) => {
          const active = tab === t.key;
          const count = tabCounts[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center justify-between rounded-xl border-2 px-5 py-4 text-left transition ${
                active
                  ? 'border-accent bg-accent/5 text-accent'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900'
              }`}
            >
              <span className="text-base font-semibold">{t.label}</span>
              <span
                className={`min-w-[2rem] rounded-full px-2.5 py-0.5 text-center text-sm font-semibold ${
                  active ? 'bg-accent text-white' : 'bg-stone-100 text-stone-500'
                }`}
              >
                {count ?? '…'}
              </span>
            </button>
          );
        })}
      </nav>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <section className="flex min-h-[60vh] flex-col gap-4 rounded-xl border border-stone-200 bg-stone-50/50 p-5">
        {tab === 'incoming' && (
          <>
            {!isDeptDataLoading && (
              <p className="text-sm text-stone-500">
                {periodLabel(year, month)} · jami {activeDepartments.length} bo&apos;lim:{' '}
                <span className="font-medium text-emerald-700">{approved.length} tasdiqlangan</span>,{' '}
                <span className="font-medium text-amber-700">{submittedCount} tasdiq kutmoqda</span>,{' '}
                <span className="font-medium text-stone-700">{notSubmittedCount} yubormagan</span>
              </p>
            )}

            <FilterBar
              showReset={Boolean(incomingDept || incomingState)}
              onReset={() => {
                setIncomingDept('');
                setIncomingState('');
              }}
            >
              <FilterField label="Bo'lim">
                <select value={incomingDept} onChange={(e) => setIncomingDept(e.target.value)} className={FIELD_CLASS}>
                  <option value="">Barchasi</option>
                  {activeDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Holat">
                <select
                  value={incomingState}
                  onChange={(e) => setIncomingState(e.target.value as '' | IncomingState)}
                  className={FIELD_CLASS}
                >
                  <option value="">Barchasi</option>
                  {(Object.keys(INCOMING_STATE_LABEL) as IncomingState[]).map((s) => (
                    <option key={s} value={s}>
                      {INCOMING_STATE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </FilterField>
              {canManage && overridableFiltered.length > 1 && (
                <button
                  type="button"
                  onClick={() => openOverride(overridableFiltered)}
                  className="ml-auto rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/5"
                >
                  Barchasini tasdiqlash ({overridableFiltered.length})
                </button>
              )}
            </FilterBar>

            <div className="flex flex-col gap-2">
              {isDeptDataLoading ? (
                <p className="text-sm text-stone-400">Yuklanmoqda...</p>
              ) : filteredIncoming.length === 0 ? (
                <p className="text-sm text-stone-400">Tasdiqlanmagan bo&apos;lim tabeli yo&apos;q.</p>
              ) : (
                filteredIncoming.map((r) => {
                  const name = departmentNameById.get(r.departmentId) ?? r.departmentId;
                  return (
                    <div
                      key={`${r.departmentId}-${r.year}-${r.month}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-5 py-4"
                    >
                      <div>
                        {r.timesheet ? (
                          <Link
                            href={`/attendance/timesheets/department/${r.timesheet.id}`}
                            className="text-base font-semibold text-stone-800 hover:text-accent"
                          >
                            {name}
                          </Link>
                        ) : (
                          <p className="text-base font-semibold text-stone-800">{name}</p>
                        )}
                        <p className="text-sm text-stone-400">
                          {periodLabel(r.year, r.month)}
                          {r.timesheet ? ` · ${r.timesheet.summaryData.length} xodim` : ' · rahbar tabelni hali ochmagan'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${INCOMING_STATE_STYLE[r.state]}`}>
                          {INCOMING_STATE_LABEL[r.state]}
                        </span>
                        {canManage && canOverride(r) && (
                          <button
                            type="button"
                            onClick={() => openOverride([r])}
                            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                          >
                            Tasdiqlab o&apos;tkazish
                          </button>
                        )}
                        {r.state === 'DEPT_SUBMITTED' && r.timesheet && (
                          <Link
                            href={`/attendance/timesheets/department/${r.timesheet.id}`}
                            className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300"
                          >
                            Ko&apos;rib chiqish
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {tab === 'approved' && (
          <>
            <p className="text-sm text-stone-500">
              {periodLabel(year, month)} · tasdiqlangan bo&apos;lim tabellari
            </p>

            {isDeptDataLoading ? (
              <p className="text-sm text-stone-400">Yuklanmoqda...</p>
            ) : approved.length === 0 ? (
              <p className="text-sm text-stone-400">Hali tasdiqlangan bo&apos;lim tabeli yo&apos;q.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {approved.map((t) => (
                    <span
                      key={t.id}
                      title={t.hrOverride ? `HR tasdiqlab o'tkazgan. Sabab: ${t.hrOverrideReason ?? '—'}` : undefined}
                      className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600"
                    >
                      {departmentNameById.get(t.departmentId) ?? t.departmentId} · {t.summaryData.length} xodim
                      {t.hrOverride && <span className="ml-1.5 rounded bg-amber-50 px-1.5 text-amber-700">HR</span>}
                    </span>
                  ))}
                </div>

                <FilterBar
                  showReset={Boolean(approvedDept || approvedSearch)}
                  onReset={() => {
                    setApprovedDept('');
                    setApprovedSearch('');
                  }}
                >
                  <FilterField label="Bo'lim">
                    <select value={approvedDept} onChange={(e) => setApprovedDept(e.target.value)} className={FIELD_CLASS}>
                      <option value="">Barchasi</option>
                      {approved.map((t) => (
                        <option key={t.id} value={t.departmentId}>
                          {departmentNameById.get(t.departmentId) ?? t.departmentId}
                        </option>
                      ))}
                    </select>
                  </FilterField>
                  <FilterField label="Xodim">
                    <input
                      type="search"
                      value={approvedSearch}
                      onChange={(e) => setApprovedSearch(e.target.value)}
                      placeholder="F.I.Sh., tabel raqami yoki lavozim"
                      className={`${FIELD_CLASS} w-72`}
                    />
                  </FilterField>
                </FilterBar>

                <p className="text-sm text-stone-500">
                  {combinedRows.length} xodim ko&apos;rsatilmoqda
                  {canManage && ' · katakni bosib ishlagan soatni (1–8) va izohni o\'zgartirish mumkin, o\'zgartirilganlar qizil rangda'}
                </p>

                {combinedRows.length === 0 ? (
                  <p className="text-sm text-stone-400">Filtr bo&apos;yicha xodim topilmadi.</p>
                ) : (
                  <TimesheetGridTable
                    rows={combinedRows}
                    daysInMonth={daysInMonth}
                    isApproved
                    onEditCell={canManage ? handleEditCell : undefined}
                  />
                )}

                {canManage && (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleSendToLeadership}
                      className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Yuborilmoqda...' : 'Rahbariyatga tasdiqlatish'}
                    </button>
                    {missingFromApproved.length > 0 && (
                      <p className="text-xs text-amber-700">
                        {missingFromApproved.length} ta bo&apos;lim hali tasdiqlanmagan — ular tabelga kirmaydi.
                      </p>
                    )}
                    {(approvedDept || approvedSearch) && (
                      <p className="text-xs text-stone-400">
                        Filtrdan qat&apos;i nazar barcha tasdiqlangan bo&apos;limlar yuboriladi.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'archive' && (
          <>
            <FilterBar
              showReset={Boolean(archiveYear || archiveMonth)}
              onReset={() => {
                setArchiveYear('');
                setArchiveMonth('');
              }}
            >
              <FilterField label="Yil">
                <select value={archiveYear} onChange={(e) => setArchiveYear(e.target.value)} className={FIELD_CLASS}>
                  <option value="">Barchasi</option>
                  {archiveYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Oy">
                <select value={archiveMonth} onChange={(e) => setArchiveMonth(e.target.value)} className={FIELD_CLASS}>
                  <option value="">Barchasi</option>
                  {MONTH_NAMES.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </FilterField>
            </FilterBar>

            <div className="flex flex-col gap-2">
              {orgTimesheets === null ? (
                <p className="text-sm text-stone-400">Yuklanmoqda...</p>
              ) : filteredArchive.length === 0 ? (
                <p className="text-sm text-stone-400">Hali yakuniy tasdiqlangan tabel yo&apos;q.</p>
              ) : (
                filteredArchive.map((t) => (
                  <Link
                    key={t.id}
                    href={`/attendance/timesheets/organization/${t.id}`}
                    className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-5 py-4 transition hover:border-stone-300"
                  >
                    <div>
                      <p className="text-base font-semibold text-stone-800">
                        {MONTH_NAMES[t.month - 1]} {t.year}
                      </p>
                      <p className="text-sm text-stone-400">{periodLabel(t.year, t.month)}</p>
                    </div>
                    <TimesheetStatusBadge status={t.status} />
                  </Link>
                ))
              )}
            </div>
          </>
        )}
      </section>

      <Modal
        isOpen={overrideTarget !== null}
        title="Tasdiqlab o'tkazish"
        onClose={() => !isOverriding && setOverrideTarget(null)}
      >
        {overrideTarget && (
          <form onSubmit={handleOverride} className="flex flex-col gap-3">
            <p className="text-sm text-stone-600">
              {overrideTarget.rows.length === 1
                ? `${departmentNameById.get(overrideTarget.rows[0].departmentId) ?? ''} bo'limi tabeli`
                : `${overrideTarget.rows.length} ta bo'lim tabeli`}{' '}
              departament rahbari yubormasdan turib tasdiqlanadi. Tabel turniket ma&apos;lumotidan yangidan yig&apos;iladi va rahbar
              uni endi o&apos;zgartira olmaydi.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">Sabab (majburiy)</label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
                placeholder="Masalan: rahbar ta'tilda, muddat o'tdi"
                className={`${FIELD_CLASS} w-full`}
                autoFocus
              />
            </div>
            {overrideError && (
              <p className="whitespace-pre-line rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{overrideError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isOverriding}
                onClick={() => setOverrideTarget(null)}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={isOverriding || !overrideReason.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {isOverriding ? 'Tasdiqlanmoqda...' : 'Tasdiqlash'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
