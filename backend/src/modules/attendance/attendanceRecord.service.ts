import type { AttendanceDayStatus, RoleName } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { listActiveEmployeesForScope, getMyEmployee } from '@/modules/core-hr/employee.service';
import { getSettings } from './attendanceSettings.service';
import { canManageAttendance, canViewDepartmentAttendance } from './rbac';

interface AuthContext {
  userId: string;
  organizationId: string;
  role: RoleName;
}

// "HH:mm" ni shu kunning daqiqasiga aylantiradi (masalan "09:15" -> 555).
function timeStringToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function dateTimeToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

interface ComputedFields {
  status: AttendanceDayStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
}

function computeFields(
  checkInTime: Date | null,
  checkOutTime: Date | null,
  settings: { standardStartTime: string; standardEndTime: string; standardWorkMinutes: number; lateThresholdMinutes: number },
  explicitStatus?: AttendanceDayStatus,
): ComputedFields {
  if (explicitStatus && explicitStatus !== 'PRESENT' && explicitStatus !== 'LATE' && explicitStatus !== 'EARLY_LEAVE') {
    // ON_LEAVE / BUSINESS_TRIP / REMOTE / SICK / ABSENT — vaqt asosida hisoblanmaydi
    return { status: explicitStatus, lateMinutes: 0, earlyLeaveMinutes: 0, workedMinutes: 0, overtimeMinutes: 0 };
  }

  if (!checkInTime) {
    return { status: 'ABSENT', lateMinutes: 0, earlyLeaveMinutes: 0, workedMinutes: 0, overtimeMinutes: 0 };
  }

  const standardStart = timeStringToMinutes(settings.standardStartTime);
  const standardEnd = timeStringToMinutes(settings.standardEndTime);
  const checkIn = dateTimeToMinutes(checkInTime);

  const minutesAfterStart = checkIn - standardStart;
  const lateMinutes = minutesAfterStart > settings.lateThresholdMinutes ? minutesAfterStart : 0;

  let earlyLeaveMinutes = 0;
  let workedMinutes = 0;
  let overtimeMinutes = 0;

  if (checkOutTime) {
    const checkOut = dateTimeToMinutes(checkOutTime);
    workedMinutes = Math.max(0, checkOut - checkIn);
    earlyLeaveMinutes = Math.max(0, standardEnd - checkOut);
    overtimeMinutes = Math.max(0, workedMinutes - settings.standardWorkMinutes);
  }

  let status: AttendanceDayStatus = 'PRESENT';
  if (lateMinutes > 0) status = 'LATE';
  else if (earlyLeaveMinutes > 0) status = 'EARLY_LEAVE';

  return { status, lateMinutes, earlyLeaveMinutes, workedMinutes, overtimeMinutes };
}

interface UpsertAttendanceRecordInput {
  organizationId: string;
  editedByUserId: string;
  employeeId: string;
  date: Date;
  checkInTime?: Date | null;
  checkOutTime?: Date | null;
  status?: AttendanceDayStatus;
  note?: string;
}

// HR tabelchi tomonidan manual kiritish/tuzatish. Status berilmasa,
// checkIn/checkOut asosida avtomatik hisoblanadi.
export async function upsertAttendanceRecord(input: UpsertAttendanceRecordInput) {
  const settings = await getSettings(input.organizationId);
  const checkInTime = input.checkInTime ?? null;
  const checkOutTime = input.checkOutTime ?? null;
  const computed = computeFields(checkInTime, checkOutTime, settings, input.status);

  return prisma.attendanceRecord.upsert({
    where: {
      organizationId_employeeId_date: {
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        date: input.date,
      },
    },
    create: {
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      date: input.date,
      checkInTime,
      checkOutTime,
      note: input.note,
      editedByUserId: input.editedByUserId,
      source: 'MANUAL',
      ...computed,
    },
    update: {
      checkInTime,
      checkOutTime,
      note: input.note,
      editedByUserId: input.editedByUserId,
      source: 'MANUAL',
      ...computed,
    },
  });
}

interface ListDailyAttendanceInput {
  auth: AuthContext;
  date: Date;
  departmentId?: string;
  branchId?: string;
}

// Kunlik davomat jadvali — resurs-scope orqali qaysi xodimlar ko'rinishi
// mumkinligini Core HR'dan oladi, so'ng shu kun uchun yozuvlarni biriktiradi.
// Yozuvi yo'q xodim "ABSENT" sifatida ko'rsatiladi (yozuv yaratilmaydi).
export async function listDailyAttendance(input: ListDailyAttendanceInput) {
  if (!canViewDepartmentAttendance(input.auth.role)) {
    throw AppError.forbidden();
  }

  let departmentId = input.departmentId;
  if (input.auth.role === 'DEPARTMENT_HEAD') {
    const self = await getMyEmployee(input.auth).catch(() => null);
    departmentId = self?.departmentId ?? '__none__';
  }

  const employees = await listActiveEmployeesForScope(input.auth, { departmentId, branchId: input.branchId });
  const employeeIds = employees.map((e) => e.id);

  const records = await prisma.attendanceRecord.findMany({
    where: { organizationId: input.auth.organizationId, employeeId: { in: employeeIds }, date: input.date },
  });
  const recordByEmployeeId = new Map(records.map((r) => [r.employeeId, r]));

  return employees.map((employee) => ({
    employee,
    record: recordByEmployeeId.get(employee.id) ?? null,
  }));
}

// Resurs-scope tekshiruvi: o'zi, o'z bo'limi (DEPARTMENT_HEAD), yoki HR/Timekeeper.
async function assertCanViewEmployeeAttendance(auth: AuthContext, employeeId: string) {
  if (canManageAttendance(auth.role)) return;

  const self = await getMyEmployee(auth).catch(() => null);
  if (!self) throw AppError.forbidden();

  if (self.id === employeeId) return;

  if (auth.role === 'DEPARTMENT_HEAD') {
    const scoped = await listActiveEmployeesForScope(auth, { departmentId: self.departmentId ?? undefined });
    if (scoped.some((e) => e.id === employeeId)) return;
  }

  throw AppError.forbidden();
}

export async function getEmployeeMonthlyAttendance(auth: AuthContext, employeeId: string, year: number, month: number) {
  await assertCanViewEmployeeAttendance(auth, employeeId);

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  return prisma.attendanceRecord.findMany({
    where: { organizationId: auth.organizationId, employeeId, date: { gte: start, lt: end } },
    orderBy: { date: 'asc' },
  });
}

export async function getMyAttendanceToday(auth: AuthContext) {
  const self = await getMyEmployee(auth);
  const today = new Date();
  const date = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  return prisma.attendanceRecord.findUnique({
    where: { organizationId_employeeId_date: { organizationId: auth.organizationId, employeeId: self.id, date } },
  });
}

export async function getMyMonthlyCalendar(auth: AuthContext, year: number, month: number) {
  const self = await getMyEmployee(auth);
  return getEmployeeMonthlyAttendance(auth, self.id, year, month);
}
