'use client';

import { AttendanceDayStatusBadge } from './AttendanceDayStatusBadge';
import type { AttendanceRecord } from '@/types/attendance';

interface MonthlyCalendarViewProps {
  year: number;
  month: number; // 1-12
  records: AttendanceRecord[];
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Oddiy ro'yxat ko'rinishi (haqiqiy kalendar to'ri emas) — xodim shaxsiy
// davomat tarixini kun bo'yicha ko'radi.
export function MonthlyCalendarView({ year, month, records }: MonthlyCalendarViewProps) {
  const recordByDate = new Map(records.map((r) => [r.date.slice(0, 10), r]));
  const daysInMonth = new Date(year, month, 0).getDate();

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { day, dateStr, record: recordByDate.get(dateStr) ?? null };
  });

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
            <th className="px-4 py-2.5 text-left">Sana</th>
            <th className="px-4 py-2.5 text-left">Kirish</th>
            <th className="px-4 py-2.5 text-left">Chiqish</th>
            <th className="px-4 py-2.5 text-left">Holat</th>
            <th className="px-4 py-2.5 text-left">Kechikish</th>
            <th className="px-4 py-2.5 text-left">Overtime</th>
          </tr>
        </thead>
        <tbody>
          {days.map(({ day, dateStr, record }) => (
            <tr key={dateStr} className="border-b border-stone-100 last:border-0">
              <td className="px-4 py-2.5 text-stone-700">{dateStr}</td>
              <td className="px-4 py-2.5">{formatTime(record?.checkInTime ?? null)}</td>
              <td className="px-4 py-2.5">{formatTime(record?.checkOutTime ?? null)}</td>
              <td className="px-4 py-2.5">
                <AttendanceDayStatusBadge status={record?.status ?? 'ABSENT'} />
              </td>
              <td className="px-4 py-2.5 text-stone-500">{record ? `${record.lateMinutes} daq` : '—'}</td>
              <td className="px-4 py-2.5 text-stone-500">{record ? `${record.overtimeMinutes} daq` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
