'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { BatchTable } from '@/components/learning-admin/BatchTable';
import { RULE_STATUS_LABEL, RULE_TYPE_LABEL, type AssignmentRuleRow, type BatchList } from '@/types/learningAdmin';

// Material tahrirlash sahifasidagi "Tayinlovlar" tabi: shu materialning
// tayinlovlari (xodimlar — har birining ichida), bog'langan qoidalar va
// yangi tayinlash tugmalari.
export function MaterialAssignmentsPanel({ materialId, isPublished }: { materialId: string; isPublished: boolean }) {
  const [data, setData] = useState<BatchList | null>(null);
  const [rules, setRules] = useState<AssignmentRuleRow[]>([]);

  useEffect(() => {
    api.get<BatchList>('/learning-admin/batches', { params: { materialId } }).then((res) => setData(res.data));
    api
      .get<AssignmentRuleRow[]>('/learning-admin/rules')
      .then((res) => setRules(res.data.filter((r) => r.material.id === materialId && r.status !== 'ARCHIVED')));
  }, [materialId]);

  return (
    <div className="flex flex-col gap-5">
      {!isPublished && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Material nashr qilinmagan — tayinlash nashrdan keyin mumkin.</p>
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
                  · {RULE_TYPE_LABEL[r.type]} · {RULE_STATUS_LABEL[r.status].toLowerCase()} · bajarilish: {r.completionPercent}%
                </span>
              </span>
              <Link href="/learning-admin/rules" className="text-sm text-stone-500 hover:text-accent">
                Boshqarish
              </Link>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm font-semibold text-stone-800">Tayinlovlar</p>
      {data === null ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : data.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400">
          Bu material hali hech kimga tayinlanmagan.
        </p>
      ) : (
        <BatchTable rows={data.rows} showMaterial={false} />
      )}
    </div>
  );
}
