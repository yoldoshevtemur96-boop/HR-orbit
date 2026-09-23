'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable, type DataTableColumn } from '@/components/hr/DataTable';
import { FilterBar } from '@/components/hr/FilterBar';
import { AttendanceDayStatusBadge } from '@/components/attendance/AttendanceDayStatusBadge';
import { AttendanceRecordEditDrawer } from '@/components/attendance/AttendanceRecordEditDrawer';
import { useAuthStore } from '@/store/authStore';
import type { DailyAttendanceRow } from '@/types/attendance';
import type { Department } from '@/types/core-hr';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function DailyAttendancePage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user ? ['SUPER_ADMIN', 'HR_MANAGER', 'TIMEKEEPER'].includes(user.role) : false;

  const [date, setDate] = useState(todayIso());
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rows, setRows] = useState<DailyAttendanceRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<DailyAttendanceRow | null>(null);

  useEffect(() => {
    if (canManage) {
      api.get('/hr/departments').then((res) => setDepartments(res.data));
    }
  }, [canManage]);

  const load = useCallback(() => {
    setIsLoading(true);
    api
      .get<DailyAttendanceRow[]>('/attendance/records/daily', {
        params: { date, departmentId: departmentId || undefined },
      })
      .then((res) => setRows(res.data))
      .finally(() => setIsLoading(false));
  }, [date, departmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = (rows ?? []).filter((r) =>
    search ? r.employee.fullName.toLowerCase().includes(search.toLowerCase()) : true,
  );

  const columns: DataTableColumn<DailyAttendanceRow>[] = [
    { key: 'employeeCode', header: 'ID', render: (r) => <span className="font-mono text-xs text-stone-500">{r.employee.employeeCode}</span> },
    { key: 'fullName', header: "F.I.Sh.", render: (r) => <span className="font-medium text-stone-800">{r.employee.fullName}</span> },
    { key: 'checkIn', header: 'Kirish', render: (r) => formatTime(r.record?.checkInTime ?? null) },
    { key: 'checkOut', header: 'Chiqish', render: (r) => formatTime(r.record?.checkOutTime ?? null) },
    { key: 'status', header: 'Holat', render: (r) => <AttendanceDayStatusBadge status={r.record?.status ?? 'ABSENT'} /> },
    { key: 'late', header: 'Kechikish (daq)', render: (r) => r.record?.lateMinutes ?? 0 },
    { key: 'overtime', header: 'Overtime (daq)', render: (r) => r.record?.overtimeMinutes ?? 0 },
    { key: 'note', header: 'Izoh', render: (r) => r.record?.note ?? '—' },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (r: DailyAttendanceRow) => (
              <button
                type="button"
                onClick={() => setSelectedRow(r)}
                className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                Tuzatish
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Attendance</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Kunlik davomat</h1>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Xodim ismi bo'yicha qidirish..."
        selects={
          canManage
            ? [
                {
                  key: 'department',
                  label: "Bo'lim",
                  value: departmentId,
                  options: departments.map((d) => ({ value: d.id, label: d.name })),
                  onChange: setDepartmentId,
                },
              ]
            : []
        }
        action={
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        }
      />

      <DataTable
        columns={columns}
        rows={filteredRows}
        rowKey={(r) => r.employee.id}
        isLoading={isLoading}
        emptyText="Ushbu kun uchun xodim topilmadi"
      />

      <AttendanceRecordEditDrawer
        isOpen={selectedRow !== null}
        onClose={() => setSelectedRow(null)}
        employee={selectedRow?.employee ?? null}
        date={date}
        existingRecord={selectedRow?.record ?? null}
        onSaved={() => {
          setSelectedRow(null);
          load();
        }}
      />
    </div>
  );
}
