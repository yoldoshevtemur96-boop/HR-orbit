'use client';

import { useState } from 'react';
import { Modal } from '@/components/hr/Modal';
import type { EmployeeAttendanceSummaryLine, TimesheetDayCell } from '@/types/attendance';

interface TimesheetGridTableProps {
  rows: EmployeeAttendanceSummaryLine[];
  daysInMonth: number;
  isApproved: boolean;
  // Berilsa — katakni bosib 1-8 soat va izoh kiritish mumkin
  onEditCell?: (employeeId: string, day: number, hours: number, comment: string) => Promise<void>;
}

// Kod turiga qarab katakcha foni — 1С-uslubidagi tabelga yaqinlashtirilgan
// (aynan bir xil emas): raqam=ishlagan kun (oq), Д=ta'til (pushti),
// К=kasallik (sariq), С=safar (binafsha), М=masofaviy (moviy),
// В=dam olish kuni (yashil), bo'sh=neytral. Qo'lda o'zgartirilgan
// katak — qizil.
function cellClassName(cell: TimesheetDayCell): string {
  if (cell.edited) return 'bg-red-100 font-bold text-red-700';
  if (cell.code === 'В') return 'bg-emerald-50 text-emerald-700';
  if (cell.code === 'Д') return 'bg-rose-50 text-rose-700';
  if (cell.code === 'К') return 'bg-amber-50 text-amber-700';
  if (cell.code === 'С') return 'bg-violet-50 text-violet-700';
  if (cell.code === 'М') return 'bg-sky-50 text-sky-700';
  if (cell.code === '') return 'text-stone-300';
  return 'text-stone-700';
}

const STICKY_COL_CLASS = 'sticky bg-white';

const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

interface OpenCell {
  employeeId: string;
  employeeName: string;
  cell: TimesheetDayCell;
}

