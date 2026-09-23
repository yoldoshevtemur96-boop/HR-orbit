import type { RoleName } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { getMyEmployee } from '@/modules/core-hr/employee.service';
import { canApproveOrgTimesheet, canManageAttendance } from './rbac';

interface AuthContext {
  userId: string;
  organizationId: string;
  role: RoleName;
}

// Departament rahbari faqat o'z bo'limi tabelini generatsiya/yuborishi
// mumkin — HR/Timekeeper istalgan bo'lim uchun qila oladi.
async function assertCanManageDepartmentTimesheet(auth: AuthContext, departmentId: string) {
  if (canManageAttendance(auth.role)) return;
  if (auth.role === 'DEPARTMENT_HEAD') {
    const self = await getMyEmployee(auth);
    if (self.departmentId === departmentId) return;
  }
  throw AppError.forbidden();
}

interface DayCell {
  day: number;
  code: string; // "8" (ishlagan soat), "Д"/"К"/"С"/"М" (holat kodi), "В" (dam olish kuni), yoki "" (bo'sh)
  hours: number | null; // faqat ishlagan kun uchun (workedMinutes/60, yaxlitlangan)
}

interface EmployeeSummaryLine {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  positionName: string | null;
  presentDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  absentDays: number;
  onLeaveDays: number;
  businessTripDays: number;
  remoteDays: number;
  sickDays: number;
  workedHours: number;
  overtimeHours: number;
  days: DayCell[];
}

// 1С-uslubidagi tabel katakchasi uchun status -> kod xaritasi. Yozuv yo'q
// va kun hafta oxiri (shanba/yakshanba) bo'lsa "В" — bayram kalendari
// qurilmagani uchun faqat hafta kuni asosida aniqlanadi.
function mapRecordToDayCell(day: number, date: Date, record: { status: string; workedMinutes: number } | undefined): DayCell {
  if (!record) {
    const dayOfWeek = date.getUTCDay(); // 0=yakshanba, 6=shanba
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { day, code: 'В', hours: null };
    }
    return { day, code: '', hours: null };
  }

  switch (record.status) {
    case 'PRESENT':
    case 'LATE':
    case 'EARLY_LEAVE': {
      const hours = Math.round((record.workedMinutes / 60) * 10) / 10;
      return { day, code: hours > 0 ? String(hours) : '8', hours };
    }
    case 'ON_LEAVE':
      return { day, code: 'Д', hours: null };
    case 'SICK':
      return { day, code: 'К', hours: null };
    case 'BUSINESS_TRIP':
      return { day, code: 'С', hours: null };
    case 'REMOTE':
      return { day, code: 'М', hours: null };
    case 'ABSENT':
    default:
      return { day, code: '', hours: null };
  }
}

