'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate } from '@/components/learning/materialUi';
import { ASSIGNMENT_REASON_LABEL, RULE_TYPE_LABEL, type AssignmentRuleRow } from '@/types/learningAdmin';

function audienceText(rule: AssignmentRuleRow) {
  const parts: string[] = [];
  if (rule.audience.allOrganization) parts.push('Butun tashkilot');
  if (rule.audience.departments.length) parts.push(`Bo'lim: ${rule.audience.departments.join(', ')}`);
  if (rule.audience.positions.length) parts.push(`Lavozim: ${rule.audience.positions.join(', ')}`);
  if (rule.audience.branches.length) parts.push(`Filial: ${rule.audience.branches.join(', ')}`);
  const base = parts.join(' yoki ') || '—';
  return rule.audience.hiredWithinDays ? `${base} · faqat ishga kirganiga ${rule.audience.hiredWithinDays} kun bo'lmaganlar` : base;
}

function dueText(rule: AssignmentRuleRow) {
  if (rule.dueDate) return `muddat: ${formatDate(rule.dueDate)}`;
  if (rule.dueInDays) return `muddat: ${rule.dueInDays} kun ichida`;
  return 'muddatsiz';
}

export default function RulesPage() {
  const [rules, setRules] = useState<AssignmentRuleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<AssignmentRuleRow[]>('/learning-admin/rules')
      .then((res) => setRules(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik yuz berdi'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(rule: AssignmentRuleRow, action: () => Promise<string>) {
    setBusyId(rule.id);
    setError(null);
    setMessage(null);
    try {
      setMessage(await action());
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Xatolik yuz berdi');
    } finally {
      setBusyId(null);
    }
  }

  function runNow(rule: AssignmentRuleRow) {
    act(rule, async () => {
      const res = await api.post<{ assigned: number; cancelled: number }>(`/learning-admin/rules/${rule.id}/run`);
      return `"${rule.name}": ${res.data.assigned} ta yangi tayinlov` + (res.data.cancelled ? `, ${res.data.cancelled} ta bekor qilindi` : '');
    });
  }

  function deactivate(rule: AssignmentRuleRow) {
    if (!window.confirm(`"${rule.name}" qoidasi to'xtatilsinmi?`)) return;
    const cancelAssignments =
      rule.activeAssignments > 0 &&
      window.confirm(
        `Bu qoida bergan ${rule.activeAssignments} ta faol tayinlov bor.\n\nTugallanmaganlari ham bekor qilinsinmi?\n(OK — bekor qilish, Cancel — qoldirish)`,
      );
    act(rule, async () => {
      const res = await api.post<{ cancelled: number }>(`/learning-admin/rules/${rule.id}/deactivate`, { cancelAssignments });
      return `"${rule.name}" to'xtatildi` + (res.data.cancelled ? `, ${res.data.cancelled} ta tayinlov bekor qilindi` : '');
    });
  }

  function activate(rule: AssignmentRuleRow) {
    act(rule, async () => {
      const res = await api.post<{ assigned: number }>(`/learning-admin/rules/${rule.id}/activate`);
      return `"${rule.name}" yoqildi, ${res.data.assigned} ta yangi tayinlov`;
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="font-display text-2xl font-semibold text-stone-900">Qoidalar</h1>
          <p className="mt-1 text-sm text-stone-500">
          Qoida shartga mos xodimlarga kursni avtomatik tayinlaydi. <b>Doimiy</b> qoida yangi kelgan yoki boshqa bo&apos;limga
          o&apos;tgan xodimlarga ham darhol tayinlaydi, shartdan chiqqanlarning tugallanmagan tayinlovini bekor qiladi.
          </p>
        </div>
        <Link
          href="/learning-admin/rules/new"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + Yangi qoida
        </Link>
      </div>

      {message && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {rules === null ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : rules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400">
          Hali qoida yo&apos;q. Masalan: &quot;Barcha yangi xodimlarga — Axborot xavfsizligi kursi, 14 kun ichida&quot;.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`flex flex-col gap-3 rounded-xl border bg-white p-5 md:flex-row md:items-start md:justify-between ${
                rule.isActive ? 'border-stone-200' : 'border-stone-200 opacity-70'
              }`}
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-stone-900">{rule.name}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      rule.type === 'PERMANENT' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'
                    }`}
                  >
                    {RULE_TYPE_LABEL[rule.type]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      rule.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {rule.isActive ? 'Faol' : rule.type === 'ONE_TIME' ? 'Bajarilgan' : "To'xtatilgan"}
                  </span>
                </div>
                <p className="text-sm text-stone-700">
                  <Link href={`/learning/materials/${rule.material.id}`} className="font-medium hover:text-accent">
                    {rule.material.title}
                  </Link>
                </p>
                <p className="text-xs text-stone-500">Kimga: {audienceText(rule)}</p>
                <p className="text-xs text-stone-400">
                  {rule.reason === 'OTHER' && rule.reasonText ? rule.reasonText : ASSIGNMENT_REASON_LABEL[rule.reason]} · {dueText(rule)}
                  {rule.skipIfCompletedWithinDays && ` · ${rule.skipIfCompletedWithinDays} kun ichida o'tganlarga tayinlanmaydi`}
                  {rule.type === 'PERMANENT' && !rule.cancelOutOfScope && " · shartdan chiqqanlarniki bekor qilinmaydi"}
                </p>
                <p className="text-xs text-stone-400">
                  <Link href={`/learning-admin/assignments?materialId=${rule.material.id}`} className="hover:text-accent">
                    Faol tayinlovlar: {rule.activeAssignments}
                  </Link>
                  {rule.cancelledAssignments > 0 && ` · bekor qilingan: ${rule.cancelledAssignments}`}
                  {rule.lastRunAt && ` · oxirgi ishga tushgan: ${new Date(rule.lastRunAt).toLocaleString('uz-UZ')}`}
                </p>
              </div>

              <div className="flex flex-shrink-0 flex-wrap gap-2">
                {rule.isActive && rule.type === 'PERMANENT' && (
                  <button
                    type="button"
                    disabled={busyId === rule.id}
                    onClick={() => runNow(rule)}
                    className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                  >
                    Hozir ishga tushirish
                  </button>
                )}
                {rule.isActive && rule.type === 'PERMANENT' && (
                  <button
                    type="button"
                    disabled={busyId === rule.id}
                    onClick={() => deactivate(rule)}
                    className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-500 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
                  >
                    To&apos;xtatish
                  </button>
                )}
                {!rule.isActive && rule.type === 'PERMANENT' && (
                  <button
                    type="button"
                    disabled={busyId === rule.id}
                    onClick={() => activate(rule)}
                    className="rounded-lg border border-accent px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent/5 disabled:opacity-50"
                  >
                    Yoqish
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
