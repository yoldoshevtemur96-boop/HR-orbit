'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DepartmentTimesheetCard } from '@/components/attendance/DepartmentTimesheetCard';
import { TimesheetStatusBadge } from '@/components/attendance/TimesheetStatusBadge';
import { TimesheetGridTable } from '@/components/attendance/TimesheetGridTable';
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
  const router = useRouter();

  // HR va tabelchi bo'lim tabellari bilan faqat Tashkilot tabeli
  // sahifasi orqali ishlaydi — bu sahifa ular uchun yopiq.
  const isHiddenForRole = user?.role === 'HR_MANAGER' || user?.role === 'TIMEKEEPER';
  useEffect(() => {
    if (isHiddenForRole) router.replace('/attendance/timesheets/organization');
  }, [isHiddenForRole, router]);

  const [timesheets, setTimesheets] = useState<DepartmentTimesheet[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [{ year, month }, setYearMonth] = useState(currentYearMonth());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(() => {
    api.get<DepartmentTimesheet[]>('/attendance/timesheets/department').then((res) => setTimesheets(res.data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isDeptHead) return;
    api.get('/hr/departments').then((res) => {
      setDepartments(res.data);
      if (res.data.length > 0) setDepartmentId((prev) => prev || res.data[0].id);
    });
  }, [isDeptHead]);

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

  if (isHiddenForRole) return null;

  if (isDeptHead) {
    const [currentTimesheet, ...pastTimesheets] = timesheets ?? [];
    const daysInMonth = currentTimesheet ? new Date(currentTimesheet.year, currentTimesheet.month, 0).getDate() : 0;
    const isApproved = currentTimesheet
      ? currentTimesheet.status === 'DEPT_APPROVED' || currentTimesheet.status === 'CONSOLIDATED'
      : false;

    // Rahbariyatga yuborilgunga qadar tahrirlash mumkin. Yuborilgan yoki
    // tasdiqlangan tabel o'zgartirilsa, backend uni qoralamaga qaytaradi —
    // shunda "HR'ga yuborish" tugmasi yana chiqadi.
    const isEditable = Boolean(currentTimesheet) && currentTimesheet.status !== 'CONSOLIDATED';
    const isSentToHr = currentTimesheet?.status === 'DEPT_SUBMITTED' || currentTimesheet?.status === 'DEPT_APPROVED';

    async function handleEditCell(employeeId: string, day: number, hours: number, comment: string) {
      if (!currentTimesheet) return;
      await api.put('/attendance/timesheets/cells', {
        employeeId,
        date: `${currentTimesheet.year}-${String(currentTimesheet.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        hours,
        comment,
      });
      load();
    }

    async function handleSubmit() {
      if (!currentTimesheet) return;
      setError(null);
      setIsSubmitting(true);
      try {
        await api.post(`/attendance/timesheets/department/${currentTimesheet.id}/submit`);
        load();
      } catch (err: any) {
        setError(err?.response?.data?.error?.message ?? 'Yuborishda xatolik yuz berdi');
      } finally {
        setIsSubmitting(false);
      }
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Attendance</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Tuzilma tabeli</h1>
          </div>
          {pastTimesheets.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              title="Eski tabellar tarixi"
              aria-label="Eski tabellar tarixi"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-lg transition ${
                showHistory
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-800'
              }`}
            >
              🕘
            </button>
          )}
        </div>

        {showHistory && pastTimesheets.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Oldingi tabellar</p>
            {pastTimesheets.map((t) => (
              <Link
                key={t.id}
                href={`/attendance/timesheets/department/${t.id}`}
                className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3 transition hover:border-stone-300"
              >
                <div>
                  <p className="text-sm font-semibold text-stone-800">
                    {t.year}-{String(t.month).padStart(2, '0')} tabeli
                  </p>
                  <p className="text-xs text-stone-400">{t.summaryData.length} xodim</p>
                </div>
                <TimesheetStatusBadge status={t.status} />
              </Link>
            ))}
          </div>
        )}

        {timesheets === null ? (
          <p className="text-sm text-stone-400">Yuklanmoqda...</p>
        ) : !currentTimesheet ? (
          <p className="text-sm text-stone-400">Hali tabel generatsiya qilinmagan.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-800">
                {currentTimesheet.year}-{String(currentTimesheet.month).padStart(2, '0')} tabeli
              </p>
              <TimesheetStatusBadge status={currentTimesheet.status} />
            </div>

            {currentTimesheet.hrOverride && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Bu tabel HR tomonidan tasdiqlangan. Sabab: {currentTimesheet.hrOverrideReason ?? '—'}
              </p>
            )}
            {currentTimesheet.rejectionComment && (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                Rad etish sababi: {currentTimesheet.rejectionComment}
              </p>
            )}
            {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

            {currentTimesheet.status === 'CONSOLIDATED' && (
              <p className="rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-600">
                Tabel rahbariyatga yuborilgan — endi o&apos;zgartirib bo&apos;lmaydi.
              </p>
            )}
            {isEditable && isSentToHr && (
              <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800">
                Tabel HR&apos;ga yuborilgan
                {currentTimesheet.status === 'DEPT_APPROVED' ? ' va tasdiqlangan' : ''}. O&apos;zgartirish kiritsangiz, tabel
                qoralamaga qaytadi — uni HR&apos;ga qayta yuborishingiz va qayta tasdiqlatishingiz kerak bo&apos;ladi.
              </p>
            )}
            {isEditable && (
              <p className="text-xs text-stone-500">
                Katakni bosib ishlagan soatni (1–8) va izohni o&apos;zgartirishingiz mumkin. O&apos;zgartirilgan kataklar qizil rangda.
              </p>
            )}
            <TimesheetGridTable
              rows={currentTimesheet.summaryData}
              daysInMonth={daysInMonth}
              isApproved={isApproved}
              onEditCell={isEditable ? handleEditCell : undefined}
            />

            {currentTimesheet.status === 'DRAFT' && (
              <div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                  className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  HR&apos;ga yuborish
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Attendance</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Tuzilma tabeli</h1>
      </div>

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
