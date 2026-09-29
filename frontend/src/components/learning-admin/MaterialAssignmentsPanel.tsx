'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate } from '@/components/learning/materialUi';
import {
  ASSIGNMENT_REASON_LABEL,
  ASSIGNMENT_SOURCE_LABEL,
  ASSIGNMENT_STATE_LABEL,
  ASSIGNMENT_STATE_STYLE,
  RULE_TYPE_LABEL,
  type AssignmentList,
  type AssignmentRuleRow,
  type AssignmentState,
} from '@/types/learningAdmin';

const STATES: AssignmentState[] = ['NOT_STARTED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED', 'CANCELLED'];

// Material tahrirlash sahifasidagi "Tayinlovlar" tabi: shu materialning
// tayinlovlari, unga bog'langan qoidalar va yangi tayinlash tugmalari.
export function MaterialAssignmentsPanel({ materialId, isPublished }: { materialId: string; isPublished: boolean }) {
  const [data, setData] = useState<AssignmentList | null>(null);
  const [rules, setRules] = useState<AssignmentRuleRow[]>([]);
  const [state, setState] = useState<'' | AssignmentState>('');

  const load = useCallback(() => {
    api.get<AssignmentList>('/learning-admin/assignments', { params: { materialId } }).then((res) => setData(res.data));
    api
      .get<AssignmentRuleRow[]>('/learning-admin/rules')
      .then((res) => setRules(res.data.filter((r) => r.material.id === materialId)));
  }, [materialId]);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(id: string) {
    if (!window.confirm('Tayinlov bekor qilinsinmi?')) return;
    await api.post(`/learning-admin/assignments/${id}/cancel`);
    load();
  }

  const rows = data ? (state ? data.rows.filter((r) => r.state === state) : data.rows) : [];

  return (
    <div className="flex flex-col gap-5">
      {!isPublished && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Material nashr qilinmagan — tayinlash nashrdan keyin mumkin.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href={isPublished ? `/learning-admin/assignments/new?materialId=${materialId}` : '#'}
          aria-disabled={!isPublished}
          className={`rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 ${
            isPublished ? '' : 'pointer-events-none opacity-40'
          }`}
        >
          + Tayinlash
        </Link>
        <Link
          href={isPublished ? `/learning-admin/rules/new?materialId=${materialId}` : '#'}
          aria-disabled={!isPublished}
          className={`rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 ${
            isPublished ? '' : 'pointer-events-none opacity-40'
          }`}
        >
          + Doimiy qoida
        </Link>
      </div>

      {rules.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-stone-800">Qoidalar</p>
          {rules.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm">
              <span>
                <span className="font-medium text-stone-800">{r.name}</span>{' '}
                <span className="text-xs text-stone-400">
                  · {RULE_TYPE_LABEL[r.type]} · {r.isActive ? 'faol' : 'to‘xtatilgan'} · faol tayinlovlar: {r.activeAssignments}
                </span>
              </span>
              <Link href="/learning-admin/rules" className="text-sm text-stone-500 hover:text-accent">
                Boshqarish
              </Link>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setState((cur) => (cur === s ? '' : s))}
              className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition ${
                state === s ? 'border-accent bg-accent/5' : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <span className="text-2xl font-semibold text-stone-900">{data.counts[s]}</span>
              <span className="text-xs text-stone-500">{ASSIGNMENT_STATE_LABEL[s]}</span>
            </button>
          ))}
        </div>
      )}

      {data === null ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400">
          Bu material hali hech kimga tayinlanmagan.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">Xodim</th>
                <th className="px-4 py-3">Sabab / manba</th>
                <th className="px-4 py-3">Muddat</th>
                <th className="px-4 py-3">Holat</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-800">{row.employee.fullName}</p>
                    <p className="text-xs text-stone-400">{row.employee.department ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {row.reason === 'OTHER' && row.reasonText ? row.reasonText : ASSIGNMENT_REASON_LABEL[row.reason]}
                    <span className="block text-xs text-stone-400">
                      {row.rule ? `Qoida: ${row.rule.name}` : ASSIGNMENT_SOURCE_LABEL[row.source]} · {formatDate(row.createdAt)}
                    </span>
                  </td>
                  <td className={`px-4 py-3 ${row.state === 'OVERDUE' ? 'font-medium text-rose-600' : 'text-stone-600'}`}>
                    {row.dueDate ? formatDate(row.dueDate) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ASSIGNMENT_STATE_STYLE[row.state]}`}>
                      {ASSIGNMENT_STATE_LABEL[row.state]}
                    </span>
                    {row.progress && row.state !== 'COMPLETED' && row.state !== 'CANCELLED' && (
                      <span className="ml-2 text-xs text-stone-400">{row.progress.progress}%</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.state !== 'CANCELLED' && row.state !== 'COMPLETED' && (
                      <button type="button" onClick={() => cancel(row.id)} className="text-sm text-stone-500 hover:text-rose-600">
                        Bekor qilish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
