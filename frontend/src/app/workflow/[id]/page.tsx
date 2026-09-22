'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { WorkflowTimeline } from '@/components/WorkflowTimeline';
import type { WorkflowInstanceDetail } from '@/types/workflow';

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Jarayonda',
  APPROVED: 'Tasdiqlandi',
  REJECTED: 'Rad etildi',
  CANCELLED: 'Bekor qilindi',
};

// Bitta arizaning to'liq kuzatuv ekrani — "kimga bordi, kim imzolamay
// turibdi" savolining javobi shu sahifada. Xodim ham, HR ham xuddi shu
// sahifadan foydalanadi (huquqlar backendda cheklanadi).
export default function WorkflowInstancePage() {
  const params = useParams<{ id: string }>();
  const [instance, setInstance] = useState<WorkflowInstanceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<WorkflowInstanceDetail>(`/workflow/instances/${params.id}`)
      .then((res) => setInstance(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? "Ariza yuklanmadi"));
  }, [params.id]);

  if (error) {
    return <p className="p-8 text-sm text-rose-600">{error}</p>;
  }
  if (!instance) {
    return <p className="p-8 text-sm text-stone-500">Yuklanmoqda...</p>;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        {instance.template.name}
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">
        {instance.employee.fullName}
      </h1>
      <p className="mt-1 text-sm text-stone-500">{instance.employee.position}</p>

      <span className="mt-4 inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
        {STATUS_LABEL[instance.status]}
      </span>

      {instance.generatedDocument && (
        <div className="mt-6 whitespace-pre-line rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-700">
          {instance.generatedDocument}
        </div>
      )}

      <h2 className="mt-8 mb-4 text-sm font-semibold text-stone-800">Tasdiqlash zanjiri</h2>
      <WorkflowTimeline timeline={instance.timeline} instanceStatus={instance.status} />
    </main>
  );
}
