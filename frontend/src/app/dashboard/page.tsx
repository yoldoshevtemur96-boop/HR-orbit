'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { PendingStepAction, WorkflowInstanceSummary } from '@/types/workflow';

const APPROVER_ROLES = ['SUPER_ADMIN', 'HR_MANAGER', 'DEPARTMENT_HEAD'];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [myInstances, setMyInstances] = useState<WorkflowInstanceSummary[] | null>(null);
  const [pending, setPending] = useState<PendingStepAction[] | null>(null);
  const [orgInstances, setOrgInstances] = useState<WorkflowInstanceSummary[] | null>(null);

  const canSeeOrgWide = user ? APPROVER_ROLES.includes(user.role) : false;

  useEffect(() => {
    if (!user) return;
    api.get('/workflow/instances/mine').then((res) => setMyInstances(res.data));
    api.get('/workflow/instances/pending-for-me').then((res) => setPending(res.data));
    if (canSeeOrgWide) {
      api.get('/workflow/instances').then((res) => setOrgInstances(res.data));
    }
  }, [user, canSeeOrgWide]);

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Boshqaruv paneli</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Xush kelibsiz</h1>
        </div>
        <Link
          href="/workflow/new"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + Yangi ariza
        </Link>
      </div>

      {/* Javob kutayotgan arizalar — zanjirdagi navbat */}
      {pending && pending.length > 0 && (
        <Section title="Javobingiz kutilmoqda" count={pending.length}>
          <div className="flex flex-col gap-2">
            {pending.map((p) => (
              <Link
                key={p.id}
                href={`/workflow/${p.instance.id}`}
                className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 transition hover:border-amber-300"
              >
                <div>
                  <p className="text-sm font-semibold text-stone-800">{p.instance.template.name}</p>
                  <p className="text-xs text-stone-500">
                    {p.instance.employee?.fullName} · {p.step.name}
                  </p>
                </div>
                <span className="text-xs font-medium text-amber-700">Ko&apos;rib chiqish →</span>
              </Link>
            ))}
          </div>
        </Section>
      )}
      {pending && pending.length === 0 && (
        <Section title="Javobingiz kutilmoqda">
          <EmptyState text="Hozircha sizdan javob kutilayotgan ariza yo'q." />
        </Section>
      )}

      {/* Mening arizalarim */}
      <Section title="Mening arizalarim">
        {myInstances === null ? (
          <LoadingRow />
        ) : myInstances.length === 0 ? (
          <EmptyState text="Hali ariza yubormagansiz." />
        ) : (
          <InstanceTable instances={myInstances} />
        )}
      </Section>

      {/* Tashkilot bo'yicha barcha arizalar — faqat HR/rahbar/bo'lim boshlig'i */}
      {canSeeOrgWide && (
        <Section title="Tashkilotdagi barcha arizalar">
          {orgInstances === null ? (
            <LoadingRow />
          ) : orgInstances.length === 0 ? (
            <EmptyState text="Hozircha ariza yo'q." />
          ) : (
            <InstanceTable instances={orgInstances} showEmployee />
          )}
        </Section>
      )}
    </AppShell>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600">{count}</span>
        )}
      </h2>
      {children}
    </section>
  );
}

function InstanceTable({
  instances,
  showEmployee,
}: {
  instances: WorkflowInstanceSummary[];
  showEmployee?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <tbody>
          {instances.map((i) => (
            <tr key={i.id} className="border-b border-stone-100 last:border-0">
              <td className="px-4 py-3">
                <Link href={`/workflow/${i.id}`} className="font-medium text-stone-800 hover:text-accent">
                  {i.template.name}
                </Link>
                {showEmployee && i.employee && (
                  <p className="mt-0.5 text-xs text-stone-500">{i.employee.fullName}</p>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-stone-400">
                {new Date(i.createdAt).toLocaleDateString('uz-UZ')}
              </td>
              <td className="px-4 py-3 text-right">
                <StatusBadge status={i.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white px-4 py-6 text-center text-sm text-stone-400">
      {text}
    </div>
  );
}

function LoadingRow() {
  return <div className="rounded-lg border border-stone-200 bg-white px-4 py-6 text-sm text-stone-400">Yuklanmoqda...</div>;
}
