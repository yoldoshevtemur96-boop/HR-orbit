'use client';

import { useState } from 'react';
import type { EmployeeAttendanceSummaryLine, TimesheetDayCell } from '@/types/attendance';

interface TimesheetGridTableProps {
  rows: EmployeeAttendanceSummaryLine[];
  daysInMonth: number;
  isApproved: boolean;
}

// Kod turiga qarab katakcha foni — 1С-uslubidagi tabelga yaqinlashtirilgan
// (aynan bir xil emas): raqam=ishlagan kun (oq), Д=ta'til (pushti),
// К=kasallik (sariq), С=safar (binafsha), М=masofaviy (moviy),
// В=dam olish kuni (yashil), bo'sh=neytral.
function cellClassName(cell: TimesheetDayCell): string {
  if (cell.code === 'В') return 'bg-emerald-50 text-emerald-700';
  if (cell.code === 'Д') return 'bg-rose-50 text-rose-700';
  if (cell.code === 'К') return 'bg-amber-50 text-amber-700';
  if (cell.code === 'С') return 'bg-violet-50 text-violet-700';
  if (cell.code === 'М') return 'bg-sky-50 text-sky-700';
  if (cell.code === '') return 'text-stone-300';
  return 'text-stone-700';
}

const STICKY_COL_CLASS = 'sticky bg-white';

interface OpenPopover {
  employeeId: string;
  day: number;
  comment: string;
}

export function TimesheetGridTable({ rows, daysInMonth, isApproved }: TimesheetGridTableProps) {
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const [openPopover, setOpenPopover] = useState<OpenPopover | null>(null);

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
                {row.days.map((cell) => (
                  <td
                    key={cell.day}
                    className={`relative border-r border-stone-100 px-1 py-1.5 text-center font-medium ${cellClassName(cell)} ${
                      cell.hasCorrection ? 'ring-2 ring-inset ring-sky-500' : ''
                    } ${cell.hasCorrection ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (!cell.hasCorrection) return;
                      setOpenPopover({ employeeId: row.employeeId, day: cell.day, comment: cell.correctionComment ?? '' });
                    }}
                  >
                    {cell.code}
                    {openPopover?.employeeId === row.employeeId && openPopover.day === cell.day && (
                      <div
                        className="absolute left-1/2 top-full z-30 mt-1 w-56 -translate-x-1/2 rounded-lg border border-stone-200 bg-white p-3 text-left text-xs font-normal normal-case text-stone-700 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-semibold text-stone-800">Izoh</span>
                          <button
                            type="button"
                            onClick={() => setOpenPopover(null)}
                            aria-label="Yopish"
                            className="text-stone-400 hover:text-stone-700"
                          >
                            ✕
                          </button>
                        </div>
                        <p>{openPopover.comment || 'Izoh yo‘q'}</p>
                      </div>
                    )}
                  </td>
                ))}
                <td className="border-l-2 border-stone-300 px-2 py-1.5 text-center font-semibold text-stone-800">
                  {totalDays}
                </td>
                <td className="px-2 py-1.5 text-center font-semibold text-stone-800">{Math.round(row.workedHours)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
