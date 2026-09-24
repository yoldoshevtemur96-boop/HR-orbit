import type { RoleName } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { getMyEmployee } from '@/modules/core-hr/employee.service';
import { listCorrectionsForDepartmentMonth } from './correction.service';
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
  hasCorrection: boolean; // departament rahbari shu kun uchun izoh qoldirganmi
  correctionComment: string | null;
  edited?: boolean; // katak qo'lda o'zgartirilgan (TimesheetCellEdit)
  editComment?: string | null;
  originalCode?: string; // o'zgartirishdan oldingi kod (turniket bo'yicha)
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
function mapRecordToDayCell(
  day: number,
  date: Date,
  record: { status: string; workedMinutes: number } | undefined,
  correctionComment: string | null,
): DayCell {
  const correctionFields = { hasCorrection: correctionComment !== null, correctionComment };

  if (!record) {
    const dayOfWeek = date.getUTCDay(); // 0=yakshanba, 6=shanba
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { day, code: 'В', hours: null, ...correctionFields };
    }
    return { day, code: '', hours: null, ...correctionFields };
  }

  switch (record.status) {
    case 'PRESENT':
    case 'LATE':
    case 'EARLY_LEAVE': {
      const hours = Math.round((record.workedMinutes / 60) * 10) / 10;
      return { day, code: hours > 0 ? String(hours) : '8', hours, ...correctionFields };
    }
    case 'ON_LEAVE':
      return { day, code: 'Д', hours: null, ...correctionFields };
    case 'SICK':
      return { day, code: 'К', hours: null, ...correctionFields };
    case 'BUSINESS_TRIP':
      return { day, code: 'С', hours: null, ...correctionFields };
    case 'REMOTE':
      return { day, code: 'М', hours: null, ...correctionFields };
    case 'ABSENT':
    default:
      return { day, code: '', hours: null, ...correctionFields };
  }
}

function isWorkedCode(code: string) {
  return code !== '' && !Number.isNaN(Number(code));
}

