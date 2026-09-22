'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable, type DataTableColumn } from '@/components/hr/DataTable';
import { FilterBar } from '@/components/hr/FilterBar';
import { Drawer } from '@/components/hr/Drawer';
import { useAuthStore } from '@/store/authStore';
import type { Branch } from '@/types/core-hr';

const CAN_MANAGE_ROLES = ['SUPER_ADMIN', 'HR_MANAGER'];

export default function BranchesPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user ? CAN_MANAGE_ROLES.includes(user.role) : false;

  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Branch[]>('/hr/branches').then((res) => setBranches(res.data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleArchive(id: string) {
    setError(null);
    try {
      await api.patch(`/hr/branches/${id}/archive`);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Arxivlashda xatolik yuz berdi');
    }
  }

  const filtered = (branches ?? []).filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  const columns: DataTableColumn<Branch>[] = [
    { key: 'code', header: 'Code', render: (b) => <span className="font-mono text-xs text-stone-500">{b.code}</span> },
    { key: 'name', header: 'Name', render: (b) => <span className="font-medium text-stone-800">{b.name}</span> },
    { key: 'region', header: 'Region', render: (b) => b.region ?? '—' },
    { key: 'manager', header: 'Manager', render: (b) => b.manager?.fullName ?? '—' },
    { key: 'status', header: 'Status', render: (b) => (b.status === 'ACTIVE' ? 'Faol' : 'Arxivlangan') },
    { key: 'employees', header: 'Employees', align: 'right', render: (b) => b.employeeCount },
    { key: 'positions', header: 'Positions', align: 'right', render: (b) => b.positionCount },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (b: Branch) =>
              b.status === 'ACTIVE' && (
                <button onClick={() => handleArchive(b.id)} className="text-xs font-medium text-rose-600 hover:text-rose-800">
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
          <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Filiallar</h1>
        </div>
        {canManage && (
          <button
            onClick={() => setIsCreating(true)}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            + Filial qo&apos;shish
          </button>
        )}
      </div>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Filial nomi bo'yicha qidirish..." />

      <DataTable columns={columns} rows={filtered} rowKey={(b) => b.id} isLoading={branches === null} emptyText="Filial topilmadi" />

      <Drawer isOpen={isCreating} title="Yangi filial" onClose={() => setIsCreating(false)}>
        <CreateBranchForm
          onCreated={() => {
            setIsCreating(false);
            load();
          }}
        />
      </Drawer>
    </div>
  );
}

function CreateBranchForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [region, setRegion] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/hr/branches', { name, code, region: region || undefined, address: address || undefined });
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
        <span className="text-xs font-medium text-stone-600">Region</span>
        <input value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-md border border-stone-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-stone-600">Manzil</span>
        <input value={address} onChange={(e) => setAddress(e.target.value)} className="rounded-md border border-stone-300 px-3 py-2 text-sm" />
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
