'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import type { WorkflowInstanceSummary } from '@/types/workflow';

// "Draft" holati backend'da yo'q (Workflow Engine har doim create=darhol
// jarayonga tushadi). Shuning uchun "Submitted"/"In Review" farqi sof
// taqdimot mantig'i — backend qiymatlarini o'zgartirmasdan hisoblanadi.
function requestStatusLabel(instance: WorkflowInstanceSummary): { label: string; status: string } {
  if (instance.status === 'IN_PROGRESS') {
    return instance.currentStepOrder > 1
      ? { label: 'Koʻrib chiqilmoqda', status: 'IN_PROGRESS' }
      : { label: 'Yuborildi', status: 'IN_PROGRESS' };
  }
  return { label: instance.status, status: instance.status };
}

export default function MyRequestsPage() {
  const [instances, setInstances] = useState<WorkflowInstanceSummary[] | null>(null);

  useEffect(() => {
    api.get<WorkflowInstanceSummary[]>('/workflow/instances/mine').then((res) => setInstances(res.data));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Self-Service</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Mening so&apos;rovlarim</h1>
        </div>
        <Link
          href="/self-service/requests/new"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + Yangi so&apos;rov
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        {instances === null ? (
          <p className="p-5 text-sm text-stone-400">Yuklanmoqda...</p>
        ) : instances.length === 0 ? (
          <p className="p-5 text-sm text-stone-400">Hali so&apos;rov yubormagansiz.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {instances.map((instance) => {
                const { label } = requestStatusLabel(instance);
                return (
                  <tr key={instance.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/workflow/${instance.id}`} className="font-medium text-stone-800 hover:text-accent">
                        {instance.template.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-400">
                      {new Date(instance.createdAt).toLocaleDateString('uz-UZ')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {instance.status === 'IN_PROGRESS' ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                          {label}
                        </span>
                      ) : (
                        <StatusBadge status={instance.status} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
