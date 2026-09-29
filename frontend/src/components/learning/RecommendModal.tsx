'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Modal } from '@/components/hr/Modal';
import type { Colleague } from '@/types/learning';

const FIELD_CLASS =
  'w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15';

// Materialni bir yoki bir nechta hamkasbga tavsiya qilish oynasi
export function RecommendModal({
  materialId,
  materialTitle,
  isOpen,
  onClose,
}: {
  materialId: string;
  materialTitle: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [selected, setSelected] = useState<Map<string, Colleague>>(new Map());
  const [comment, setComment] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setSelected(new Map());
    setComment('');
    setError(null);
    setSentCount(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      api
        .get<Colleague[]>('/learning/colleagues', { params: { search: search.trim() || undefined } })
        .then((res) => setColleagues(res.data));
    }, 250);
    return () => clearTimeout(timer);
  }, [search, isOpen]);

  function toggle(c: Colleague) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(c.id)) next.delete(c.id);
      else next.set(c.id, c);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      const res = await api.post<{ recommendedCount: number }>(`/learning/materials/${materialId}/recommend`, {
        employeeIds: [...selected.keys()],
        comment: comment.trim() || undefined,
      });
      setSentCount(res.data.recommendedCount);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Yuborishda xatolik yuz berdi');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Modal isOpen={isOpen} title="Hamkasbga tavsiya qilish" onClose={() => !isBusy && onClose()}>
      {sentCount !== null ? (
        <div className="flex flex-col gap-3 text-sm">
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-800">
            &quot;{materialTitle}&quot; {sentCount} ta hamkasbingizga tavsiya qilindi.
          </p>
          <button type="button" onClick={onClose} className="self-end rounded-lg bg-accent px-4 py-2 font-semibold text-white hover:opacity-90">
            Yopish
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-sm text-stone-600">&quot;{materialTitle}&quot;</p>

          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...selected.values()].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c)}
                  className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/20"
                >
                  {c.fullName} ✕
                </button>
              ))}
            </div>
          )}

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hamkasbni qidirish"
            className={FIELD_CLASS}
            autoFocus
          />
          <div className="max-h-52 overflow-y-auto rounded-lg border border-stone-200">
            {colleagues.length === 0 && <p className="px-3 py-2 text-sm text-stone-400">Topilmadi</p>}
            {colleagues.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 border-b border-stone-100 px-3 py-2 text-sm last:border-0 hover:bg-stone-50"
              >
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-stone-800">{c.fullName}</span>
                  <span className="block truncate text-xs text-stone-400">
                    {[c.position, c.department].filter(Boolean).join(' · ') || '—'}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Izoh (ixtiyoriy)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Nega foydali deb o'ylaysiz?"
              className={FIELD_CLASS}
            />
          </div>

          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={isBusy || selected.size === 0}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {isBusy ? 'Yuborilmoqda...' : `Tavsiya qilish${selected.size > 0 ? ` (${selected.size})` : ''}`}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