async function buildDepartmentSummary(organizationId: string, departmentId: string, year: number, month: number) {
  const employees = await prisma.employee.findMany({
    where: { organizationId, departmentId, status: 'ACTIVE' },
    select: { id: true, employeeCode: true, fullName: true, position: { select: { name: true } } },
  });

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

  const records = await prisma.attendanceRecord.findMany({
    where: { organizationId, employeeId: { in: employees.map((e) => e.id) }, date: { gte: start, lt: end } },
  });
  const recordsByEmployee = new Map<string, typeof records>();
  for (const record of records) {
    const list = recordsByEmployee.get(record.employeeId) ?? [];
    list.push(record);
    recordsByEmployee.set(record.employeeId, list);
  }

  const summary: EmployeeSummaryLine[] = employees.map((employee) => {
    const employeeRecords = recordsByEmployee.get(employee.id) ?? [];
    const recordByDay = new Map(employeeRecords.map((r) => [r.date.getUTCDate(), r]));
    const recordedDays = employeeRecords.length;

    const line: EmployeeSummaryLine = {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      positionName: employee.position?.name ?? null,
      presentDays: 0,
      lateDays: 0,
      earlyLeaveDays: 0,
      absentDays: Math.max(0, daysInMonth - recordedDays),
      onLeaveDays: 0,
      businessTripDays: 0,
      remoteDays: 0,
      sickDays: 0,
      workedHours: 0,
      overtimeHours: 0,
      days: [],
    };

    for (const record of employeeRecords) {
      switch (record.status) {
        case 'PRESENT':
          line.presentDays += 1;
          break;
        case 'LATE':
          line.presentDays += 1;
          line.lateDays += 1;
          break;
        case 'EARLY_LEAVE':
          line.presentDays += 1;
          line.earlyLeaveDays += 1;
          break;
        case 'ABSENT':
          line.absentDays += 1;
          break;
        case 'ON_LEAVE':
          line.onLeaveDays += 1;
          break;
        case 'BUSINESS_TRIP':
          line.businessTripDays += 1;
          break;
        case 'REMOTE':
          line.remoteDays += 1;
          break;
        case 'SICK':
          line.sickDays += 1;
          break;
      }
      line.workedHours += record.workedMinutes / 60;
      line.overtimeHours += record.overtimeMinutes / 60;
    }

    line.workedHours = Math.round(line.workedHours * 100) / 100;
    line.overtimeHours = Math.round(line.overtimeHours * 100) / 100;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      line.days.push(mapRecordToDayCell(day, date, recordByDay.get(day)));
    }

    return line;
  });

  return summary;
}

interface GenerateDepartmentTimesheetInput {
  auth: AuthContext;
  departmentId: string;
  year: number;
  month: number;
}

// Xohlagancha qayta generatsiya qilinishi mumkin — faqat DRAFT holatida
// (submit qilingandan keyin qayta generatsiya taqiqlanadi, chunki
// DEPARTMENT_HEAD allaqachon ko'rib chiqayotgan bo'lishi mumkin).
export async function generateDepartmentTimesheet(input: GenerateDepartmentTimesheetInput) {
  await assertCanManageDepartmentTimesheet(input.auth, input.departmentId);

  const existing = await prisma.departmentTimesheet.findUnique({
    where: {
      organizationId_departmentId_year_month: {
        organizationId: input.auth.organizationId,
        departmentId: input.departmentId,
        year: input.year,
        month: input.month,
      },
    },
  });
  if (existing && existing.status !== 'DRAFT' && existing.status !== 'DEPT_REJECTED') {
    throw AppError.badRequest("Bu tabel allaqachon yuborilgan — qayta generatsiya qilib bo'lmaydi");
  }

  const summaryData = await buildDepartmentSummary(input.auth.organizationId, input.departmentId, input.year, input.month);

  return prisma.departmentTimesheet.upsert({
    where: {
      organizationId_departmentId_year_month: {
        organizationId: input.auth.organizationId,
        departmentId: input.departmentId,
        year: input.year,
        month: input.month,
      },
    },
    create: {
      organizationId: input.auth.organizationId,
      departmentId: input.departmentId,
      year: input.year,
      month: input.month,
      status: 'DRAFT',
      summaryData: summaryData as any,
      generatedByUserId: input.auth.userId,
    },
    update: {
      status: 'DRAFT',
      summaryData: summaryData as any,
      generatedByUserId: input.auth.userId,
      rejectionComment: null,
    },
  });
}

export async function submitDepartmentTimesheet(auth: AuthContext, timesheetId: string) {
  const timesheet = await getDepartmentTimesheetOrThrow(auth.organizationId, timesheetId);
  await assertCanManageDepartmentTimesheet(auth, timesheet.departmentId);
  if (timesheet.status !== 'DRAFT') {
    throw AppError.badRequest('Faqat qoralama holatidagi tabel yuborilishi mumkin');
  }
  return prisma.departmentTimesheet.update({
    where: { id: timesheetId },
    data: { status: 'DEPT_SUBMITTED', submittedAt: new Date() },
  });
}

