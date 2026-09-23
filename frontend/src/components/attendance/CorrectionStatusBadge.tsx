import type { CorrectionStatus } from '@/types/attendance';

const STATUS_STYLES: Record<CorrectionStatus, string> = {
  PENDING_MANAGER: 'bg-amber-50 text-amber-700',
  PENDING_TIMEKEEPER: 'bg-amber-50 text-amber-700',
  APPLIED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
};

const STATUS_LABEL: Record<CorrectionStatus, string> = {
  PENDING_MANAGER: 'Rahbar tasdig‘ini kutmoqda',
  PENDING_TIMEKEEPER: 'Tabelchi tasdig‘ini kutmoqda',
  APPLIED: 'Qo‘llanildi',
  REJECTED: 'Rad etildi',
};

export function CorrectionStatusBadge({ status }: { status: CorrectionStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
