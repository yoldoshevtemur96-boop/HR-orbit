import type { AttendanceDayStatus } from '@/types/attendance';

const STATUS_STYLES: Record<AttendanceDayStatus, string> = {
  PRESENT: 'bg-emerald-50 text-emerald-700',
  LATE: 'bg-amber-50 text-amber-700',
  EARLY_LEAVE: 'bg-amber-50 text-amber-700',
  ABSENT: 'bg-rose-50 text-rose-700',
  ON_LEAVE: 'bg-sky-50 text-sky-700',
  BUSINESS_TRIP: 'bg-violet-50 text-violet-700',
  REMOTE: 'bg-teal-50 text-teal-700',
  SICK: 'bg-orange-50 text-orange-700',
};

const STATUS_LABEL: Record<AttendanceDayStatus, string> = {
  PRESENT: 'Keldi',
  LATE: 'Kechikdi',
  EARLY_LEAVE: 'Erta ketdi',
  ABSENT: 'Kelmadi',
  ON_LEAVE: "Ta'tilda",
  BUSINESS_TRIP: 'Safarda',
  REMOTE: 'Masofaviy',
  SICK: 'Bemor',
};

export function AttendanceDayStatusBadge({ status }: { status: AttendanceDayStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
