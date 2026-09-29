'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Modal } from '@/components/hr/Modal';
import { ProgressBar, formatDate } from '@/components/learning/materialUi';
import {
  ASSIGNMENT_REASON_LABEL,
  RULE_STATUS_LABEL,
  RULE_STATUS_STYLE,
  RULE_TYPE_LABEL,
  type AssignmentRuleRow,
  type RuleStatus,
} from '@/types/learningAdmin';

const STATUS_TABS: ('' | RuleStatus)[] = ['', 'ACTIVE', 'DRAFT', 'STOPPED', 'COMPLETED', 'ARCHIVED'];

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

type Confirm = { rule: AssignmentRuleRow; action: 'stop' | 'archive' } | null;

export default function RulesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-400">Yuklanmoqda...</p>}>
      <Rules />
    </Suspense>
  );
}

function Rules() {
  const searchParams = useSearchParams();
  const [rules, setRules] = useState<AssignmentRuleRow[] | null>(null);
  const [status, setStatus] = useState<'' | RuleStatus>('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(searchParams.get('msg'));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

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
      setConfirm(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Xatolik yuz berdi');
    } finally {
      setBusyId(null);
    }
  }

  const run = (rule: AssignmentRuleRow) =>
    act(rule, async () => {
      const res = await api.post<{ assigned: number; cancelled: number }>(`/learning-admin/rules/${rule.id}/run`);
      return `"${rule.name}": ${res.data.assigned} ta yangi tayinlov` + (res.data.cancelled ? `, ${res.data.cancelled} ta bekor qilindi` : '');
    });

  const activate = (rule: AssignmentRuleRow) =>
    act(rule, async () => {
      const res = await api.post<{ assigned: number }>(`/learning-admin/rules/${rule.id}/activate`);
      return `"${rule.name}" faollashtirildi, ${res.data.assigned} ta xodimga tayinlandi`;
    });

  const copy = (rule: AssignmentRuleRow) =>
    act(rule, async () => {
      await api.post(`/learning-admin/rules/${rule.id}/copy`);
      return `"${rule.name}" nusxasi qoralama sifatida yaratildi`;
    });

  const finish = (rule: AssignmentRuleRow, action: 'stop' | 'archive', cancelAssignments: boolean) =>
    act(rule, async () => {
      const res = await api.post<{ cancelled: number }>(`/learning-admin/rules/${rule.id}/${action}`, { cancelAssignments });
      const verb = action === 'stop' ? "to'xtatildi" : 'arxivlandi';
      return `"${rule.name}" ${verb}` + (res.data.cancelled ? `, ${res.data.cancelled} ta tayinlov bekor qilindi` : '');
    });

  const tags = [...new Set((rules ?? []).map((r) => r.tag).filter(Boolean) as string[])].sort();
  const visible = (rules ?? []).filter(
    (r) => (status ? r.status === status : r.status !== 'ARCHIVED') && (!tag || r.tag === tag),
  );
  const countOf = (s: '' | RuleStatus) => (rules ?? []).filter((r) => (s ? r.status === s : r.status !== 'ARCHIVED')).length;

  const btn = 'rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="font-display text-2xl font-semibold text-stone-900">Qoidalar</h1>
          <p className="mt-1 text-sm text-stone-500">
            Qoida shartga mos xodimlarga materialni avtomatik tayinlaydi. <b>Doimiy</b> qoida yangi kelgan yoki boshqa bo&apos;limga
            o&apos;tgan xodimlarga ham tayinlaydi, shartdan chiqqanlarning tugallanmagan tayinlovini bekor qiladi.
          </p>
        </div>
        <Link href="/learning-admin/rules/new" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
          + Yangi qoida
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200">
        <nav className="flex gap-1">
          {STATUS_TABS.map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setStatus(s)}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                status === s ? 'border-accent text-accent' : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              {s ? RULE_STATUS_LABEL[s] : 'Barchasi'}
              {rules && <span className="ml-1.5 text-xs text-stone-400">{countOf(s)}</span>}
            </button>
          ))}
        </nav>
        {tags.length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)} className="mb-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm">
            <option value="">Barcha teglar</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
        )}
      </div>

      {message && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {rules === null ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400">
          {rules.length === 0
            ? 'Hali qoida yo‘q. Masalan: "Barcha yangi xodimlarga — Axborot xavfsizligi, 14 kun ichida".'
            : 'Bu holatda qoida yo‘q.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((rule) => {
            const busy = busyId === rule.id;
            const total = rule.activeAssignments + rule.completedAssignments;
            return (
              <div key={rule.id} className={`flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-5 ${rule.status === 'ARCHIVED' ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-stone-900">{rule.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RULE_STATUS_STYLE[rule.status]}`}>
                        {RULE_STATUS_LABEL[rule.status]}
                      </span>
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">{RULE_TYPE_LABEL[rule.type]}</span>
                      {rule.tag && <span className="text-xs text-stone-400">#{rule.tag}</span>}
                    </div>
                    {rule.description && <p className="text-sm text-stone-500">{rule.description}</p>}
                    <p className="text-sm text-stone-700">
                      <Link href={`/learning-admin/catalog/${rule.material.id}`} className="font-medium hover:text-accent">
                        {rule.material.title}
                      </Link>
                    </p>
                    <p className="text-xs text-stone-500">Kimga: {audienceText(rule)}</p>
                    <p className="text-xs text-stone-400">
                      {rule.reason === 'OTHER' && rule.reasonText ? rule.reasonText : ASSIGNMENT_REASON_LABEL[rule.reason]} · {dueText(rule)}
                      {rule.skipIfCompletedWithinDays && ` · ${rule.skipIfCompletedWithinDays} kun ichida o'tganlarga tayinlanmaydi`}
                      {rule.lastRunAt && ` · oxirgi ishga tushgan: ${new Date(rule.lastRunAt).toLocaleString('uz-UZ')}`}
                    </p>
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap gap-2">
                    {rule.status === 'ACTIVE' && rule.type === 'PERMANENT' && (
                      <button type="button" disabled={busy} onClick={() => run(rule)} className={btn}>
                        Hozir ishga tushirish
                      </button>
                    )}
                    {rule.status === 'ACTIVE' && rule.type === 'PERMANENT' && (
                      <button type="button" disabled={busy} onClick={() => setConfirm({ rule, action: 'stop' })} className={btn}>
                        To&apos;xtatish
                      </button>
                    )}
                    {(rule.status === 'DRAFT' || rule.status === 'STOPPED') && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => activate(rule)}
                          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          Faollashtirish
                        </button>
                        <Link href={`/learning-admin/rules/${rule.id}`} className={btn}>
                          Tahrirlash
                        </Link>
                      </>
                    )}
                    <button type="button" disabled={busy} onClick={() => copy(rule)} className={btn}>
                      Nusxa
                    </button>
                    {rule.status !== 'ARCHIVED' && rule.status !== 'ACTIVE' && (
                      <button type="button" disabled={busy} onClick={() => setConfirm({ rule, action: 'archive' })} className={`${btn} text-stone-500`}>
                        Arxiv
                      </button>
                    )}
                  </div>
                </div>

                {rule.status !== 'DRAFT' && (
                  <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3 text-xs text-stone-500">
                    <span className="font-medium text-stone-700">
                      {total === 0 ? 'Tayinlov yo‘q' : rule.completionPercent === 100 ? 'Bajarildi' : 'Jarayonda'}
                    </span>
                    <ProgressBar value={rule.completionPercent} className="w-40" />
                    <span>{rule.completionPercent}%</span>
                    <Link href={`/learning-admin/assignments?materialId=${rule.material.id}`} className="hover:text-accent">
                      {rule.completedAssignments} tugatgan · {rule.activeAssignments} jarayonda
                    </Link>
                    {rule.cancelledAssignments > 0 && <span>· {rule.cancelledAssignments} bekor qilingan</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={confirm !== null}
        title={confirm?.action === 'stop' ? "Qoidani to'xtatish" : 'Qoidani arxivlash'}
        onClose={() => busyId === null && setConfirm(null)}
      >
        {confirm && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-stone-600">
              &quot;{confirm.rule.name}&quot;{' '}
              {confirm.action === 'stop'
                ? "to'xtatiladi — yangi xodimlarga tayinlamaydi. Keyin tahrirlab, qayta faollashtirish mumkin."
                : 'arxivga olinadi.'}
            </p>
            {confirm.rule.activeAssignments > 0 && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">
                Bu qoida bergan {confirm.rule.activeAssignments} ta tugallanmagan tayinlov bor.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {confirm.rule.activeAssignments > 0 && (
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => finish(confirm.rule, confirm.action, true)}
                  className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  Tayinlovlarni ham bekor qilish
                </button>
              )}
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => finish(confirm.rule, confirm.action, false)}
                className="rounded-lg border border-stone-200 px-4 py-2 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                {confirm.rule.activeAssignments > 0 ? 'Tayinlovlar qolsin' : confirm.action === 'stop' ? "To'xtatish" : 'Arxivlash'}
              </button>
              <button type="button" onClick={() => setConfirm(null)} className="px-4 py-2 text-stone-500 hover:text-stone-800">
                Bekor qilish
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
