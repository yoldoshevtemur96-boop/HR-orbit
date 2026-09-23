'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Drawer } from '@/components/hr/Drawer';
import type { AttendanceDayStatus, AttendanceRecord, ScopedEmployee } from '@/types/attendance';

const STATUS_OPTIONS: { value: AttendanceDayStatus; label: string }[] = [
  { value: 'PRESENT', label: 'Keldi (avtomatik hisoblash)' },
  { value: 'ABSENT', label: 'Kelmadi' },
  { value: 'ON_LEAVE', label: "Ta'tilda" },
  { value: 'BUSINESS_TRIP', label: 'Safarda' },
  { value: 'REMOTE', label: 'Masofaviy' },
  { value: 'SICK', label: 'Bemor' },
];

interface AttendanceRecordEditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employee: ScopedEmployee | null;
  date: string;
  existingRecord: AttendanceRecord | null;
  onSaved: () => void;
}

function toTimeInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeToIso(date: string, time: string): string | null {
  if (!time) return null;
  return new Date(`${date}T${time}:00`).toISOString();
}

export function AttendanceRecordEditDrawer({
  isOpen,
  onClose,
  employee,
  date,
  existingRecord,
  onSaved,
}: AttendanceRecordEditDrawerProps) {
  const [checkInTime, setCheckInTime] = useState(() => toTimeInputValue(existingRecord?.checkInTime ?? null));
  const [checkOutTime, setCheckOutTime] = useState(() => toTimeInputValue(existingRecord?.checkOutTime ?? null));
  const [status, setStatus] = useState<AttendanceDayStatus | ''>('');
  const [note, setNote] = useState(existingRecord?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!employee) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/attendance/records', {
        employeeId: employee!.id,
        date,
        checkInTime: status ? null : timeToIso(date, checkInTime),
        checkOutTime: status ? null : timeToIso(date, checkOutTime),
        status: status || undefined,
        note: note || undefined,
      });
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Saqlashda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Drawer isOpen={isOpen} title={`${employee.fullName} — ${date}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Holat</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AttendanceDayStatus | '')}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          >
            <option value="">Kirish/chiqish vaqti bo&apos;yicha</option>
            {STATUS_OPTIONS.filter((o) => o.value !== 'PRESENT').map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {!status && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">Kirish vaqti</label>
              <input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">Chiqish vaqti</label>
              <input
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Izoh</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
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
          {isSubmitting ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </form>
    </Drawer>
  );
}
