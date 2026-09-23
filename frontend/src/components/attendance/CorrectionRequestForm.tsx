'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface CorrectionRequestFormProps {
  employeeId: string;
  employeeName: string;
  onCreated: () => void;
  presetDate?: string;
}

// Faqat departament rahbari ishlatadi — bitta oldindan tanlangan xodim
// uchun tuzatish so'rovi yuboradi. UI sodda: faqat izoh yoziladi, sabab
// va aniq vaqtlarni TIMEKEEPER izohni o'qib, kunlik jadvaldagi
// "Tuzatish" tugmasi orqali o'zi kiritadi.
export function CorrectionRequestForm({ employeeId, employeeName, onCreated, presetDate }: CorrectionRequestFormProps) {
  const date = presetDate ?? todayIso();
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) {
      setError('Izoh yozish shart');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/attendance/corrections', { employeeId, date, comment: comment.trim() });
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
        <label className="mb-1 block text-xs font-medium text-stone-500">Xodim</label>
        <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">{employeeName}</p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">Sana</label>
        <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">{date}</p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">Izoh</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          autoFocus
          placeholder="Masalan: turniket ishlamadi, soat 9:15da keldi..."
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
