import type { EmploymentRecord } from '@/types/core-hr';

// hr/employees/[id] (History tab) va self-service/history sahifalarida
// bir xil ko'rinishda qayta ishlatiladi.
export function EmploymentHistoryTable({ history }: { history: EmploymentRecord[] | null }) {
  if (history === null) {
    return <p className="text-sm text-stone-400">Yuklanmoqda...</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
            <th className="px-4 py-2.5">Position</th>
            <th className="px-4 py-2.5">Department</th>
            <th className="px-4 py-2.5">Branch</th>
            <th className="px-4 py-2.5">Start Date</th>
            <th className="px-4 py-2.5">End Date</th>
            <th className="px-4 py-2.5">Reason</th>
            <th className="px-4 py-2.5">Changed By</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-sm text-stone-400">
                Tarix yo&apos;q
              </td>
            </tr>
          ) : (
            history.map((r) => (
              <tr key={r.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5">{r.position?.name ?? '—'}</td>
                <td className="px-4 py-2.5">{r.department?.name ?? '—'}</td>
                <td className="px-4 py-2.5">{r.branch?.name ?? '—'}</td>
                <td className="px-4 py-2.5">{new Date(r.startDate).toLocaleDateString('uz-UZ')}</td>
                <td className="px-4 py-2.5">
                  {r.endDate ? new Date(r.endDate).toLocaleDateString('uz-UZ') : <span className="font-medium text-emerald-700">Joriy</span>}
                </td>
                <td className="px-4 py-2.5">{r.reason ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs text-stone-500">{r.changedByUser?.email ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
