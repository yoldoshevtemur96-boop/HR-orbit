'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DepartmentTimesheetCard } from '@/components/attendance/DepartmentTimesheetCard';
import { useAuthStore } from '@/store/authStore';
import type { DepartmentTimesheet } from '@/types/attendance';
import type { Department } from '@/types/core-hr';

const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_MANAGER', 'TIMEKEEPER'];

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function DepartmentTimesheetListPage() {
  const user = useAuthStore((s) => s.user);
  const canGenerate = user ? MANAGE_ROLES.includes(user.role) : false;
  const isDeptHead = user?.role === 'DEPARTMENT_HEAD';

  const [timesheets, setTimesheets] = useState<DepartmentTimesheet[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [{ year, month }, setYearMonth] = useState(currentYearMonth());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<DepartmentTimesheet[]>('/attendance/timesheets/department').then((res) => setTimesheets(res.data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get('/hr/departments').then((res) => {
      setDepartments(res.data);
      if (res.data.length > 0) setDepartmentId((prev) => prev || res.data[0].id);
    });
  }, []);

  // DEPARTMENT_HEAD uchun tugma bosish shart emas — sahifa ochilganda
  // joriy oy tabeli o'zi (fon rejimida) generatsiya qilinadi/yangilanadi.
  // Agar tabel allaqachon yuborilgan bo'lsa (DEPT_SUBMITTED+), backend
  // xato qaytaradi — bu holat kutilgan, shuning uchun jim yutiladi.
  useEffect(() => {
    if (!isDeptHead) return;
    const { year: y, month: m } = currentYearMonth();
    api
      .get<{ departmentId: string | null }>('/hr/employees/me')
      .then((res) => {
        if (!res.data.departmentId) return;
        return api.post('/attendance/timesheets/department/generate', {
          departmentId: res.data.departmentId,
          year: y,
          month: m,
        });
      })
      .catch(() => {})
      .finally(() => load());
  }, [isDeptHead, load]);

  const departmentNameById = new Map(departments.map((d) => [d.id, d.name]));

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!departmentId) return;
    setError(null);
    setIsGenerating(true);
    try {
      await api.post('/attendance/timesheets/department/generate', { departmentId, year, month });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Generatsiyada xatolik yuz berdi');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Attendance</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Bo&apos;lim tabellari</h1>
      </div>

      {isDeptHead && (
        <p className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Joriy oy tabeli avtomatik tayyorlandi — quyidagi ro&apos;yxatdan oching va HR&apos;ga yuboring.
        </p>
      )}

      {canGenerate && (
        <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Bo&apos;lim</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Yil</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYearMonth((s) => ({ ...s, year: Number(e.target.value) }))}
              className="w-24 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Oy</label>
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setYearMonth((s) => ({ ...s, month: Number(e.target.value) }))}
              className="w-20 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </div>
          <button
            type="submit"
            disabled={isGenerating}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {isGenerating ? 'Generatsiya qilinmoqda...' : 'Tabel generatsiya qilish'}
          </button>
          {error && <p className="w-full text-sm text-rose-700">{error}</p>}
        </form>
      )}

      <div className="flex flex-col gap-2">
        {timesheets === null ? (
          <p className="text-sm text-stone-400">Yuklanmoqda...</p>
        ) : timesheets.length === 0 ? (
          <p className="text-sm text-stone-400">Hali tabel generatsiya qilinmagan.</p>
        ) : (
          timesheets.map((t) => (
            <DepartmentTimesheetCard key={t.id} timesheet={t} departmentName={departmentNameById.get(t.departmentId) ?? t.departmentId} />
          ))
        )}
      </div>
    </div>
  );
}
