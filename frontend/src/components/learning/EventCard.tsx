'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { LearningEvent } from '@/types/learning';

function formatEventDate(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long', weekday: 'short' });
  const time = (d: Date) => d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time(start)}–${time(end)}`;
}

// Tadbir kartochkasi: sana, format, joy/havola, o'rinlar va xodim amali
// (yozilish, bekor qilish yoki tasdiq talab qilinsa — so'rov yuborish).
export function EventCard({
  event,
  compact = false,
  onChanged,
}: {
  event: LearningEvent;
  compact?: boolean;
  onChanged?: () => void;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = new Date(event.startsAt);
  const isPast = new Date(event.endsAt) < new Date();
  const isRegistered = event.myRegistration?.status === 'REGISTERED' || event.myRegistration?.status === 'ATTENDED';
  const seatsLeft = event.capacity !== null ? Math.max(0, event.capacity - event.registeredCount) : null;
  const needsApproval = event.requiresApproval && event.myRequest?.status !== 'APPROVED';

  async function run(action: () => Promise<unknown>) {
    setIsBusy(true);
    setError(null);
    try {
      await action();
      onChanged?.();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Xatolik yuz berdi');
    } finally {
      setIsBusy(false);
    }
  }

  let action: React.ReactNode = null;
  if (!compact && !isPast) {
    if (isRegistered) {
      action = (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => run(() => api.delete(`/learning/events/${event.id}/register`))}
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
        >
          Yozilishni bekor qilish
        </button>
      );
    } else if (needsApproval) {
      action =
        event.myRequest?.status === 'PENDING' ? (
          <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">So&apos;rov ko&apos;rib chiqilmoqda</span>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => run(() => api.post('/learning/requests', { eventId: event.id }))}
            className="rounded-lg border border-accent px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent/5 disabled:opacity-50"
          >
            Rahbardan so&apos;rash
          </button>
        );
    } else if (seatsLeft === 0) {
      action = <span className="text-sm text-stone-400">O&apos;rin qolmagan</span>;
    } else {
      action = (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => run(() => api.post(`/learning/events/${event.id}/register`))}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          Yozilish
        </button>
      );
    }
  }

  return (
    <div className={`flex gap-4 rounded-xl border border-stone-200 bg-white ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex w-14 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-amber-50 py-2 text-amber-700">
        <span className="text-lg font-bold leading-none">{start.getDate()}</span>
        <span className="mt-1 text-[11px] uppercase">{start.toLocaleDateString('uz-UZ', { month: 'short' })}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
              event.format === 'ONLINE' ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'
            }`}
          >
            {event.format === 'ONLINE' ? 'onlayn' : 'oflayn'}
          </span>
          {event.requiresApproval && <span className="text-xs text-stone-400">rahbar tasdig&apos;i bilan</span>}
          {isRegistered && <span className="text-xs font-medium text-emerald-700">✓ siz yozilgansiz</span>}
        </div>
        <p className="text-sm font-semibold text-stone-800">{event.title}</p>
        <p className="text-xs text-stone-500">{formatEventDate(event.startsAt, event.endsAt)}</p>
        {!compact && (
          <>
            {event.description && <p className="text-sm text-stone-600">{event.description}</p>}
            <p className="text-xs text-stone-400">
              {event.format === 'OFFLINE' ? event.location ?? 'Joy aniqlanmagan' : 'Onlayn'}
              {event.speaker && ` · Spiker: ${event.speaker}`}
              {seatsLeft !== null && ` · ${seatsLeft} ta bo'sh o'rin`}
            </p>
            {isRegistered && event.format === 'ONLINE' && event.meetingUrl && (
              <a
                href={event.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-accent hover:underline"
              >
                Ulanish havolasi →
              </a>
            )}
          </>
        )}
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
      {action && <div className="flex flex-shrink-0 items-start">{action}</div>}
    </div>
  );
}
