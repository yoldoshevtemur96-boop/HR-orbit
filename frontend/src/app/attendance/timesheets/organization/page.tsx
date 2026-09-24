'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { TimesheetStatusBadge } from '@/components/attendance/TimesheetStatusBadge';
import { TimesheetGridTable } from '@/components/attendance/TimesheetGridTable';
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

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function periodLabel(y: number, m: number) {
  return `${y}-${String(m).padStart(2, '0')}`;
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

  // Joriy tab filtrlari
  const [incomingDept, setIncomingDept] = useState('');
  const [incomingPeriod, setIncomingPeriod] = useState('');
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

  const incoming = (deptTimesheets ?? []).filter((t) => t.status === 'DEPT_SUBMITTED');
  const approved = (deptTimesheets ?? []).filter((t) => t.status === 'DEPT_APPROVED' && t.year === year && t.month === month);
  const archive = (orgTimesheets ?? []).filter((t) => t.status === 'APPROVED');

  const incomingPeriods = Array.from(new Set(incoming.map((t) => periodLabel(t.year, t.month)))).sort().reverse();
  const filteredIncoming = incoming.filter(
    (t) =>
      (!incomingDept || t.departmentId === incomingDept) &&
      (!incomingPeriod || periodLabel(t.year, t.month) === incomingPeriod),
  );

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

  const tabCounts: Record<TabKey, number | null> = {
    incoming: deptTimesheets === null ? null : incoming.length,
    approved: deptTimesheets === null ? null : approved.length,
    archive: orgTimesheets === null ? null : archive.length,
  };

  async function handleSendToLeadership() {
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
            <FilterBar
              showReset={Boolean(incomingDept || incomingPeriod)}
              onReset={() => {
                setIncomingDept('');
                setIncomingPeriod('');
              }}
            >
              <FilterField label="Bo'lim">
                <select value={incomingDept} onChange={(e) => setIncomingDept(e.target.value)} className={FIELD_CLASS}>
                  <option value="">Barchasi</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Davr">
                <select value={incomingPeriod} onChange={(e) => setIncomingPeriod(e.target.value)} className={FIELD_CLASS}>
                  <option value="">Barchasi</option>
                  {incomingPeriods.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </FilterField>
            </FilterBar>

            <div className="flex flex-col gap-2">
              {deptTimesheets === null ? (
                <p className="text-sm text-stone-400">Yuklanmoqda...</p>
              ) : filteredIncoming.length === 0 ? (
                <p className="text-sm text-stone-400">Tasdiqlash kutayotgan bo&apos;lim tabeli yo&apos;q.</p>
              ) : (
                filteredIncoming.map((t) => (
                  <Link
                    key={t.id}
                    href={`/attendance/timesheets/department/${t.id}`}
                    className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-5 py-4 transition hover:border-stone-300"
                  >
                    <div>
                      <p className="text-base font-semibold text-stone-800">
                        {departmentNameById.get(t.departmentId) ?? t.departmentId}
                      </p>
                      <p className="text-sm text-stone-400">
                        {periodLabel(t.year, t.month)} · {t.summaryData.length} xodim
                      </p>
                    </div>
                    <TimesheetStatusBadge status={t.status} />
                  </Link>
                ))
              )}
            </div>
          </>
        )}

        {tab === 'approved' && (
          <>
            <p className="text-sm text-stone-500">
              {periodLabel(year, month)} · departament rahbarlari tomonidan tasdiqlangan bo&apos;lim tabellari
            </p>

            {deptTimesheets === null ? (
              <p className="text-sm text-stone-400">Yuklanmoqda...</p>
            ) : approved.length === 0 ? (
              <p className="text-sm text-stone-400">Hali tasdiqlangan bo&apos;lim tabeli yo&apos;q.</p>
            ) : (
              <>
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
                          {departmentNameById.get(t.departmentId) ?? t.departmentId} · {t.summaryData.length} xodim
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

                <p className="text-sm text-stone-500">{combinedRows.length} xodim ko&apos;rsatilmoqda</p>

                {combinedRows.length === 0 ? (
                  <p className="text-sm text-stone-400">Filtr bo&apos;yicha xodim topilmadi.</p>
                ) : (
                  <TimesheetGridTable rows={combinedRows} daysInMonth={daysInMonth} isApproved />
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
    </div>
  );
}
