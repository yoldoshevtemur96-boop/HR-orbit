'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { TimesheetStatusBadge } from '@/components/attendance/TimesheetStatusBadge';
import { TimesheetGridTable } from '@/components/attendance/TimesheetGridTable';
import { useAuthStore } from '@/store/authStore';
import type { DepartmentTimesheet } from '@/types/attendance';

const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_MANAGER', 'TIMEKEEPER'];

export default function DepartmentTimesheetDetailPage() {
  const params = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const canManage = user ? MANAGE_ROLES.includes(user.role) : false;
  // DEPARTMENT_HEAD generate+submit qiladi, lekin decide (tasdiqlash) endi
  // faqat HR/Timekeeper'da — aks holda DEPARTMENT_HEAD o'z-o'ziga
  // tasdiqlagan bo'lib qolardi.
  const canSubmit = canManage || user?.role === 'DEPARTMENT_HEAD';
  const canDecide = canManage;

  const [timesheet, setTimesheet] = useState<DepartmentTimesheet | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionComment, setRejectionComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<DepartmentTimesheet>(`/attendance/timesheets/department/${params.id}`).then((res) => setTimesheet(res.data));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post(`/attendance/timesheets/department/${params.id}/submit`);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Yuborishda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDecide(decision: 'APPROVED' | 'REJECTED') {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post(`/attendance/timesheets/department/${params.id}/decide`, { decision, rejectionComment: rejectionComment || undefined });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Amalda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!timesheet) {
    return <p className="text-sm text-stone-400">Yuklanmoqda...</p>;
  }

  const daysInMonth = new Date(timesheet.year, timesheet.month, 0).getDate();
  const isApproved = timesheet.status === 'DEPT_APPROVED' || timesheet.status === 'CONSOLIDATED';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Attendance</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">
            {timesheet.year}-{String(timesheet.month).padStart(2, '0')} tabeli
          </h1>
        </div>
        <TimesheetStatusBadge status={timesheet.status} />
      </div>

      {timesheet.hrOverride && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Rahbar yubormasdan HR tomonidan tasdiqlangan. Sabab: {timesheet.hrOverrideReason ?? '—'}
        </p>
      )}
      {timesheet.rejectionComment && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">Rad etish sababi: {timesheet.rejectionComment}</p>
      )}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <TimesheetGridTable rows={timesheet.summaryData} daysInMonth={daysInMonth} isApproved={isApproved} />

      <div className="flex flex-wrap items-center gap-3">
        {canSubmit && timesheet.status === 'DRAFT' && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            HR&apos;ga yuborish
          </button>
        )}

        {canDecide && timesheet.status === 'DEPT_SUBMITTED' && (
          <>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleDecide('APPROVED')}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Tasdiqlash
            </button>
            <input
              type="text"
              value={rejectionComment}
              onChange={(e) => setRejectionComment(e.target.value)}
              placeholder="Rad etish sababi (ixtiyoriy)"
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleDecide('REJECTED')}
              className="rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
            >
              Rad etish
            </button>
          </>
        )}
      </div>
    </div>
  );
}
