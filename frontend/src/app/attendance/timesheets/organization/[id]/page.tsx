'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { TimesheetStatusBadge } from '@/components/attendance/TimesheetStatusBadge';
import { useAuthStore } from '@/store/authStore';
import type { OrganizationTimesheet } from '@/types/attendance';

const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_MANAGER', 'TIMEKEEPER'];

export default function OrganizationTimesheetDetailPage() {
  const params = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const canManage = user ? MANAGE_ROLES.includes(user.role) : false;
  const canApprove = user?.role === 'SUPER_ADMIN';

  const [timesheet, setTimesheet] = useState<OrganizationTimesheet | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionComment, setRejectionComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<OrganizationTimesheet>(`/attendance/timesheets/organization/${params.id}`).then((res) => setTimesheet(res.data));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post(`/attendance/timesheets/organization/${params.id}/submit`);
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
      await api.post(`/attendance/timesheets/organization/${params.id}/decide`, {
        decision,
        rejectionComment: rejectionComment || undefined,
      });
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Attendance</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">
            {timesheet.year}-{String(timesheet.month).padStart(2, '0')} yakuniy tabeli
          </h1>
        </div>
        <TimesheetStatusBadge status={timesheet.status} />
      </div>

      {timesheet.rejectionComment && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">Rad etish sababi: {timesheet.rejectionComment}</p>
      )}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
              <th className="px-4 py-2.5 text-left">Bo&apos;lim tabeli</th>
              <th className="px-4 py-2.5 text-left">Xodimlar soni</th>
              <th className="px-4 py-2.5 text-left">Holat</th>
            </tr>
          </thead>
          <tbody>
            {(timesheet.lines ?? []).map((line) => (
              <tr key={line.departmentTimesheet.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-3">
                  {line.departmentTimesheet.year}-{String(line.departmentTimesheet.month).padStart(2, '0')}
                </td>
                <td className="px-4 py-3">{line.departmentTimesheet.summaryData.length}</td>
                <td className="px-4 py-3">
                  <TimesheetStatusBadge status={line.departmentTimesheet.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {canManage && timesheet.status === 'DRAFT' && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Yuqori rahbarga yuborish
          </button>
        )}

        {canApprove && timesheet.status === 'SUBMITTED' && (
          <>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleDecide('APPROVED')}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Yakuniy tasdiqlash
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
