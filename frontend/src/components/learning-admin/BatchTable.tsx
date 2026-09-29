'use client';

import Link from 'next/link';
import { MATERIAL_TYPE_LABEL, ProgressBar, formatDate } from '@/components/learning/materialUi';
import { ASSIGNMENT_SOURCE_LABEL, BATCH_STATE_LABEL, BATCH_STATE_STYLE, type BatchRow } from '@/types/learningAdmin';

function dueText(b: BatchRow) {
  if (b.dueDate) return formatDate(b.dueDate);
  if (b.dueInDays) return `${b.dueInDays} kun ichida`;
  return '—';
}

// Tayinlovlar jadvali: har bir qator — bitta tayinlash amali (partiya)
export function BatchTable({ rows, showMaterial = true }: { rows: BatchRow[]; showMaterial?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
            <th className="px-4 py-3">Tayinlov</th>
            {showMaterial && <th className="px-4 py-3">Material</th>}
            <th className="px-4 py-3">Kimga</th>
            <th className="px-4 py-3">Muddat</th>
            <th className="px-4 py-3">Bajarilish</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
              <td className="px-4 py-3">
                <Link href={`/learning-admin/assignments/${b.id}`} className="font-medium text-stone-800 hover:text-accent">
                  {b.name}
                </Link>
                <p className="text-xs text-stone-400">
                  {b.rule ? 'Qoida' : ASSIGNMENT_SOURCE_LABEL[b.source]}
                  {b.createdBy && ` · ${b.createdBy}`} · {formatDate(b.createdAt)}
                </p>
              </td>
              {showMaterial && (
                <td className="px-4 py-3">
                  <p className="text-stone-700">{b.material.title}</p>
                  <p className="text-xs text-stone-400">{MATERIAL_TYPE_LABEL[b.material.type]}</p>
                </td>
              )}
              <td className="px-4 py-3 text-stone-600">
                {b.audienceSummary ?? '—'}
                <span className="block text-xs text-stone-400">{b.total} ta xodim</span>
              </td>
              <td className="px-4 py-3 text-stone-600">{dueText(b)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <ProgressBar value={b.completionPercent} className="w-24" />
                  <span className="text-xs font-semibold text-stone-700">{b.completionPercent}%</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${BATCH_STATE_STYLE[b.state]}`}>
                    {BATCH_STATE_LABEL[b.state]}
                  </span>
                  <span className="text-[11px] text-stone-400">
                    {b.completed}/{b.total}
                    {b.overdue > 0 && <span className="text-rose-600"> · {b.overdue} muddati o&apos;tgan</span>}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
