'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { DashboardSummary } from '@/types/core-hr';

export default function HrDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardSummary>('/hr/dashboard/summary')
      .then((res) => setSummary(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik yuz berdi'));
  }, []);

  if (error) {
    return <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>;
  }
  if (!summary) {
    return <p className="text-sm text-stone-400">Yuklanmoqda...</p>;
  }

  const kpis = [
    { label: 'Jami xodimlar', value: summary.kpi.totalEmployees },
    { label: 'Faol xodimlar', value: summary.kpi.activeEmployees },
    { label: "Ta'tilda", value: summary.kpi.onLeaveEmployees },
    { label: 'Yangi (30 kun)', value: summary.kpi.newEmployees },
    { label: 'Ishdan boʻshaganlar', value: summary.kpi.terminatedEmployees },
    { label: "Bo'sh o'rinlar", value: summary.kpi.vacantPositions },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Core HR</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Boshqaruv paneli</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-2xl font-semibold text-stone-900">{kpi.value}</p>
            <p className="mt-1 text-xs text-stone-500">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <BreakdownTable title="Bo'lim bo'yicha" rows={summary.byDepartment.map((d) => ({ label: d.departmentName, count: d.count }))} />
        <BreakdownTable title="Filial bo'yicha" rows={summary.byBranch.map((b) => ({ label: b.branchName, count: b.count }))} />
        <BreakdownTable title="Holat bo'yicha" rows={summary.byStatus.map((s) => ({ label: s.status, count: s.count }))} />
      </div>
    </div>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-stone-700">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-400">Ma'lumot yo'q</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between text-sm">
              <span className="text-stone-600">{row.label}</span>
              <span className="font-medium text-stone-900">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
