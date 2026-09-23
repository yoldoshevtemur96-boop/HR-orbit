'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable, type DataTableColumn } from '@/components/hr/DataTable';
import { FilterBar } from '@/components/hr/FilterBar';
import { Modal } from '@/components/hr/Modal';
import { AttendanceDayStatusBadge } from '@/components/attendance/AttendanceDayStatusBadge';
import { AttendanceRecordEditDrawer } from '@/components/attendance/AttendanceRecordEditDrawer';
import { CorrectionRequestForm } from '@/components/attendance/CorrectionRequestForm';
import { DepartmentAccordion } from '@/components/attendance/DepartmentAccordion';
import { useAuthStore } from '@/store/authStore';
import type {
  AttendanceDayStatus,
  AttendanceRecord,
  AttendanceSettings,
  DailyAttendanceRow,
  MonthlyStatisticsRow,
} from '@/types/attendance';
import type { Department } from '@/types/core-hr';

const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_MANAGER', 'TIMEKEEPER'];

// Faqat shu holatlarda tuzatish so'rovi ma'noga ega — kelmagan/kechikkan
// kunlar uchun. Ta'til, safar va h.k. HR/tabelchi tomonidan qo'yiladi.
const CORRECTABLE_STATUSES: AttendanceDayStatus[] = ['LATE', 'ABSENT', 'EARLY_LEAVE'];

