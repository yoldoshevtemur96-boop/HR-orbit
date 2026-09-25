'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Modal } from '@/components/hr/Modal';
import { EmptyState, MATERIAL_TYPE_LABEL, PageBackLink, ProgressBar, formatDate } from '@/components/learning/materialUi';
import type { DevelopmentGoal, LearningMaterial } from '@/types/learning';

const FIELD_CLASS =
  'w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15';

const EMPTY_FORM = { title: '', description: '', dueDate: '', materialIds: [] as string[] };

export default function LearningGoalsPage() {
  const [goals, setGoals] = useState<DevelopmentGoal[] | null>(null);
  const [catalog, setCatalog] = useState<LearningMaterial[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [materialSearch, setMaterialSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(() => {
    api.get<DevelopmentGoal[]>('/learning/my/goals').then((res) => setGoals(res.data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openForm() {
    setForm(EMPTY_FORM);
    setMaterialSearch('');
    setFormError(null);
    setIsFormOpen(true);
    if (catalog.length === 0) {
      api.get<LearningMaterial[]>('/learning/materials').then((res) => setCatalog(res.data));
    }
  }

  function toggleMaterial(id: string) {
    setForm((f) => ({
      ...f,
      materialIds: f.materialIds.includes(id) ? f.materialIds.filter((m) => m !== id) : [...f.materialIds, id],
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsBusy(true);
    setFormError(null);
    try {
      await api.post('/learning/goals', {
        title: form.title,
        description: form.description || undefined,
        dueDate: form.dueDate || undefined,
        materialIds: form.materialIds,
      });
      setIsFormOpen(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error?.message ?? 'Saqlashda xatolik yuz berdi');
    } finally {
      setIsBusy(false);
    }
  }

  async function setStatus(goalId: string, status: DevelopmentGoal['status']) {
    await api.patch(`/learning/goals/${goalId}`, { status });
    load();
  }

  const search = materialSearch.trim().toLowerCase();
  const visibleCatalog = catalog.filter((m) => !search || m.title.toLowerCase().includes(search));

  return (
    <div className="flex flex-col gap-6">
      <PageBackLink />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">Rivojlanish maqsadlari</h1>
          <p className="mt-1 text-sm text-stone-500">O&apos;qishni maqsad sifatida rejalashtiring va natijani kuzating</p>
        </div>
        <button
          type="button"
          onClick={openForm}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + Yangi maqsad
        </button>
      </div>

      {goals === null ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : goals.length === 0 ? (
        <EmptyState>Hali maqsad qo&apos;yilmagan.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const total = goal.materials.length;
            const percent = total > 0 ? Math.round((goal.completedCount / total) * 100) : 0;
            const isDone = goal.status === 'COMPLETED';
            const isOverdue = !isDone && goal.dueDate && new Date(goal.dueDate) < new Date();
            return (
              <div key={goal.id} className={`flex flex-col gap-3 rounded-xl border bg-white p-5 ${isDone ? 'border-emerald-200' : 'border-stone-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-stone-900">{goal.title}</p>
                    {goal.description && <p className="mt-1 text-sm text-stone-500">{goal.description}</p>}
                  </div>
                  {isDone && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Bajarildi</span>}
                </div>

                {goal.dueDate && (
                  <p className={`text-xs ${isOverdue ? 'font-medium text-rose-600' : 'text-stone-400'}`}>
                    Muddat: {formatDate(goal.dueDate)}
                    {isOverdue && " · muddat o'tgan"}
                  </p>
                )}

                {total > 0 && (
                  <>
                    <div className="flex items-center gap-3">
                      <ProgressBar value={percent} className="flex-1" />
                      <span className="text-xs font-semibold text-stone-600">
                        {goal.completedCount}/{total}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {goal.materials.map((m) => (
                        <li key={m.id} className="flex items-center gap-2 text-sm">
                          <span className={m.isCompleted ? 'text-emerald-600' : 'text-stone-300'}>{m.isCompleted ? '✓' : '○'}</span>
                          <Link
                            href={`/learning/materials/${m.id}`}
                            className={`truncate hover:text-accent ${m.isCompleted ? 'text-stone-400 line-through' : 'text-stone-700'}`}
                          >
                            {m.title}
                          </Link>
                          <span className="flex-shrink-0 text-xs text-stone-400">{MATERIAL_TYPE_LABEL[m.type]}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <div className="flex gap-3 border-t border-stone-100 pt-3 text-sm">
                  {isDone ? (
                    <button type="button" onClick={() => setStatus(goal.id, 'ACTIVE')} className="text-stone-500 hover:text-stone-800">
                      Qayta ochish
                    </button>
                  ) : (
                    <button type="button" onClick={() => setStatus(goal.id, 'COMPLETED')} className="font-medium text-emerald-700 hover:underline">
                      ✓ Bajarildi deb belgilash
                    </button>
                  )}
                  <button type="button" onClick={() => setStatus(goal.id, 'CANCELLED')} className="ml-auto text-stone-400 hover:text-rose-600">
                    O&apos;chirish
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={isFormOpen} title="Yangi maqsad" onClose={() => !isBusy && setIsFormOpen(false)}>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Maqsad</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Masalan: Excel'ni mukammal o'rganish"
              className={FIELD_CLASS}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Tavsif (ixtiyoriy)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Muddat (ixtiyoriy)</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">
              Materiallar ({form.materialIds.length} ta tanlandi)
            </label>
            <input
              type="search"
              value={materialSearch}
              onChange={(e) => setMaterialSearch(e.target.value)}
              placeholder="Katalogdan qidirish"
              className={`${FIELD_CLASS} mb-2`}
            />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-stone-200">
              {visibleCatalog.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-center gap-2 border-b border-stone-100 px-3 py-2 text-sm last:border-0 hover:bg-stone-50">
                  <input type="checkbox" checked={form.materialIds.includes(m.id)} onChange={() => toggleMaterial(m.id)} />
                  <span className="flex-1 truncate text-stone-700">{m.title}</span>
                  <span className="text-xs text-stone-400">{MATERIAL_TYPE_LABEL[m.type]}</span>
                </label>
              ))}
              {visibleCatalog.length === 0 && <p className="px-3 py-2 text-sm text-stone-400">Topilmadi</p>}
            </div>
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
              {isBusy ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
