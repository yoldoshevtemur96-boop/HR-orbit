'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { AttendanceSettings } from '@/types/attendance';

export default function AttendanceSettingsPage() {
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<AttendanceSettings>('/attendance/settings').then((res) => setSettings(res.data));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    setIsSaving(true);
    try {
      const res = await api.patch<AttendanceSettings>('/attendance/settings', {
        standardStartTime: settings.standardStartTime,
        standardEndTime: settings.standardEndTime,
        standardWorkMinutes: settings.standardWorkMinutes,
        lateThresholdMinutes: settings.lateThresholdMinutes,
      });
      setSettings(res.data);
      setSavedAt(new Date());
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Saqlashda xatolik yuz berdi');
    } finally {
      setIsSaving(false);
    }
  }

  if (!settings) {
    return <p className="text-sm text-stone-400">Yuklanmoqda...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Attendance</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Davomat sozlamalari</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4 rounded-lg border border-stone-200 bg-white p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Standart boshlanish vaqti</label>
          <input
            type="time"
            value={settings.standardStartTime}
            onChange={(e) => setSettings({ ...settings, standardStartTime: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Standart tugash vaqti</label>
          <input
            type="time"
            value={settings.standardEndTime}
            onChange={(e) => setSettings({ ...settings, standardEndTime: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Standart ish daqiqalari</label>
          <input
            type="number"
            value={settings.standardWorkMinutes}
            onChange={(e) => setSettings({ ...settings, standardWorkMinutes: Number(e.target.value) })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Kechikish chegarasi (daqiqa)</label>
          <input
            type="number"
            value={settings.lateThresholdMinutes}
            onChange={(e) => setSettings({ ...settings, lateThresholdMinutes: Number(e.target.value) })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </div>

        {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {savedAt && !error && <p className="text-xs text-emerald-600">Saqlandi</p>}

        <button
          type="submit"
          disabled={isSaving}
          className="self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </form>
    </div>
  );
}