export function TimesheetGridTable({ rows, daysInMonth, isApproved, onEditCell }: TimesheetGridTableProps) {
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const [openCell, setOpenCell] = useState<OpenCell | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isEditable = Boolean(onEditCell);

  function openEditor(employeeId: string, employeeName: string, cell: TimesheetDayCell) {
    if (!isEditable && !cell.edited && !cell.hasCorrection) return;
    setOpenCell({ employeeId, employeeName, cell });
    const current = Number(cell.code);
    setHours(cell.edited && current >= 1 && current <= 8 ? current : null);
    setComment(cell.editComment ?? '');
    setSaveError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!openCell || !onEditCell || hours === null || !comment.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onEditCell(openCell.employeeId, openCell.cell.day, hours, comment.trim());
      setOpenCell(null);
    } catch (err: any) {
      setSaveError(err?.response?.data?.error?.message ?? 'Saqlashda xatolik yuz berdi');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="relative overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full min-w-max border-collapse text-xs">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            <th className={`${STICKY_COL_CLASS} left-0 z-20 min-w-[36px] border-r border-stone-200 px-2 py-2 text-left`}>№</th>
            <th className={`${STICKY_COL_CLASS} left-[36px] z-20 min-w-[160px] border-r border-stone-200 px-2 py-2 text-left`}>
              Ф.И.Ш.
            </th>
            <th className={`${STICKY_COL_CLASS} left-[196px] z-20 min-w-[140px] border-r border-stone-200 px-2 py-2 text-left`}>
              Лавозими
            </th>
            <th className={`${STICKY_COL_CLASS} left-[336px] z-20 min-w-[60px] border-r border-stone-200 px-2 py-2 text-center`}>
              Ставка
            </th>
            <th className={`${STICKY_COL_CLASS} left-[396px] z-20 min-w-[80px] border-r-2 border-stone-300 px-2 py-2 text-center`}>
              Тасдиқлаш
            </th>
            {days.map((d) => (
              <th key={d} className="min-w-[28px] border-r border-stone-100 px-1 py-2 text-center">
                {d}
              </th>
            ))}
            <th className="min-w-[50px] border-l-2 border-stone-300 px-2 py-2 text-center">Кун</th>
            <th className="min-w-[50px] px-2 py-2 text-center">Соат</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const totalDays = row.presentDays + row.lateDays + row.earlyLeaveDays;
            return (
              <tr key={row.employeeId} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                <td className={`${STICKY_COL_CLASS} left-0 z-10 border-r border-stone-200 px-2 py-1.5 text-stone-500`}>
                  {index + 1}
                </td>
                <td className={`${STICKY_COL_CLASS} left-[36px] z-10 border-r border-stone-200 px-2 py-1.5 font-medium text-stone-800`}>
                  {row.fullName}
                </td>
                <td className={`${STICKY_COL_CLASS} left-[196px] z-10 border-r border-stone-200 px-2 py-1.5 text-stone-600`}>
                  {row.positionName ?? '—'}
                </td>
                <td className={`${STICKY_COL_CLASS} left-[336px] z-10 border-r border-stone-200 px-2 py-1.5 text-center text-stone-600`}>
                  1
                </td>
                <td className={`${STICKY_COL_CLASS} left-[396px] z-10 border-r-2 border-stone-300 px-2 py-1.5 text-center`}>
                  {isApproved ? (
                    <span className="text-emerald-600">✓</span>
                  ) : (
                    <span className="text-rose-500">✗</span>
                  )}
                </td>
                {row.days.map((cell) => {
                  const clickable = isEditable || cell.edited || cell.hasCorrection;
                  return (
                    <td
                      key={cell.day}
                      title={
                        cell.edited
                          ? `O'zgartirilgan${cell.originalCode ? ` (avval: ${cell.originalCode})` : ''}: ${cell.editComment ?? ''}`
                          : undefined
                      }
                      className={`border-r border-stone-100 px-1 py-1.5 text-center font-medium ${cellClassName(cell)} ${
                        cell.hasCorrection && !cell.edited ? 'ring-2 ring-inset ring-sky-500' : ''
                      } ${clickable ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-accent' : ''}`}
                      onClick={() => openEditor(row.employeeId, row.fullName, cell)}
                    >
                      {cell.code}
                    </td>
                  );
                })}
                <td className="border-l-2 border-stone-300 px-2 py-1.5 text-center font-semibold text-stone-800">
                  {totalDays}
                </td>
                <td className="px-2 py-1.5 text-center font-semibold text-stone-800">{Math.round(row.workedHours)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Modal
        isOpen={openCell !== null}
        title={openCell ? `${openCell.employeeName} — ${openCell.cell.day}-kun` : ''}
        onClose={() => !isSaving && setOpenCell(null)}
      >
        {openCell && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-stone-500">
              Hozirgi qiymat: <span className="font-semibold text-stone-800">{openCell.cell.code || '—'}</span>
              {openCell.cell.edited && openCell.cell.originalCode !== undefined && (
                <>
                  {' '}
                  · turniket bo&apos;yicha:{' '}
                  <span className="font-semibold text-stone-800">{openCell.cell.originalCode || '—'}</span>
                </>
              )}
            </p>
            {openCell.cell.hasCorrection && (
              <p className="rounded-md bg-sky-50 px-3 py-2 text-sky-800">Rahbar izohi: {openCell.cell.correctionComment || '—'}</p>
            )}

            {isEditable ? (
              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">Ishlagan soat</label>
                  <div className="grid grid-cols-8 gap-1">
                    {HOUR_OPTIONS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHours(h)}
                        className={`rounded-md border py-2 text-sm font-semibold transition ${
                          hours === h ? 'border-accent bg-accent text-white' : 'border-stone-200 text-stone-700 hover:border-stone-300'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">Izoh (majburiy)</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Masalan: turniket ishlamadi, xodim ishda bo'lgan"
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                  />
                </div>
                {saveError && <p className="rounded-md bg-rose-50 px-3 py-2 text-rose-700">{saveError}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setOpenCell(null)}
                    className="rounded-lg border border-stone-200 px-4 py-2 font-medium text-stone-600 hover:bg-stone-50"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || hours === null || !comment.trim()}
                    className="rounded-lg bg-accent px-4 py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
                  </button>
                </div>
              </form>
            ) : (
              openCell.cell.edited && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-red-800">Izoh: {openCell.cell.editComment || '—'}</p>
              )
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