// Endi faqat HR_MANAGER/TIMEKEEPER/SUPER_ADMIN tasdiqlaydi — DEPARTMENT_HEAD
// generate+submit qilgani uchun (o'z-o'ziga tasdiqlash bo'lib qolmasligi uchun).
export async function decideDepartmentTimesheet(
  auth: AuthContext,
  timesheetId: string,
  decision: 'APPROVED' | 'REJECTED',
  rejectionComment?: string,
) {
  if (!canManageAttendance(auth.role)) {
    throw AppError.forbidden();
  }

  const timesheet = await getDepartmentTimesheetOrThrow(auth.organizationId, timesheetId);
  if (timesheet.status !== 'DEPT_SUBMITTED') {
    throw AppError.badRequest("Bu tabel hozir tasdiqlash kutilayotgan holatda emas");
  }

  if (decision === 'REJECTED') {
    return prisma.departmentTimesheet.update({
      where: { id: timesheetId },
      data: { status: 'DEPT_REJECTED', rejectionComment },
    });
  }

  return prisma.departmentTimesheet.update({
    where: { id: timesheetId },
    data: { status: 'DEPT_APPROVED', deptApprovedByUserId: auth.userId, deptApprovedAt: new Date(), rejectionComment: null },
  });
}

export async function listDepartmentTimesheets(auth: AuthContext, year?: number) {
  const where: any = { organizationId: auth.organizationId };
  if (year) where.year = year;

  if (auth.role === 'DEPARTMENT_HEAD') {
    const self = await getMyEmployee(auth);
    where.departmentId = self.departmentId ?? '__none__';
  } else if (!canManageAttendance(auth.role)) {
    throw AppError.forbidden();
  }

  return prisma.departmentTimesheet.findMany({ where, orderBy: [{ year: 'desc' }, { month: 'desc' }] });
}

export async function getDepartmentTimesheetById(auth: AuthContext, timesheetId: string) {
  const timesheet = await getDepartmentTimesheetOrThrow(auth.organizationId, timesheetId);

  if (auth.role === 'DEPARTMENT_HEAD') {
    const self = await getMyEmployee(auth);
    if (self.departmentId !== timesheet.departmentId) {
      throw AppError.forbidden();
    }
  } else if (!canManageAttendance(auth.role)) {
    throw AppError.forbidden();
  }

  return timesheet;
}

async function getDepartmentTimesheetOrThrow(organizationId: string, timesheetId: string) {
  const timesheet = await prisma.departmentTimesheet.findFirst({ where: { id: timesheetId, organizationId } });
  if (!timesheet) throw AppError.notFound('Tabel topilmadi');
  return timesheet;
}

// --------------------------------------------------------------------------
// Tashkilot darajasidagi (FINAL) tabel — bir nechta DEPT_APPROVED
// DepartmentTimesheet'larni birlashtiradi.
// --------------------------------------------------------------------------

export async function consolidateOrganizationTimesheet(auth: AuthContext, year: number, month: number) {
  if (!canManageAttendance(auth.role)) {
    throw AppError.forbidden();
  }

  const approvedDeptTimesheets = await prisma.departmentTimesheet.findMany({
    where: { organizationId: auth.organizationId, year, month, status: 'DEPT_APPROVED' },
  });
  if (approvedDeptTimesheets.length === 0) {
    throw AppError.badRequest("Tasdiqlangan departament tabeli topilmadi — avval bo'limlar tabelini tasdiqlashi kerak");
  }

  const orgTimesheet = await prisma.organizationTimesheet.upsert({
    where: { organizationId_year_month: { organizationId: auth.organizationId, year, month } },
    create: {
      organizationId: auth.organizationId,
      year,
      month,
      status: 'DRAFT',
      consolidatedByUserId: auth.userId,
    },
    update: {
      status: 'DRAFT',
      consolidatedByUserId: auth.userId,
      rejectionComment: null,
    },
  });

  // Avvalgi konsolidatsiya qilingan qatorlarni tozalab, qaytadan yozadi —
  // shu orqali qayta generatsiya (masalan yangi bo'lim tasdiqlangach) xavfsiz.
  await prisma.organizationTimesheetLine.deleteMany({ where: { organizationTimesheetId: orgTimesheet.id } });
  await prisma.organizationTimesheetLine.createMany({
    data: approvedDeptTimesheets.map((dt) => ({
      organizationTimesheetId: orgTimesheet.id,
      departmentTimesheetId: dt.id,
    })),
  });

  await prisma.departmentTimesheet.updateMany({
    where: { id: { in: approvedDeptTimesheets.map((dt) => dt.id) } },
    data: { status: 'CONSOLIDATED' },
  });

  return getOrganizationTimesheetById(auth, orgTimesheet.id);
}

