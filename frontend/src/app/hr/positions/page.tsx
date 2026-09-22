'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable, type DataTableColumn } from '@/components/hr/DataTable';
import { FilterBar } from '@/components/hr/FilterBar';
import { Drawer } from '@/components/hr/Drawer';
import { useAuthStore } from '@/store/authStore';
import type { Department, Position } from '@/types/core-hr';

const CAN_MANAGE_ROLES = ['SUPER_ADMIN', 'HR_MANAGER'];

export default function PositionsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user ? CAN_MANAGE_ROLES.includes(user.role) : false;

  const [positions, setPositions] = useState<Position[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Position[]>('/hr/positions').then((res) => setPositions(res.data));
  }, []);

  useEffect(() => {
    load();
    api.get('/hr/departments').then((res) => setDepartments(res.data));
  }, [load]);

  async function handleArchive(id: string) {
    setError(null);
    try {
      await api.patch(`/hr/positions/${id}/archive`);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Arxivlashda xatolik yuz berdi');
    }
  }

  const filtered = (positions ?? []).filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const columns: DataTableColumn<Position>[] = [
    { key: 'code', header: 'Code', render: (p) => <span className="font-mono text-xs text-stone-500">{p.code}</span> },
    { key: 'name', header: 'Name', render: (p) => <span className="font-medium text-stone-800">{p.name}</span> },
    { key: 'department', header: 'Department', render: (p) => p.department?.name ?? '—' },
    { key: 'grade', header: 'Grade', render: (p) => p.grade ?? '—' },
    { key: 'approved', header: 'Approved', align: 'right', render: (p) => p.approvedHeadcount },
    { key: 'occupied', header: 'Occupied', align: 'right', render: (p) => p.occupiedHeadcount },
    {
      key: 'vacant',
      header: 'Vacant',
      align: 'right',
      render: (p) => <span className={p.vacantHeadcount > 0 ? 'font-medium text-accent' : 'text-stone-400'}>{p.vacantHeadcount}</span>,
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (p: Position) =>
              p.status === 'ACTIVE' && (
                <button onClick={() => handleArchive(p.id)} className="text-xs font-medium text-rose-600 hover:text-rose-800">
                  Arxivlash
                </button>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Core HR</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Lavozimlar</h1>
        </div>
        {canManage && (
          <button
            onClick={() => setIsCreating(true)}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            + Lavozim qo&apos;shish
          </button>
        )}
      </div>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Lavozim nomi bo'yicha qidirish..." />

      <DataTable columns={columns} rows={filtered} rowKey={(p) => p.id} isLoading={positions === null} emptyText="Lavozim topilmadi" />

      <Drawer isOpen={isCreating} title="Yangi lavozim" onClose={() => setIsCreating(false)}>
        <CreatePositionForm
          departments={departments}
          onCreated={() => {
            setIsCreating(false);
            load();
          }}
        />
      </Drawer>
    </div>
  );
}

function CreatePositionForm({ departments, onCreated }: { departments: Department[]; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [grade, setGrade] = useState('');
  const [approvedHeadcount, setApprovedHeadcount] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/hr/positions', {
        name,
        code,
        departmentId,
        grade: grade || undefined,
        approvedHeadcount: Number(approvedHeadcount),
      });
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-stone-600">Nomi *</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="rounded-md border border-stone-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-stone-600">Kod *</span>
        <input required value={code} onChange={(e) => setCode(e.target.value)} className="rounded-md border border-stone-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-stone-600">Bo&apos;lim *</span>
        <select required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="rounded-md border border-stone-300 px-3 py-2 text-sm">
          <option value="">Tanlang</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-stone-600">Daraja</span>
        <input value={grade} onChange={(e) => setGrade(e.target.value)} className="rounded-md border border-stone-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-stone-600">Tasdiqlangan shtat soni *</span>
        <input required type="number" min={1} value={approvedHeadcount} onChange={(e) => setApprovedHeadcount(e.target.value)} className="rounded-md border border-stone-300 px-3 py-2 text-sm" />
      </label>
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? 'Yaratilmoqda...' : 'Yaratish'}
      </button>
    </form>
  );
}
