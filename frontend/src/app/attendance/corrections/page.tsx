'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CorrectionStatusBadge } from '@/components/attendance/CorrectionStatusBadge';
import { useAuthStore } from '@/store/authStore';
import type { AttendanceCorrection } from '@/types/attendance';

const REASON_LABEL: Record<string, string> = {
  DEVICE_FAILURE: 'Qurilma ishlamadi',
  WRONG_CHECK_IN: "Kirish vaqti noto'g'ri",
  WRONG_CHECK_OUT: "Chiqish vaqti noto'g'ri",
};

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Bu sahifa endi ikki auditoriya uchun: DEPARTMENT_HEAD o'zi yuborgan
// so'rovlarni kuzatadi ("Men yuborganlar"), HR/Timekeeper esa o'ziga
// kelgan so'rovlarni tasdiqlaydi/rad etadi ("Menga kelgan"). Yangi so'rov
// endi faqat /attendance/daily'dagi qalam (✏️) tugmasi orqali yuboriladi.
export default function CorrectionsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user ? ['SUPER_ADMIN', 'HR_MANAGER', 'TIMEKEEPER'].includes(user.role) : false;
  const isDeptHead = user?.role === 'DEPARTMENT_HEAD';

  const [mine, setMine] = useState<AttendanceCorrection[] | null>(null);
  const [pending, setPending] = useState<AttendanceCorrection[] | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (isDeptHead) {
      api.get<AttendanceCorrection[]>('/attendance/corrections/mine').then((res) => setMine(res.data));
    }
    if (canManage) {
      api.get<AttendanceCorrection[]>('/attendance/corrections/pending').then((res) => setPending(res.data));
    }
  }, [canManage, isDeptHead]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFinalize(id: string, decision: 'APPROVED' | 'REJECTED') {
    setActioningId(id);
    try {
      await api.post(`/attendance/corrections/${id}/finalize`, { decision });
      load();
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Attendance</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Davomat tuzatish so&apos;rovlari</h1>
      </div>

      {canManage && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-stone-700">Menga kelgan (tabelchi bosqichi)</h2>
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
            {pending === null ? (
              <p className="p-5 text-sm text-stone-400">Yuklanmoqda...</p>
            ) : pending.length === 0 ? (
              <p className="p-5 text-sm text-stone-400">Hozircha so&apos;rov yo&apos;q.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {pending.map((c) => (
                    <tr key={c.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-stone-800">{c.employee?.fullName ?? '—'}</td>
                      <td className="px-4 py-3 text-stone-700">{c.date.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-stone-500">{REASON_LABEL[c.reasonType]}</td>
                      <td className="px-4 py-3 text-stone-500">
                        {formatTime(c.requestedCheckIn)} — {formatTime(c.requestedCheckOut)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            disabled={actioningId === c.id}
                            onClick={() => handleFinalize(c.id, 'APPROVED')}
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                          >
                            Tasdiqlash
                          </button>
                          <button
                            type="button"
                            disabled={actioningId === c.id}
                            onClick={() => handleFinalize(c.id, 'REJECTED')}
                            className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            Rad etish
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {isDeptHead && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-stone-700">Men yuborgan so&apos;rovlar</h2>
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
            {mine === null ? (
              <p className="p-5 text-sm text-stone-400">Yuklanmoqda...</p>
            ) : mine.length === 0 ? (
              <p className="p-5 text-sm text-stone-400">
                Hali so&apos;rov yubormagansiz — kunlik davomat jadvalidagi ✏️ tugmasi orqali yuboring.
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {mine.map((c) => (
                    <tr key={c.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-stone-800">{c.employee?.fullName ?? '—'}</td>
                      <td className="px-4 py-3 text-stone-700">{c.date.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-stone-500">{REASON_LABEL[c.reasonType]}</td>
                      <td className="px-4 py-3 text-stone-500">
                        {formatTime(c.requestedCheckIn)} — {formatTime(c.requestedCheckOut)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <CorrectionStatusBadge status={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
