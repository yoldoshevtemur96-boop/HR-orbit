'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { EmploymentHistoryTable } from '@/components/hr/EmploymentHistoryTable';
import type { EmploymentRecord } from '@/types/core-hr';

export default function MyEmploymentHistoryPage() {
  const [history, setHistory] = useState<EmploymentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/hr/employees/me')
      .then((res) => api.get<EmploymentRecord[]>(`/hr/employees/${res.data.id}/history`))
      .then((res) => setHistory(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik yuz berdi'));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Self-Service</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Mening ish faoliyatim tarixi</h1>
      </div>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <EmploymentHistoryTable history={history} />
    </div>
  );
}
