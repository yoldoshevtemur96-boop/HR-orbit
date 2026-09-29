'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Modal } from '@/components/hr/Modal';
import { MATERIAL_TYPE_LABEL, formatDate } from '@/components/learning/materialUi';
import { AssignmentRowsView } from '@/components/learning-admin/AssignmentRowsView';
import { ASSIGNMENT_REASON_LABEL, ASSIGNMENT_SOURCE_LABEL, type AssignmentReason, type AssignmentSource } from '@/types/learningAdmin';
import type { LearningMaterialType } from '@/types/learning';

interface BatchDetail {
  id: string;
  name: string;
  source: AssignmentSource;
  material: { id: string; title: string; type: LearningMaterialType; status: string };
  rule: { id: string; name: string; status: string } | null;
  reason: AssignmentReason;
  reasonText: string | null;
  note: string | null;
  dueDate: string | null;
  dueInDays: number | null;
  audienceSummary: string | null;
  createdAt: string;
  createdBy: string | null;
  canEdit: boolean;
}

const FIELD_CLASS =
  'w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15';

function toDateInput(iso: string | null) {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Bitta tayinlov: ma'lumotlari, amallar (nom, muddat, bekor qilish, xodim
// qo'shish) va ichidagi xodimlar ro'yxati.
export default function BatchPage() {
  const params = useParams<{ id: string }>();
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [due, setDue] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get<BatchDetail>(`/learning-admin/batches/${params.id}`)
      .then((res) => setBatch(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik'));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!batch) return;
    setIsBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (name.trim() && name.trim() !== batch.name) body.name = name.trim();
      if (due !== toDateInput(batch.dueDate)) body.dueDate = due || null;
      const res = await api.patch<{ updated: number }>(`/learning-admin/batches/${batch.id}`, body);
      setMessage(body.dueDate !== undefined ? `Saqlandi, ${res.data.updated} ta xodimning muddati yangilandi` : 'Saqlandi');
      setEditOpen(false);
      load();
      setReloadKey((k) => k + 1);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Saqlashda xatolik');
    } finally {
      setIsBusy(false);
    }
  }

  async function cancelAll() {
    if (!batch || !window.confirm(`"${batch.name}" tayinlovi bekor qilinsinmi? Tugatganlarning natijasi saqlanadi.`)) return;
    setError(null);
    try {
      const res = await api.post<{ cancelled: number }>(`/learning-admin/batches/${batch.id}/cancel`);
      setMessage(`${res.data.cancelled} ta tayinlov bekor qilindi`);
      setReloadKey((k) => k + 1);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Xatolik yuz berdi');
    }
  }

  if (!batch) {
    return error ? (
      <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
    ) : (
      <p className="text-sm text-stone-400">Yuklanmoqda...</p>
    );
  }

  const isRule = batch.source === 'RULE';
  const canEdit = batch.canEdit;
  const btn = 'rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-stone-900">{batch.name}</h1>
            <p className="mt-1 text-sm text-stone-500">
              {isRule ? 'Qoida' : ASSIGNMENT_SOURCE_LABEL[batch.source]}
              {batch.createdBy && ` · ${batch.createdBy}`} · {formatDate(batch.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && !isRule && (
              <Link href={`/learning-admin/assignments/new?batchId=${batch.id}`} className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
                + Xodim qo&apos;shish
              </Link>
            )}
            {isRule && batch.rule && (
              <Link href="/learning-admin/rules" className={btn}>
                Qoidani boshqarish
              </Link>
            )}
            {canEdit && (
            <button
              type="button"
              onClick={() => {
                setName(batch.name);
                setDue(toDateInput(batch.dueDate));
                setEditOpen(true);
              }}
              className={btn}
            >
              Tahrirlash
            </button>
            )}
            {canEdit && !isRule && (
              <button type="button" onClick={cancelAll} className={`${btn} text-stone-500 hover:border-rose-200 hover:text-rose-600`}>
                Bekor qilish
              </button>
            )}
          </div>
        </div>

        <dl className="grid gap-4 text-sm md:grid-cols-4">
          <div>
            <dt className="text-xs text-stone-400">Material</dt>
            <dd>
              <Link href={`/learning-admin/catalog/${batch.material.id}`} className="font-medium text-stone-800 hover:text-accent">
                {batch.material.title}
              </Link>
              <span className="block text-xs text-stone-400">{MATERIAL_TYPE_LABEL[batch.material.type]}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-400">Kimga</dt>
            <dd className="text-stone-700">{batch.audienceSummary ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-400">Sabab</dt>
            <dd className="text-stone-700">
              {batch.reason === 'OTHER' && batch.reasonText ? batch.reasonText : ASSIGNMENT_REASON_LABEL[batch.reason]}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-400">Muddat</dt>
            <dd className="text-stone-700">
              {batch.dueDate ? formatDate(batch.dueDate) : batch.dueInDays ? `tayinlangandan ${batch.dueInDays} kun ichida` : 'muddatsiz'}
            </dd>
          </div>
        </dl>
        {batch.note && <p className="text-sm text-stone-500">Izoh: {batch.note}</p>}
      </div>

      {message && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <h2 className="text-base font-semibold text-stone-900">Xodimlar</h2>
      <AssignmentRowsView key={reloadKey} batchId={batch.id} />

      <Modal isOpen={editOpen} title="Tayinlovni tahrirlash" onClose={() => !isBusy && setEditOpen(false)}>
        <form onSubmit={saveEdit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Nomi</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={FIELD_CLASS} disabled={isRule} />
            {isRule && <p className="mt-1 text-xs text-stone-400">Qoida tayinlovi nomi qoida nomidan olinadi.</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Muddat (hamma tugatmaganlar uchun)</label>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={FIELD_CLASS} />
            <p className="mt-1 text-xs text-stone-400">Bo&apos;sh — muddatsiz. Eslatmalar yangi muddat bo&apos;yicha qayta yuboriladi.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditOpen(false)} className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">
              Bekor qilish
            </button>
            <button type="submit" disabled={isBusy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {isBusy ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