export async function submitOrganizationTimesheet(auth: AuthContext, timesheetId: string) {
  if (!canManageAttendance(auth.role)) {
    throw AppError.forbidden();
  }
  const timesheet = await getOrganizationTimesheetOrThrow(auth.organizationId, timesheetId);
  if (timesheet.status !== 'DRAFT') {
    throw AppError.badRequest('Faqat qoralama holatidagi tabel yuborilishi mumkin');
  }
  return prisma.organizationTimesheet.update({
    where: { id: timesheetId },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  });
}

// FINAL tasdiqlash — faqat SUPER_ADMIN. Tasdiqlangandan keyingi
// AttendanceRecord o'zgarishlari bu tabelning summaryData snapshot'iga
// ta'sir qilmaydi (DepartmentTimesheet.summaryData generatsiya vaqtida
// muzlatilgan).
export async function decideOrganizationTimesheet(
  auth: AuthContext,
  timesheetId: string,
  decision: 'APPROVED' | 'REJECTED',
  rejectionComment?: string,
) {
  if (!canApproveOrgTimesheet(auth.role)) {
    throw AppError.forbidden('Yakuniy tabelni faqat yuqori rahbar tasdiqlaydi');
  }
  const timesheet = await getOrganizationTimesheetOrThrow(auth.organizationId, timesheetId);
  if (timesheet.status !== 'SUBMITTED') {
    throw AppError.badRequest('Bu tabel hozir tasdiqlash kutilayotgan holatda emas');
  }

  if (decision === 'REJECTED') {
    return prisma.organizationTimesheet.update({
      where: { id: timesheetId },
      data: { status: 'REJECTED', rejectionComment },
    });
  }

  return prisma.organizationTimesheet.update({
    where: { id: timesheetId },
    data: { status: 'APPROVED', approvedByUserId: auth.userId, approvedAt: new Date(), rejectionComment: null },
  });
}

export async function listOrganizationTimesheets(auth: AuthContext, year?: number) {
  if (!canManageAttendance(auth.role) && !canApproveOrgTimesheet(auth.role)) {
    throw AppError.forbidden();
  }
  const where: any = { organizationId: auth.organizationId };
  if (year) where.year = year;
  return prisma.organizationTimesheet.findMany({ where, orderBy: [{ year: 'desc' }, { month: 'desc' }] });
}

export async function getOrganizationTimesheetById(auth: AuthContext, timesheetId: string) {
  if (!canManageAttendance(auth.role) && !canApproveOrgTimesheet(auth.role)) {
    throw AppError.forbidden();
  }
  const timesheet = await getOrganizationTimesheetOrThrow(auth.organizationId, timesheetId);
  const lines = await prisma.organizationTimesheetLine.findMany({
    where: { organizationTimesheetId: timesheetId },
    include: { departmentTimesheet: true },
  });
  return { ...timesheet, lines };
}

async function getOrganizationTimesheetOrThrow(organizationId: string, timesheetId: string) {
  const timesheet = await prisma.organizationTimesheet.findFirst({ where: { id: timesheetId, organizationId } });
  if (!timesheet) throw AppError.notFound('Tabel topilmadi');
  return timesheet;
}
