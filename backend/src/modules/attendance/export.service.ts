import ExcelJS from 'exceljs';
import { prisma } from '@/config/prisma';
import { listDailyAttendance } from './attendanceRecord.service';
import type { RoleName } from '@prisma/client';

interface AuthContext {
  userId: string;
  organizationId: string;
  role: RoleName;
}

function formatTime(date: Date | null): string {
  if (!date) return '—';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Keldi',
  LATE: 'Kechikdi',
  EARLY_LEAVE: 'Erta ketdi',
  ABSENT: 'Kelmadi',
  ON_LEAVE: "Ta'tilda",
  BUSINESS_TRIP: 'Safarda',
  REMOTE: 'Masofaviy',
  SICK: 'Bemor',
};

// Kunlik davomat jadvalini .xlsx sifatida generatsiya qiladi — mavjud
// listDailyAttendance() bilan bir xil ma'lumot va ruxsat qoidalariga
// tayanadi, faqat natijani buferga yozadi.
export async function exportDailyAttendanceToExcel(
  auth: AuthContext,
  date: Date,
  departmentId?: string,
): Promise<Buffer> {
  const rows = await listDailyAttendance({ auth, date, departmentId });

  const employeeIds = rows.map((r) => r.employee.id);
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, position: { select: { name: true } }, department: { select: { name: true } } },
  });
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Davomat');

  sheet.columns = [
    { header: '№', key: 'index', width: 5 },
    { header: 'F.I.Sh.', key: 'fullName', width: 30 },
    { header: 'Lavozimi', key: 'position', width: 25 },
    { header: "Bo'lim", key: 'department', width: 25 },
    { header: 'Kirish', key: 'checkIn', width: 10 },
    { header: 'Chiqish', key: 'checkOut', width: 10 },
    { header: 'Holat', key: 'status', width: 14 },
    { header: 'Kechikish (daq)', key: 'lateMinutes', width: 16 },
    { header: 'Erta ketish (daq)', key: 'earlyLeaveMinutes', width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };

  rows.forEach((row, index) => {
    const extra = employeeById.get(row.employee.id);
    sheet.addRow({
      index: index + 1,
      fullName: row.employee.fullName,
      position: extra?.position?.name ?? '—',
      department: extra?.department?.name ?? '—',
      checkIn: formatTime(row.record?.checkInTime ?? null),
      checkOut: formatTime(row.record?.checkOutTime ?? null),
      status: STATUS_LABEL[row.record?.status ?? 'ABSENT'],
      lateMinutes: row.record?.lateMinutes ?? 0,
      earlyLeaveMinutes: row.record?.earlyLeaveMinutes ?? 0,
    });
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
