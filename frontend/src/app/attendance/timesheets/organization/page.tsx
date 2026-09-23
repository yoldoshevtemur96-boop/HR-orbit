'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { TimesheetStatusBadge } from '@/components/attendance/TimesheetStatusBadge';
import { useAuthStore } from '@/store/authStore';
import type { OrganizationTimesheet } from '@/types/attendance';

const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_MANAGER', 'TIMEKEEPER'];

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function OrganizationTimesheetListPage() {
  const user = useAuthStore((s) => s.user);
  const canConsolidate = user ? MANAGE_ROLES.includes(user.role) : false;

  const [timesheets, setTimesheets] = useState<OrganizationTimesheet[] | null>(null);
  const [{ year, month }, setYearMonth] = useState(currentYearMonth());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<OrganizationTimesheet[]>('/attendance/timesheets/organization').then((res) => setTimesheets(res.data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConsolidate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/attendance/timesheets/organization/consolidate', { year, month });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Konsolidatsiyada xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Attendance</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Tashkilot tabeli</h1>
      </div>

      {canConsolidate && (
        <form onSubmit={handleConsolidate} className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Yil</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYearMonth((s) => ({ ...s, year: Number(e.target.value) }))}
              className="w-24 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Oy</label>
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setYearMonth((s) => ({ ...s, month: Number(e.target.value) }))}
              className="w-20 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Konsolidatsiya qilinmoqda...' : "Bo'limlarni konsolidatsiya qilish"}
          </button>
          {error && <p className="w-full text-sm text-rose-700">{error}</p>}
        </form>
      )}

      <div className="flex flex-col gap-2">
        {timesheets === null ? (
          <p className="text-sm text-stone-400">Yuklanmoqda...</p>
        ) : timesheets.length === 0 ? (
          <p className="text-sm text-stone-400">Hali tabel yaratilmagan.</p>
        ) : (
          timesheets.map((t) => (
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
    </div>
  );
}
