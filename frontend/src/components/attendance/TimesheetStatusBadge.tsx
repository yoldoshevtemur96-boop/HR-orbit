import type { DepartmentTimesheetStatus, OrganizationTimesheetStatus } from '@/types/attendance';

type Status = DepartmentTimesheetStatus | OrganizationTimesheetStatus;

const STATUS_STYLES: Record<Status, string> = {
  DRAFT: 'bg-stone-100 text-stone-500',
  DEPT_SUBMITTED: 'bg-amber-50 text-amber-700',
  DEPT_APPROVED: 'bg-emerald-50 text-emerald-700',
  DEPT_REJECTED: 'bg-rose-50 text-rose-700',
  CONSOLIDATED: 'bg-sky-50 text-sky-700',
  SUBMITTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
};

const STATUS_LABEL: Record<Status, string> = {
  DRAFT: 'Qoralama',
  DEPT_SUBMITTED: 'Tasdiq kutilmoqda',
  DEPT_APPROVED: 'Tasdiqlandi',
  DEPT_REJECTED: 'Rad etildi',
  CONSOLIDATED: 'Konsolidatsiya qilindi',
  SUBMITTED: 'Yuborildi',
  APPROVED: 'Yakuniy tasdiqlandi',
  REJECTED: 'Rad etildi',
};

export function TimesheetStatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