// Qatordagi bitta katakni qo'lda kiritilgan soat bilan almashtiradi va
// qator jamlanmalarini (ishlagan kun/soat, kelmagan kun) moslashtiradi.
// Tabel yig'ilganda ham, tayyor tabel snapshot'ini tahrirlashda ham
// shu funksiya ishlatiladi — natija bir xil bo'lishi uchun.
function applyCellEdit(line: EmployeeSummaryLine, day: number, hours: number, comment: string) {
  const cell = line.days.find((c) => c.day === day);
  if (!cell) return;

  const wasWorked = isWorkedCode(cell.code);
  if (!wasWorked) {
    line.presentDays += 1;
    if (cell.code === '' && line.absentDays > 0) line.absentDays -= 1;
  }
  line.workedHours = Math.round((line.workedHours - (cell.hours ?? 0) + hours) * 100) / 100;

  if (!cell.edited) cell.originalCode = cell.code;
  cell.code = String(hours);
  cell.hours = hours;
  cell.edited = true;
  cell.editComment = comment;
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

  const corrections = await listCorrectionsForDepartmentMonth(
    organizationId,
    employees.map((e) => e.id),
    start,
    end,
  );
  const cellEdits = await prisma.timesheetCellEdit.findMany({
    where: { organizationId, employeeId: { in: employees.map((e) => e.id) }, date: { gte: start, lt: end } },
  });

  const correctionByEmployeeAndDay = new Map<string, Map<number, string>>();
  for (const c of corrections) {
    const dayMap = correctionByEmployeeAndDay.get(c.employeeId) ?? new Map<number, string>();
    dayMap.set(c.date.getUTCDate(), c.comment ?? '');
    correctionByEmployeeAndDay.set(c.employeeId, dayMap);
  }

  const summary: EmployeeSummaryLine[] = employees.map((employee) => {
    const employeeRecords = recordsByEmployee.get(employee.id) ?? [];
    const recordByDay = new Map(employeeRecords.map((r) => [r.date.getUTCDate(), r]));
    const employeeCorrections = correctionByEmployeeAndDay.get(employee.id) ?? new Map<number, string>();
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
      const correctionComment = employeeCorrections.get(day) ?? null;
      line.days.push(mapRecordToDayCell(day, date, recordByDay.get(day), correctionComment));
    }

    for (const edit of cellEdits.filter((e) => e.employeeId === employee.id)) {
      applyCellEdit(line, edit.date.getUTCDate(), edit.hours, edit.comment);
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

// HR departament rahbari yubormagan (yoki umuman yaratilmagan) bo'lim
// tabelini o'zi tasdiqlab o'tkazadi — sabab majburiy. Tabel turniket
// ma'lumotidan yangidan yig'iladi. Rahbar allaqachon yuborgan tabel
// (DEPT_SUBMITTED) oddiy decide oqimi orqali tasdiqlanadi.
export async function hrApproveDepartmentTimesheet(
  auth: AuthContext,
  input: { departmentId: string; year: number; month: number; reason: string },
) {
  if (!canManageAttendance(auth.role)) {
    throw AppError.forbidden();
  }

  const department = await prisma.department.findFirst({
    where: { id: input.departmentId, organizationId: auth.organizationId },
  });
  if (!department) throw AppError.notFound("Bo'lim topilmadi");

  const key = {
    organizationId: auth.organizationId,
    departmentId: input.departmentId,
    year: input.year,
    month: input.month,
  };
  const existing = await prisma.departmentTimesheet.findUnique({ where: { organizationId_departmentId_year_month: key } });
  if (existing && existing.status !== 'DRAFT' && existing.status !== 'DEPT_REJECTED') {
    throw AppError.badRequest(
      existing.status === 'DEPT_SUBMITTED'
        ? "Rahbar bu tabelni yuborgan — uni oddiy tartibda tasdiqlang"
        : 'Bu tabel allaqachon tasdiqlangan',
    );
  }

  const summaryData = await buildDepartmentSummary(auth.organizationId, input.departmentId, input.year, input.month);
  const now = new Date();
  const approvedData = {
    status: 'DEPT_APPROVED' as const,
    summaryData: summaryData as any,
    generatedByUserId: auth.userId,
    deptApprovedByUserId: auth.userId,
    deptApprovedAt: now,
    rejectionComment: null,
    hrOverride: true,
    hrOverrideReason: input.reason,
  };

  return prisma.departmentTimesheet.upsert({
    where: { organizationId_departmentId_year_month: key },
    create: { ...key, ...approvedData },
    update: approvedData,
  });
}

// Bo'lim tabelini bazaga saqlamasdan turniket ma'lumotidan yig'ib
// qaytaradi — HR hali yaratilmagan/yuborilmagan tabelni ko'rishi uchun.
export async function previewDepartmentSummary(auth: AuthContext, departmentId: string, year: number, month: number) {
  if (!canManageAttendance(auth.role)) {
    throw AppError.forbidden();
  }
  const department = await prisma.department.findFirst({ where: { id: departmentId, organizationId: auth.organizationId } });
  if (!department) throw AppError.notFound("Bo'lim topilmadi");
  return buildDepartmentSummary(auth.organizationId, departmentId, year, month);
}

// Tabel katagini qo'lda o'zgartirish (1-8 soat + izoh):
// - DEPARTMENT_HEAD — faqat o'z bo'limi, konsolidatsiyadan oldin istalgan
//   bosqichda (yuborilgan/tasdiqlangan bo'lsa ham — u holda tabel
//   qoralamaga qaytadi). HR tasdiqlab o'tkazgan tabel yopiq;
// - HR/tabelchi — tashkilot tabelida (Joriy va Tasdiqlangan), bo'lim
//   tabeli hali konsolidatsiya qilinmagan bo'lsa.
// O'zgartirish TimesheetCellEdit'da saqlanadi (qayta generatsiyada ham
// qo'llanadi) va tabel snapshot'iga darhol yoziladi.
export async function editTimesheetCell(
  auth: AuthContext,
  input: { employeeId: string; date: Date; hours: number; comment: string },
) {
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, organizationId: auth.organizationId },
    select: { id: true, departmentId: true },
  });
  if (!employee?.departmentId) throw AppError.notFound('Xodim topilmadi');

  const year = input.date.getUTCFullYear();
  const month = input.date.getUTCMonth() + 1;
  const timesheet = await prisma.departmentTimesheet.findUnique({
    where: {
      organizationId_departmentId_year_month: {
        organizationId: auth.organizationId,
        departmentId: employee.departmentId,
        year,
        month,
      },
    },
  });
  if (auth.role === 'DEPARTMENT_HEAD') {
    if (!timesheet) throw AppError.notFound('Bu oy uchun bo\'lim tabeli topilmadi');
    const self = await getMyEmployee(auth);
    if (self.departmentId !== employee.departmentId) throw AppError.forbidden();
    if (timesheet.status === 'CONSOLIDATED') {
      throw AppError.badRequest("Tabel rahbariyatga yuborilgan — endi o'zgartirib bo'lmaydi");
    }
    if (timesheet.hrOverride) {
      throw AppError.badRequest("Bu tabelni HR tasdiqlab o'tkazgan — o'zgartirib bo'lmaydi");
    }
  } else if (canManageAttendance(auth.role)) {
    // HR/tabelchi istalgan bosqichda (hatto tabel hali yaratilmagan
    // bo'lsa ham) tahrirlay oladi — faqat rahbariyatga yuborilgan
    // (konsolidatsiya qilingan) tabel yopiq.
    if (timesheet?.status === 'CONSOLIDATED') {
      throw AppError.badRequest("Tabel rahbariyatga yuborilgan — endi o'zgartirib bo'lmaydi");
    }
  } else {
    throw AppError.forbidden();
  }

  await prisma.timesheetCellEdit.upsert({
    where: {
      organizationId_employeeId_date: {
        organizationId: auth.organizationId,
        employeeId: input.employeeId,
        date: input.date,
      },
    },
    create: {
      organizationId: auth.organizationId,
      employeeId: input.employeeId,
      date: input.date,
      hours: input.hours,
      comment: input.comment,
      editedByUserId: auth.userId,
      editedByRole: auth.role,
    },
    update: {
      hours: input.hours,
      comment: input.comment,
      editedByUserId: auth.userId,
      editedByRole: auth.role,
    },
  });

  // Tabel hali yaratilmagan bo'lsa — o'zgartirish saqlandi, tabel
  // yig'ilganda (yoki preview'da) avtomatik qo'llanadi.
  if (!timesheet) return null;

  const summaryData = timesheet.summaryData as unknown as EmployeeSummaryLine[];
  const line = summaryData.find((l) => l.employeeId === input.employeeId);
  if (!line) return timesheet;
  applyCellEdit(line, input.date.getUTCDate(), input.hours, input.comment);

  // Rahbar yuborilgan/tasdiqlangan tabelni o'zgartirsa — tabel qoralamaga
  // qaytadi va HR'ga qayta yuborilib, qayta tasdiqlanishi kerak.
  const revertToDraft =
    auth.role === 'DEPARTMENT_HEAD' && (timesheet.status === 'DEPT_SUBMITTED' || timesheet.status === 'DEPT_APPROVED');

  return prisma.departmentTimesheet.update({
    where: { id: timesheet.id },
    data: {
      summaryData: summaryData as any,
      ...(revertToDraft && { status: 'DRAFT', submittedAt: null, deptApprovedByUserId: null, deptApprovedAt: null }),
    },
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
