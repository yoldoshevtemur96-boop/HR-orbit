'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Modal } from '@/components/hr/Modal';
import { EmptyState, PageBackLink, formatDate } from '@/components/learning/materialUi';
import type { LearningRequest, LearningRequestStatus } from '@/types/learning';

const STATUS_LABEL: Record<LearningRequestStatus, string> = {
  PENDING: "Ko'rib chiqilmoqda",
  APPROVED: 'Tasdiqlandi',
  REJECTED: 'Rad etildi',
  CANCELLED: 'Bekor qilindi',
};

const STATUS_STYLE: Record<LearningRequestStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  CANCELLED: 'bg-stone-100 text-stone-500',
};

const FIELD_CLASS =
  'w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15';

export default function LearningRequestsPage() {
  const [requests, setRequests] = useState<LearningRequest[] | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ title: '', externalUrl: '', comment: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(() => {
    api.get<LearningRequest[]>('/learning/my/requests').then((res) => setRequests(res.data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsBusy(true);
    setFormError(null);
    try {
      await api.post('/learning/requests', {
        title: form.title,
        externalUrl: form.externalUrl || undefined,
        comment: form.comment || undefined,
      });
      setIsFormOpen(false);
      setForm({ title: '', externalUrl: '', comment: '' });
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error?.message ?? 'Yuborishda xatolik yuz berdi');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCancel(id: string) {
    await api.post(`/learning/requests/${id}/cancel`);
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageBackLink />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">Mening so&apos;rovlarim</h1>
          <p className="mt-1 text-sm text-stone-500">Rahbar tasdig&apos;ini talab qiladigan o&apos;qish so&apos;rovlari</p>
        </div>
        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + Tashqi kursga so&apos;rov
        </button>
      </div>

      {requests === null ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : requests.length === 0 ? (
        <EmptyState>
          So&apos;rovlar yo&apos;q. Tasdiq talab qilinadigan material yoki tadbir sahifasida &quot;Rahbardan so&apos;rash&quot; tugmasini
          bosing yoki tashqi kurs uchun so&apos;rov yuboring.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-5 py-4">
              <div className="min-w-0">
                {r.material ? (
                  <Link href={`/learning/materials/${r.material.id}`} className="text-sm font-semibold text-stone-800 hover:text-accent">
                    {r.title}
                  </Link>
                ) : r.externalUrl ? (
                  <a href={r.externalUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-stone-800 hover:text-accent">
                    {r.title} ↗
                  </a>
                ) : (
                  <p className="text-sm font-semibold text-stone-800">{r.title}</p>
                )}
                <p className="mt-0.5 text-xs text-stone-400">
                  {r.material ? 'Material' : r.event ? 'Tadbir' : 'Tashqi kurs'} · yuborilgan: {formatDate(r.createdAt)}
                  {r.comment && ` · ${r.comment}`}
                </p>
                {r.decisionComment && <p className="mt-1 text-xs text-stone-600">Rahbar izohi: {r.decisionComment}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                {r.status === 'PENDING' && (
                  <button type="button" onClick={() => handleCancel(r.id)} className="text-sm text-stone-500 hover:text-rose-600">
                    Bekor qilish
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isFormOpen} title="Tashqi kursga so'rov" onClose={() => !isBusy && setIsFormOpen(false)}>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Kurs yoki trening nomi</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={FIELD_CLASS}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Havola (ixtiyoriy)</label>
            <input
              type="url"
              value={form.externalUrl}
              onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))}
              placeholder="https://"
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Nega kerak? (ixtiyoriy)</label>
            <textarea
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              rows={3}
              className={FIELD_CLASS}
            />
          </div>
          {formError && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={isBusy || !form.title.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {isBusy ? 'Yuborilmoqda...' : 'Yuborish'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
