'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Modal } from '@/components/hr/Modal';
import { BatchTable } from '@/components/learning-admin/BatchTable';
import {
  RULE_SCOPE_LABEL,
  RULE_STATUS_LABEL,
  RULE_STATUS_STYLE,
  RULE_TYPE_LABEL,
  type AssignmentRuleRow,
  type BatchList,
} from '@/types/learningAdmin';

// Material tahrirlash sahifasidagi "Tayinlovlar" tabi:
// - kursga biriktirilgan global qoidalar va shu kursning lokal qoidalari;
// - global qoidani biriktirish / ajratish, lokal qoida yaratish, qo'lda tayinlash;
// - shu kurs bo'yicha tayinlovlar (xodimlar — har birining ichida).
export function MaterialAssignmentsPanel({ materialId, isPublished }: { materialId: string; isPublished: boolean }) {
  const [data, setData] = useState<BatchList | null>(null);
  const [rules, setRules] = useState<AssignmentRuleRow[] | null>(null);
  const [globalRules, setGlobalRules] = useState<AssignmentRuleRow[]>([]);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [detaching, setDetaching] = useState<AssignmentRuleRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<BatchList>('/learning-admin/batches', { params: { materialId } }).then((res) => setData(res.data));
    api.get<AssignmentRuleRow[]>(`/learning-admin/catalog/${materialId}/rules`).then((res) => setRules(res.data));
  }, [materialId]);

  useEffect(() => {
    load();
  }, [load]);

  function openAttach() {
    setIsAttachOpen(true);
    api
      .get<AssignmentRuleRow[]>('/learning-admin/rules', { params: { scope: 'GLOBAL' } })
      .then((res) => setGlobalRules(res.data.filter((r) => r.status !== 'ARCHIVED')));
  }

  async function attach(rule: AssignmentRuleRow) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ assigned: number }>(`/learning-admin/catalog/${materialId}/rules/${rule.id}`);
      setMessage(
        `"${rule.name}" biriktirildi` +
          (rule.status === 'ACTIVE' && isPublished ? `, ${res.data.assigned} ta xodimga tayinlandi` : ' — qoida faol va kurs nashr qilinganda ishlaydi'),
      );
      setIsAttachOpen(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Biriktirishda xatolik');
    } finally {
      setBusy(false);
    }
  }

  async function detach(cancelAssignments: boolean) {
    if (!detaching) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.delete<{ cancelled: number }>(`/learning-admin/catalog/${materialId}/rules/${detaching.id}`, {
        params: { cancelAssignments: cancelAssignments ? '1' : '0' },
      });
      setMessage(`"${detaching.name}" ajratildi` + (res.data.cancelled ? `, ${res.data.cancelled} ta tayinlov bekor qilindi` : ''));
      setDetaching(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Ajratishda xatolik');
    } finally {
      setBusy(false);
    }
  }

  const attachedIds = new Set((rules ?? []).map((r) => r.id));
  const available = globalRules.filter((r) => !attachedIds.has(r.id));

  return (
    <div className="flex flex-col gap-5">
      {!isPublished && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Material nashr qilinmagan — qoidalarni biriktirish mumkin, ular nashrdan keyin ishlaydi.
        </p>
      )}
      {message && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {/* Qoidalar */}
      <section className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-stone-900">Qoidalar</h3>
            <p className="text-xs text-stone-400">Global qoida — umumiy (bir nechta kursda); lokal — faqat shu kurs uchun.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openAttach}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              + Global qoida biriktirish
            </button>
            <Link
              href={`/learning-admin/rules/new?materialId=${materialId}`}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
            >
              + Lokal qoida
            </Link>
          </div>
        </div>

        {rules === null ? (
          <p className="text-sm text-stone-400">Yuklanmoqda...</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-stone-400">Bu kursga hali qoida biriktirilmagan.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rules.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-3 text-sm">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-medium text-stone-800">{r.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.scope === 'GLOBAL' ? 'bg-indigo-50 text-indigo-700' : 'bg-teal-50 text-teal-700'}`}>
                    {RULE_SCOPE_LABEL[r.scope]}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RULE_STATUS_STYLE[r.status]}`}>{RULE_STATUS_LABEL[r.status]}</span>
                  <span className="text-xs text-stone-400">
                    {RULE_TYPE_LABEL[r.type]} · bajarilish: {r.completionPercent}%
                  </span>
                </span>
                <span className="flex gap-3">
                  <Link href={`/learning-admin/rules/${r.id}`} className="text-sm text-stone-500 hover:text-accent">
                    Ochish
                  </Link>
                  {r.scope === 'GLOBAL' && (
                    <button type="button" onClick={() => setDetaching(r)} className="text-sm text-stone-500 hover:text-rose-600">
                      Ajratish
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tayinlovlar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-stone-900">Tayinlovlar</h3>
        <Link
          href={isPublished ? `/learning-admin/assignments/new?materialId=${materialId}` : '#'}
          aria-disabled={!isPublished}
          className={`rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 ${
            isPublished ? '' : 'pointer-events-none opacity-40'
          }`}
        >
          + Qo&apos;lda tayinlash
        </Link>
      </div>
      {data === null ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : data.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400">
          Bu material hali hech kimga tayinlanmagan.
        </p>
      ) : (
        <BatchTable rows={data.rows} showMaterial={false} />
      )}

      <Modal isOpen={isAttachOpen} title="Global qoida biriktirish" onClose={() => !busy && setIsAttachOpen(false)}>
        <div className="flex flex-col gap-2 text-sm">
          {available.length === 0 ? (
            <p className="text-stone-500">
              Biriktirish uchun global qoida yo&apos;q.{' '}
              <Link href="/learning-admin/rules/new" className="font-medium text-accent hover:underline">
                Yangi global qoida yaratish
              </Link>
            </p>
          ) : (
            available.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={busy}
                onClick={() => attach(r)}
                className="flex flex-col items-start gap-0.5 rounded-lg border border-stone-200 px-3 py-2.5 text-left transition hover:border-accent hover:bg-accent/5 disabled:opacity-50"
              >
                <span className="font-medium text-stone-800">{r.name}</span>
                <span className="text-xs text-stone-400">
                  {RULE_TYPE_LABEL[r.type]} · {RULE_STATUS_LABEL[r.status]}
                  {r.materials.length > 0 && ` · ${r.materials.length} ta kursda`}
                </span>
              </button>
            ))
          )}
        </div>
      </Modal>

      <Modal isOpen={detaching !== null} title="Qoidani ajratish" onClose={() => !busy && setDetaching(null)}>
        {detaching && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-stone-600">
              &quot;{detaching.name}&quot; bu kursdan ajratiladi — boshqa kurslarda ishlashda davom etadi.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => detach(true)}
                className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                Ajratish va shu kurs bo&apos;yicha tayinlovlarini bekor qilish
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => detach(false)}
                className="rounded-lg border border-stone-200 px-4 py-2 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                Faqat ajratish (tayinlovlar qoladi)
              </button>
              <button type="button" onClick={() => setDetaching(null)} className="px-4 py-2 text-stone-500 hover:text-stone-800">
                Bekor qilish
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