type ViewMode = 'daily' | 'monthly' | 'statistics';
type QuickFilter = 'ALL' | 'LATE' | 'ABSENT';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateHuman(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function shiftDate(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DailyAttendancePage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user ? MANAGE_ROLES.includes(user.role) : false;
  const canRequestCorrection = user?.role === 'DEPARTMENT_HEAD';
  const canGroupByDepartment = canManage;

  const [view, setView] = useState<ViewMode>('daily');

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Attendance</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Davomat</h1>
      </div>

      <div className="flex gap-1 rounded-lg border border-stone-200 bg-white p-1">
        {(
          [
            { key: 'daily', label: 'Kunlik' },
            { key: 'monthly', label: 'Oylik' },
            { key: 'statistics', label: 'Statistika' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setView(tab.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              view === tab.key ? 'bg-accent text-white' : 'text-stone-500 hover:bg-stone-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === 'daily' && (
        <DailyView canManage={canManage} canRequestCorrection={canRequestCorrection} canGroupByDepartment={canGroupByDepartment} />
      )}
      {view === 'monthly' && <MonthlyView canManage={canManage} />}
      {view === 'statistics' && <StatisticsView />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Кунлик
// ---------------------------------------------------------------------------

function DailyView({
  canManage,
  canRequestCorrection,
  canGroupByDepartment,
}: {
  canManage: boolean;
  canRequestCorrection: boolean;
  canGroupByDepartment: boolean;
}) {
  const [date, setDate] = useState(todayIso());
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rows, setRows] = useState<DailyAttendanceRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('ALL');
  const [selectedRow, setSelectedRow] = useState<DailyAttendanceRow | null>(null);
  const [correctionRow, setCorrectionRow] = useState<DailyAttendanceRow | null>(null);
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (canManage) {
      api.get('/hr/departments').then((res) => setDepartments(res.data));
    }
    api.get<AttendanceSettings>('/attendance/settings').then((res) => setSettings(res.data));
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

  const filteredRows = useMemo(() => {
    let list = rows ?? [];
    if (search) {
      list = list.filter((r) => r.employee.fullName.toLowerCase().includes(search.toLowerCase()));
    }
    if (quickFilter === 'LATE') {
      list = list.filter((r) => r.record?.status === 'LATE');
    } else if (quickFilter === 'ABSENT') {
      list = list.filter((r) => (r.record?.status ?? 'ABSENT') === 'ABSENT');
    }
    return list;
  }, [rows, search, quickFilter]);

  const departmentNameById = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments]);

  const groupedByDepartment = useMemo(() => {
    if (!canGroupByDepartment) return null;
    const groups = new Map<string, DailyAttendanceRow[]>();
    for (const row of filteredRows) {
      const key = row.employee.departmentId ?? '__none__';
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    return groups;
  }, [filteredRows, canGroupByDepartment]);

  async function handleExport() {
    setIsExporting(true);
    try {
      const res = await api.get('/attendance/records/daily/export', {
        params: { date, departmentId: departmentId || undefined },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `davomat_${date}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  const columns: DataTableColumn<DailyAttendanceRow>[] = [
    { key: 'employeeCode', header: 'ID', render: (r) => <span className="font-mono text-xs text-stone-500">{r.employee.employeeCode}</span> },
    { key: 'fullName', header: "F.I.Sh.", render: (r) => <span className="font-medium text-stone-800">{r.employee.fullName}</span> },
    {
      key: 'standardStart',
      header: 'Ish boshlagan vaqti',
      render: () => settings?.standardStartTime ?? '—',
    },
    {
      key: 'lateAt',
      header: 'Kechikib kelgan vaqt',
      render: (r) => (r.record?.status === 'LATE' ? formatTime(r.record.checkInTime) : '00:00'),
    },
    {
      key: 'standardEnd',
      header: 'Ish tugatilgan vaqti',
      render: () => settings?.standardEndTime ?? '—',
    },
    {
      key: 'earlyLeaveAt',
      header: 'Erta ketish vaqti',
      render: (r) => (r.record?.status === 'EARLY_LEAVE' ? formatTime(r.record.checkOutTime) : '00:00'),
    },
    { key: 'status', header: 'Holat', render: (r) => <AttendanceDayStatusBadge status={r.record?.status ?? 'ABSENT'} /> },
    { key: 'note', header: 'Izoh', render: (r) => r.record?.note ?? '—' },
    ...(canManage || canRequestCorrection
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (r: DailyAttendanceRow) => {
              const status = r.record?.status ?? 'ABSENT';
              return (
                <div className="inline-flex items-center gap-1.5">
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setSelectedRow(r)}
                      className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    >
                      Tuzatish
                    </button>
                  )}
                  {canRequestCorrection && CORRECTABLE_STATUSES.includes(status) && (
                    <button
                      type="button"
                      onClick={() => setCorrectionRow(r)}
                      aria-label={`${r.employee.fullName} uchun tuzatish so'rovi`}
                      title="Tuzatish so'rovi yuborish"
                      className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-accent"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
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
        extra={
          <div className="flex gap-1 rounded-lg border border-stone-200 bg-white p-1">
            {(
              [
                { key: 'ALL', label: 'Barchasi' },
                { key: 'LATE', label: 'Kechikkanlar' },
                { key: 'ABSENT', label: 'Kelmaganlar' },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setQuickFilter(f.key)}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                  quickFilter === f.key ? 'bg-accent text-white' : 'text-stone-500 hover:bg-stone-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDate((d) => shiftDate(d, -1))}
              className="rounded-md border border-stone-200 px-2.5 py-2 text-xs font-medium hover:bg-stone-50"
              aria-label="Oldingi kun"
            >
              ←
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
            <button
              type="button"
              onClick={() => setDate((d) => shiftDate(d, 1))}
              className="rounded-md border border-stone-200 px-2.5 py-2 text-xs font-medium hover:bg-stone-50"
              aria-label="Keyingi kun"
            >
              →
            </button>
            {canManage && (
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {isExporting ? 'Yuklanmoqda...' : "Excel'ga eksport"}
              </button>
            )}
          </div>
        }
      />

      <p className="text-xs text-stone-400">{formatDateHuman(date)} — jami {filteredRows.length} ta xodim</p>

      {groupedByDepartment ? (
        <div className="flex flex-col gap-2">
          {[...groupedByDepartment.entries()].map(([deptId, deptRows]) => (
            <DepartmentAccordion
              key={deptId}
              title={departmentNameById.get(deptId) ?? "Bo'limsiz"}
              count={deptRows.length}
            >
              <DataTable
                columns={columns}
                rows={deptRows}
                rowKey={(r) => r.employee.id}
                isLoading={isLoading}
                emptyText="Xodim topilmadi"
              />
            </DepartmentAccordion>
          ))}
          {groupedByDepartment.size === 0 && !isLoading && (
            <p className="rounded-lg border border-stone-200 bg-white p-5 text-center text-sm text-stone-400">
              Ushbu kun uchun xodim topilmadi
            </p>
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filteredRows}
          rowKey={(r) => r.employee.id}
          isLoading={isLoading}
          emptyText="Ushbu kun uchun xodim topilmadi"
        />
      )}

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

      <Modal
        isOpen={correctionRow !== null}
        title={`Tuzatish so'rovi — ${correctionRow?.employee.fullName ?? ''}`}
        onClose={() => setCorrectionRow(null)}
      >
        {correctionRow && (
          <CorrectionRequestForm
            employeeId={correctionRow.employee.id}
            employeeName={correctionRow.employee.fullName}
            presetDate={date}
            onCreated={() => {
              setCorrectionRow(null);
              load();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ойлик
// ---------------------------------------------------------------------------

function MonthlyView({ canManage }: { canManage: boolean }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [employees, setEmployees] = useState<{ id: string; fullName: string }[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!canManage) return;
    api.get('/attendance/records/daily', { params: { date: todayIso() } }).then((res) => {
      const list = (res.data as DailyAttendanceRow[]).map((r) => ({ id: r.employee.id, fullName: r.employee.fullName }));
      setEmployees(list);
      if (list.length > 0) setEmployeeId((prev) => prev || list[0].id);
    });
  }, [canManage]);

  useEffect(() => {
    if (canManage && !employeeId) return;
    setIsLoading(true);
    const url = canManage ? `/attendance/records/employee/${employeeId}` : '/attendance/records/me/calendar';
    api
      .get<AttendanceRecord[]>(url, { params: { year, month } })
      .then((res) => setRecords(res.data))
      .finally(() => setIsLoading(false));
  }, [canManage, employeeId, year, month]);

  function shiftMonth(delta: number) {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  }

  const recordByDate = new Map(records.map((r) => [r.date.slice(0, 10), r]));
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { day, dateStr, record: recordByDate.get(dateStr) ?? null };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {canManage && (
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        )}
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
      </div>

      {isLoading ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
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
                {days.map(({ dateStr, record }) => (
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
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Статистика
// ---------------------------------------------------------------------------

function StatisticsView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<MonthlyStatisticsRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('lateCount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setIsLoading(true);
    api
      .get<MonthlyStatisticsRow[]>('/attendance/records/statistics', { params: { year, month } })
      .then((res) => setRows(res.data))
      .finally(() => setIsLoading(false));
  }, [year, month]);

  function handleSortChange(key: string) {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  }

  const sortedRows = useMemo(() => {
    if (!rows) return [];
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = (a as any)[sortBy] as number;
      const bv = (b as any)[sortBy] as number;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortBy, sortDir]);

  const columns: DataTableColumn<MonthlyStatisticsRow>[] = [
    { key: 'employeeCode', header: 'ID', render: (r) => <span className="font-mono text-xs text-stone-500">{r.employeeCode}</span> },
    { key: 'fullName', header: "F.I.Sh.", sortKey: 'fullName', render: (r) => r.fullName },
    { key: 'presentCount', header: 'Keldi', sortKey: 'presentCount', render: (r) => r.presentCount },
    { key: 'lateCount', header: 'Kechikish soni', sortKey: 'lateCount', render: (r) => r.lateCount },
    { key: 'absentCount', header: 'Kelmagan kunlar', sortKey: 'absentCount', render: (r) => r.absentCount },
    { key: 'totalWorkedHours', header: 'Jami soat', sortKey: 'totalWorkedHours', render: (r) => r.totalWorkedHours },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const next = new Date(year, month - 2, 1);
            setYear(next.getFullYear());
            setMonth(next.getMonth() + 1);
          }}
          className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium hover:bg-stone-50"
        >
          ← Oldingi oy
        </button>
        <span className="text-sm font-medium text-stone-700">
          {year}-{String(month).padStart(2, '0')}
        </span>
        <button
          type="button"
          onClick={() => {
            const next = new Date(year, month, 1);
            setYear(next.getFullYear());
            setMonth(next.getMonth() + 1);
          }}
          className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium hover:bg-stone-50"
        >
          Keyingi oy →
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={sortedRows}
        rowKey={(r) => r.employeeId}
        isLoading={isLoading}
        emptyText="Xodim topilmadi"
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
      />
    </div>
  );
}
