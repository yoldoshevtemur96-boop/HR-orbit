'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Modal } from '@/components/hr/Modal';
import { MATERIAL_TYPE_LABEL, formatDate } from '@/components/learning/materialUi';
import {
  ASSIGNMENT_REASON_LABEL,
  ASSIGNMENT_SOURCE_LABEL,
  ASSIGNMENT_STATE_LABEL,
  ASSIGNMENT_STATE_STYLE,
  type AssignableMaterial,
  type AssignmentList,
  type AssignmentRow,
  type AssignmentState,
  type AudienceOptions,
} from '@/types/learningAdmin';

const FIELD_CLASS =
  'rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15';

const STATES: AssignmentState[] = ['NOT_STARTED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED', 'CANCELLED'];

function toDateInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  // Toshkent vaqti bo'yicha sana (UTC+5)
  const local = new Date(d.getTime() + 5 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export default function AssignmentsPage() {
  const [data, setData] = useState<AssignmentList | null>(null);
  const [materials, setMaterials] = useState<AssignableMaterial[]>([]);
  const [options, setOptions] = useState<AudienceOptions | null>(null);
  const [filters, setFilters] = useState({ materialId: '', departmentId: '', state: '' as '' | AssignmentState, search: '' });
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AssignmentRow | null>(null);
  const [editDue, setEditDue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<AssignableMaterial[]>('/learning-admin/materials').then((res) => setMaterials(res.data));
    api.get<AudienceOptions>('/learning-admin/audience-options').then((res) => setOptions(res.data));
  }, []);

  const load = useCallback(() => {
    api
      .get<AssignmentList>('/learning-admin/assignments', {
        params: {
          materialId: filters.materialId || undefined,
          departmentId: filters.departmentId || undefined,
          state: filters.state || undefined,
          search: filters.search || undefined,
        },
      })
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik yuz berdi'));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCancel(row: AssignmentRow) {
    if (!window.confirm(`${row.employee.fullName} uchun "${row.material.title}" tayinlovi bekor qilinsinmi?`)) return;
    setError(null);
    try {
      await api.post(`/learning-admin/assignments/${row.id}/cancel`);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Bekor qilishda xatolik');
    }
  }

  async function handleSaveDue(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      await api.patch(`/learning-admin/assignments/${editing.id}`, { dueDate: editDue || null });
      setEditing(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Saqlashda xatolik');
    }
  }

  const hasFilters = Boolean(filters.materialId || filters.departmentId || filters.state || filters.search);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500">Xodimlarga tayinlangan materiallar va ularning bajarilishi</p>
        <Link
          href="/learning-admin/assignments/new"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + Yangi tayinlash
        </Link>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilters((f) => ({ ...f, state: f.state === s ? '' : s }))}
              className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition ${
                filters.state === s ? 'border-accent bg-accent/5' : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <span className="text-2xl font-semibold text-stone-900">{data.counts[s]}</span>
              <span className="text-xs text-stone-500">{ASSIGNMENT_STATE_LABEL[s]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Material</label>
          <select
            value={filters.materialId}
            onChange={(e) => setFilters((f) => ({ ...f, materialId: e.target.value }))}
            className={`${FIELD_CLASS} max-w-xs`}
          >
            <option value="">Barchasi</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Bo&apos;lim</label>
          <select
            value={filters.departmentId}
            onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value }))}
            className={FIELD_CLASS}
          >
            <option value="">Barchasi</option>
            {options?.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFilters((f) => ({ ...f, search: search.trim() }));
          }}
        >
          <label className="mb-1 block text-xs font-medium text-stone-500">Xodim</label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => setFilters((f) => ({ ...f, search: search.trim() }))}
            placeholder="F.I.Sh. yoki tabel raqami"
            className={`${FIELD_CLASS} w-60`}
          />
        </form>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setFilters({ materialId: '', departmentId: '', state: '', search: '' });
              setSearch('');
            }}
            className="px-2 py-2 text-sm text-stone-500 hover:text-stone-800"
          >
            Tozalash
          </button>
        )}
      </div>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {data === null ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : data.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400">
          {hasFilters ? "Filtr bo'yicha tayinlov topilmadi." : "Hali hech kimga material tayinlanmagan."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">Xodim</th>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Sabab</th>
                <th className="px-4 py-3">Muddat</th>
                <th className="px-4 py-3">Holat</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-800">{row.employee.fullName}</p>
                    <p className="text-xs text-stone-400">
                      {row.employee.employeeCode}
                      {row.employee.department && ` · ${row.employee.department}`}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-stone-800">{row.material.title}</p>
                    <p className="text-xs text-stone-400">
                      {MATERIAL_TYPE_LABEL[row.material.type]} · {ASSIGNMENT_SOURCE_LABEL[row.source]} · {formatDate(row.createdAt)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {row.reason === 'OTHER' && row.reasonText ? row.reasonText : ASSIGNMENT_REASON_LABEL[row.reason]}
                  </td>
                  <td className={`px-4 py-3 ${row.state === 'OVERDUE' ? 'font-medium text-rose-600' : 'text-stone-600'}`}>
                    {row.dueDate ? formatDate(row.dueDate) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ASSIGNMENT_STATE_STYLE[row.state]}`}>
                      {ASSIGNMENT_STATE_LABEL[row.state]}
                    </span>
                    {row.progress && row.state !== 'COMPLETED' && row.state !== 'CANCELLED' && (
                      <span className="ml-2 text-xs text-stone-400">{row.progress.progress}%</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {row.state !== 'CANCELLED' && row.state !== 'COMPLETED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(row);
                            setEditDue(toDateInput(row.dueDate));
                          }}
                          className="text-sm text-stone-500 hover:text-accent"
                        >
                          Muddat
                        </button>
                        <button type="button" onClick={() => handleCancel(row)} className="ml-3 text-sm text-stone-500 hover:text-rose-600">
                          Bekor qilish
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={editing !== null} title="Muddatni o'zgartirish" onClose={() => setEditing(null)}>
        {editing && (
          <form onSubmit={handleSaveDue} className="flex flex-col gap-3">
            <p className="text-sm text-stone-600">
              {editing.employee.fullName} — {editing.material.title}
            </p>
            <input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} className={FIELD_CLASS} />
            <p className="text-xs text-stone-400">Bo&apos;sh qoldirilsa — muddatsiz. Yangi muddat bo&apos;yicha eslatma qayta yuboriladi.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                Bekor qilish
              </button>
              <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                Saqlash
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
