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

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
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

  const combinedRows = approved.flatMap((t) => t.summaryData);
  const daysInMonth = new Date(year, month, 0).getDate();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Attendance</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Tashkilot tabeli</h1>
      </div>

      <nav className="flex gap-1 border-b border-stone-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key
                ? 'border-accent text-accent'
                : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {tab === 'incoming' && (
        <div className="flex flex-col gap-2">
          {deptTimesheets === null ? (
            <p className="text-sm text-stone-400">Yuklanmoqda...</p>
          ) : incoming.length === 0 ? (
            <p className="text-sm text-stone-400">Tasdiqlash kutayotgan bo&apos;lim tabeli yo&apos;q.</p>
          ) : (
            incoming.map((t) => (
              <Link
                key={t.id}
                href={`/attendance/timesheets/department/${t.id}`}
                className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3 transition hover:border-stone-300"
              >
                <div>
                  <p className="text-sm font-semibold text-stone-800">
                    {departmentNameById.get(t.departmentId) ?? t.departmentId}
                  </p>
                  <p className="text-xs text-stone-400">
                    {t.year}-{String(t.month).padStart(2, '0')} · {t.summaryData.length} xodim
                  </p>
                </div>
                <TimesheetStatusBadge status={t.status} />
              </Link>
            ))
          )}
        </div>
      )}

      {tab === 'approved' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-stone-500">
            {year}-{String(month).padStart(2, '0')} · departament rahbarlari tomonidan tasdiqlangan bo&apos;lim tabellari
          </p>

          {deptTimesheets === null ? (
            <p className="text-sm text-stone-400">Yuklanmoqda...</p>
          ) : approved.length === 0 ? (
            <p className="text-sm text-stone-400">Hali tasdiqlangan bo&apos;lim tabeli yo&apos;q.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {approved.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600"
                  >
                    {departmentNameById.get(t.departmentId) ?? t.departmentId} · {t.summaryData.length} xodim
                  </span>
                ))}
              </div>

              <TimesheetGridTable rows={combinedRows} daysInMonth={daysInMonth} isApproved />

              {canManage && (
                <div>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSendToLeadership}
                    className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Yuborilmoqda...' : 'Rahbariyatga tasdiqlatish'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'archive' && (
        <div className="flex flex-col gap-2">
          {orgTimesheets === null ? (
            <p className="text-sm text-stone-400">Yuklanmoqda...</p>
          ) : archive.length === 0 ? (
            <p className="text-sm text-stone-400">Hali yakuniy tasdiqlangan tabel yo&apos;q.</p>
          ) : (
            archive.map((t) => (
              <Link
                key={t.id}
                href={`/attendance/timesheets/organization/${t.id}`}
                className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3 transition hover:border-stone-300"
              >
                <p className="text-sm font-semibold text-stone-800">
                  {t.year}-{String(t.month).padStart(2, '0')}
                </p>
                <TimesheetStatusBadge status={t.status} />
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
