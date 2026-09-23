'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AttendanceDayStatusBadge } from '@/components/attendance/AttendanceDayStatusBadge';
import { MonthlyCalendarView } from '@/components/attendance/MonthlyCalendarView';
import type { AttendanceRecord } from '@/types/attendance';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function MyAttendancePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get<AttendanceRecord | null>('/attendance/records/me/today').then((res) => setToday(res.data));
  }, []);

  const loadCalendar = useCallback(() => {
    setIsLoading(true);
    api
      .get<AttendanceRecord[]>('/attendance/records/me/calendar', { params: { year, month } })
      .then((res) => setRecords(res.data))
      .finally(() => setIsLoading(false));
  }, [year, month]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  function shiftMonth(delta: number) {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Attendance</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Mening davomatim</h1>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Bugun</p>
        {today ? (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span>
              Kirish: <span className="font-medium text-stone-800">{formatTime(today.checkInTime)}</span>
            </span>
            <span>
              Chiqish: <span className="font-medium text-stone-800">{formatTime(today.checkOutTime)}</span>
            </span>
            <AttendanceDayStatusBadge status={today.status} />
          </div>
        ) : (
          <p className="text-sm text-stone-400">Bugun uchun hali yozuv yo&apos;q.</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium hover:bg-stone-50"
        >
          ← Oldingi oy
        </button>
        <span className="text-sm font-medium text-stone-700">
          {year}-{String(month).padStart(2, '0')}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium hover:bg-stone-50"
        >
          Keyingi oy →
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : (
        <MonthlyCalendarView year={year} month={month} records={records} />
      )}
    </div>
  );
}
