'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable, Pagination, type DataTableColumn } from '@/components/hr/DataTable';
import { FilterBar } from '@/components/hr/FilterBar';
import { EmploymentStatusBadge } from '@/components/hr/EmploymentStatusBadge';
import { useAuthStore } from '@/store/authStore';
import type { Branch, Department, Employee, EmployeeListResult, Position } from '@/types/core-hr';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Faol' },
  { value: 'PROBATION', label: 'Sinov muddatida' },
  { value: 'ON_LEAVE', label: "Ta'tilda" },
  { value: 'SUSPENDED', label: "To'xtatilgan" },
  { value: 'TERMINATED', label: "Ishdan bo'shatilgan" },
  { value: 'ARCHIVED', label: 'Arxivlangan' },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: "To'liq stavka" },
  { value: 'PART_TIME', label: "Qisman stavka" },
  { value: 'TEMPORARY', label: 'Vaqtinchalik' },
  { value: 'CONTRACT', label: 'Shartnoma' },
  { value: 'REMOTE', label: 'Masofaviy' },
  { value: 'HYBRID', label: 'Gibrid' },
];

const CAN_ADD_ROLES = ['SUPER_ADMIN', 'HR_MANAGER'];

export default function EmployeesPage() {
  const user = useAuthStore((s) => s.user);
  const canAdd = user ? CAN_ADD_ROLES.includes(user.role) : false;

  const [result, setResult] = useState<EmployeeListResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [status, setStatus] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('fullName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    api.get('/hr/departments').then((res) => setDepartments(res.data));
    api.get('/hr/branches').then((res) => setBranches(res.data));
    api.get('/hr/positions').then((res) => setPositions(res.data));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const timeout = setTimeout(() => {
      api
        .get<EmployeeListResult>('/hr/employees', {
          params: {
            search: search || undefined,
            departmentId: departmentId || undefined,
            branchId: branchId || undefined,
            positionId: positionId || undefined,
            status: status || undefined,
            employmentType: employmentType || undefined,
            sortBy,
            sortDir,
            page,
            pageSize: 20,
          },
        })
        .then((res) => setResult(res.data))
        .finally(() => setIsLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, departmentId, branchId, positionId, status, employmentType, sortBy, sortDir, page]);

  function handleSortChange(key: string) {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
    setPage(1);
  }

  const columns: DataTableColumn<Employee>[] = [
    { key: 'employeeCode', header: 'Employee ID', sortKey: 'employeeCode', render: (e) => <span className="font-mono text-xs text-stone-500">{e.employeeCode}</span> },
    {
      key: 'fullName',
      header: 'Full Name',
      sortKey: 'fullName',
      render: (e) => (
        <Link href={`/hr/employees/${e.id}`} className="font-medium text-stone-800 hover:text-accent">
          {e.fullName}
        </Link>
      ),
    },
    { key: 'position', header: 'Position', render: (e) => e.position?.name ?? '—' },
    { key: 'department', header: 'Department', render: (e) => e.department?.name ?? '—' },
    { key: 'branch', header: 'Branch', render: (e) => e.branch?.name ?? '—' },
    { key: 'manager', header: 'Manager', render: (e) => e.manager?.fullName ?? '—' },
    { key: 'status', header: 'Status', render: (e) => <EmploymentStatusBadge status={e.status} /> },
    { key: 'hiredAt', header: 'Hire Date', sortKey: 'hiredAt', render: (e) => new Date(e.hiredAt).toLocaleDateString('uz-UZ') },
    { key: 'workEmail', header: 'Work Email', render: (e) => e.workEmail ?? '—' },
    { key: 'phone', header: 'Phone', render: (e) => e.personalPhone ?? e.workPhone ?? '—' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Core HR</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Xodimlar</h1>
        </div>
        {canAdd && (
          <Link
            href="/hr/employees/new"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            + Xodim qo&apos;shish
          </Link>
        )}
      </div>

      <FilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Ism, ID yoki email bo'yicha qidirish..."
        selects={[
          {
            key: 'department',
            label: "Bo'lim",
            value: departmentId,
            options: departments.map((d) => ({ value: d.id, label: d.name })),
            onChange: (v) => {
              setDepartmentId(v);
              setPage(1);
            },
          },
          {
            key: 'branch',
            label: 'Filial',
            value: branchId,
            options: branches.map((b) => ({ value: b.id, label: b.name })),
            onChange: (v) => {
              setBranchId(v);
              setPage(1);
            },
          },
          {
            key: 'position',
            label: 'Lavozim',
            value: positionId,
            options: positions.map((p) => ({ value: p.id, label: p.name })),
            onChange: (v) => {
              setPositionId(v);
              setPage(1);
            },
          },
          {
            key: 'status',
            label: 'Holat',
            value: status,
            options: STATUS_OPTIONS,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
          },
          {
            key: 'employmentType',
            label: 'Ish turi',
            value: employmentType,
            options: EMPLOYMENT_TYPE_OPTIONS,
            onChange: (v) => {
              setEmploymentType(v);
              setPage(1);
            },
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={result?.items ?? []}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        emptyText="Xodim topilmadi"
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
      />

      {result && <Pagination page={result.page} pageSize={result.pageSize} total={result.total} onPageChange={setPage} />}
    </div>
  );
}
