import Link from 'next/link';
import { TimesheetStatusBadge } from './TimesheetStatusBadge';
import type { DepartmentTimesheet } from '@/types/attendance';

interface DepartmentTimesheetCardProps {
  timesheet: DepartmentTimesheet;
  departmentName: string;
}

export function DepartmentTimesheetCard({ timesheet, departmentName }: DepartmentTimesheetCardProps) {
  return (
    <Link
      href={`/attendance/timesheets/department/${timesheet.id}`}
      className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3 transition hover:border-stone-300"
    >
      <div>
        <p className="text-sm font-semibold text-stone-800">{departmentName}</p>
        <p className="text-xs text-stone-400">
          {timesheet.year}-{String(timesheet.month).padStart(2, '0')} · {timesheet.summaryData.length} xodim
        </p>
      </div>
      <TimesheetStatusBadge status={timesheet.status} />
    </Link>
  );
}
