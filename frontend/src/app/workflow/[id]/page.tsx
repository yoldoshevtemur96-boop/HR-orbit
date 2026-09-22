'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { WorkflowTimeline } from '@/components/WorkflowTimeline';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { WorkflowInstanceDetail } from '@/types/workflow';

// Bitta arizaning to'liq kuzatuv ekrani — "kimga bordi, kim imzolamay
// turibdi" savolining javobi shu sahifada. Xodim ham, HR ham xuddi shu
// sahifadan foydalanadi; farq faqat — joriy bosqichga tayinlangan odam
// bo'lsa, Tasdiqlash/Rad etish tugmalari qo'shimcha ko'rinadi.
export default function WorkflowInstancePage() {
  const params = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [instance, setInstance] = useState<WorkflowInstanceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [isActing, setIsActing] = useState(false);

  const load = useCallback(() => {
    api
      .get<WorkflowInstanceDetail>(`/workflow/instances/${params.id}`)
      .then((res) => setInstance(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Ariza yuklanmadi'));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const currentStep = instance?.timeline.find((t) => t.isCurrent);
  const canDecide =
    instance?.status === 'IN_PROGRESS' && currentStep?.assignedUser?.id === user?.userId;

  async function decide(decision: 'APPROVED' | 'REJECTED') {
    setIsActing(true);
    try {
      await api.post(`/workflow/instances/${params.id}/decide`, { decision, comment: comment || undefined });
      setComment('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Amalni bajarishda xatolik yuz berdi');
    } finally {
      setIsActing(false);
    }
  }

  return (
    <AppShell>
      {error && <p className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {!instance ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : (
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">{instance.template.name}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">{instance.employee.fullName}</h1>

          <div className="mt-4">
            <StatusBadge status={instance.status} />
          </div>

          {instance.generatedDocument && (
            <div className="mt-6 whitespace-pre-line rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-700">
              {instance.generatedDocument}
            </div>
          )}

          <h2 className="mb-4 mt-8 text-sm font-semibold text-stone-800">Tasdiqlash zanjiri</h2>
          <WorkflowTimeline timeline={instance.timeline} instanceStatus={instance.status} />

          {canDecide && (
            <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5">
              <p className="mb-3 text-sm font-semibold text-stone-800">
                Sizdan javob kutilmoqda: {currentStep?.stepName}
              </p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Izoh (ixtiyoriy)"
                rows={2}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => decide('APPROVED')}
                  disabled={isActing}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  Tasdiqlash
                </button>
                <button
                  onClick={() => decide('REJECTED')}
                  disabled={isActing}
                  className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  Rad etish
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
