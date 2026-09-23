'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { CorrectionReasonType } from '@/types/attendance';

const REASON_OPTIONS: { value: CorrectionReasonType; label: string }[] = [
  { value: 'DEVICE_FAILURE', label: "Turniket/qurilma ishlamadi" },
  { value: 'WRONG_CHECK_IN', label: "Kirish vaqtim noto'g'ri qayd etilgan" },
  { value: 'WRONG_CHECK_OUT', label: "Chiqish vaqtim noto'g'ri qayd etilgan" },
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface CorrectionRequestFormProps {
  onCreated: () => void;
  presetDate?: string;
  presetReasonType?: CorrectionReasonType;
}

export function CorrectionRequestForm({ onCreated, presetDate, presetReasonType }: CorrectionRequestFormProps) {
  const [date, setDate] = useState(presetDate ?? todayIso());
  const [reasonType, setReasonType] = useState<CorrectionReasonType>(presetReasonType ?? 'WRONG_CHECK_IN');
  const [requestedCheckIn, setRequestedCheckIn] = useState('');
  const [requestedCheckOut, setRequestedCheckOut] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/attendance/corrections', {
        date,
        reasonType,
        requestedCheckIn: requestedCheckIn ? new Date(`${date}T${requestedCheckIn}:00`).toISOString() : undefined,
        requestedCheckOut: requestedCheckOut ? new Date(`${date}T${requestedCheckOut}:00`).toISOString() : undefined,
        comment: comment || undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "So'rov yuborishda xatolik yuz berdi");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">Sana</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          disabled={Boolean(presetDate)}
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:bg-stone-50 disabled:text-stone-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">Sabab</label>
        <select
          value={reasonType}
          onChange={(e) => setReasonType(e.target.value as CorrectionReasonType)}
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
        >
          {REASON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">To&apos;g&apos;ri kirish vaqti</label>
          <input
            type="time"
            value={requestedCheckIn}
            onChange={(e) => setRequestedCheckIn(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">To&apos;g&apos;ri chiqish vaqti</label>
          <input
            type="time"
            value={requestedCheckOut}
            onChange={(e) => setRequestedCheckOut(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">Izoh</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
      </div>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? 'Yuborilmoqda...' : "So'rovni yuborish"}
      </button>
    </form>
  );
}
