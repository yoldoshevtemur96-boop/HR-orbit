import type { CorrectionReasonType, RoleName } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { getEmployeeById } from '@/modules/core-hr/employee.service';
import * as workflowInstanceService from '@/modules/workflow/instance.service';
import { assertCanViewEmployeeAttendance, upsertAttendanceRecord } from './attendanceRecord.service';
import { canManageAttendance, canSubmitCorrection } from './rbac';

interface AuthContext {
  userId: string;
  organizationId: string;
  role: RoleName;
}

// Departament rahbari o'z xodimi uchun so'rov yuboradi — u o'zi allaqachon
// "bevosita rahbar" bo'lgani uchun DIRECT_MANAGER bosqichi keraksiz,
// zanjir to'g'ridan-to'g'ri ROLE:TIMEKEEPER'dan boshlanadi.
const CORRECTION_TEMPLATE_NAME = "Davomat tuzatish so'rovi (rahbar tomonidan)";

async function getCorrectionTemplate(organizationId: string) {
  const template = await prisma.workflowTemplate.findFirst({
    where: { organizationId, name: CORRECTION_TEMPLATE_NAME, isActive: true },
  });
  if (!template) {
    throw AppError.badRequest("Davomat tuzatish shabloni sozlanmagan — administratorga murojaat qiling");
  }
  return template;
}

interface SubmitCorrectionInput {
  auth: AuthContext;
  employeeId: string;
  date: Date;
  reasonType: CorrectionReasonType;
  requestedCheckIn?: Date;
  requestedCheckOut?: Date;
  comment?: string;
}

// Departament rahbari o'z bo'limi xodimi uchun davomat tuzatish so'rovi
// yuboradi. Zanjir bitta bosqichli (ROLE:TIMEKEEPER) bo'lgani uchun
// AttendanceCorrection darhol PENDING_TIMEKEEPER holatida yaratiladi.
export async function submitCorrection(input: SubmitCorrectionInput) {
  if (!canSubmitCorrection(input.auth.role)) {
    throw AppError.forbidden("Faqat departament rahbari tuzatish so'rovi yubora oladi");
  }

  await assertCanViewEmployeeAttendance(input.auth, input.employeeId);
  const targetEmployee = await getEmployeeById(input.auth, input.employeeId);
  const template = await getCorrectionTemplate(input.auth.organizationId);

  const existingRecord = await prisma.attendanceRecord.findUnique({
    where: {
      organizationId_employeeId_date: {
        organizationId: input.auth.organizationId,
        employeeId: input.employeeId,
        date: input.date,
      },
    },
  });

  const formData = {
    employeeName: targetEmployee.fullName,
    date: input.date.toISOString().slice(0, 10),
    reasonType: input.reasonType,
    requestedCheckIn: input.requestedCheckIn?.toISOString() ?? '',
    requestedCheckOut: input.requestedCheckOut?.toISOString() ?? '',
    comment: input.comment ?? '',
  };

  const instance = await workflowInstanceService.createInstance({
    organizationId: input.auth.organizationId,
    templateId: template.id,
    initiatorUserId: input.auth.userId,
    employeeId: input.employeeId,
    formData,
  });

  return prisma.attendanceCorrection.create({
    data: {
      organizationId: input.auth.organizationId,
      employeeId: input.employeeId,
      attendanceRecordId: existingRecord?.id,
      date: input.date,
      reasonType: input.reasonType,
      requestedCheckIn: input.requestedCheckIn,
      requestedCheckOut: input.requestedCheckOut,
      comment: input.comment,
      status: 'PENDING_TIMEKEEPER',
      workflowInstanceId: instance.id,
    },
  });
}

// Departament rahbari yuborgan so'rovlar ro'yxati uchun xodim ismini ham
// qo'shib beradi (frontend'da alohida so'rov yubormasdan ko'rsatish uchun).
async function attachEmployeeInfo(auth: AuthContext, corrections: Array<{ employeeId: string }> & any[]) {
  const employeeIds = [...new Set(corrections.map((c) => c.employeeId))];
  if (employeeIds.length === 0) return corrections;

  const employees = await prisma.employee.findMany({
    where: { organizationId: auth.organizationId, id: { in: employeeIds } },
    select: { id: true, fullName: true, employeeCode: true },
  });
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  return corrections.map((c) => ({ ...c, employee: employeeById.get(c.employeeId) ?? null }));
}

// Departament rahbari o'zi yuborgan so'rovlar ro'yxati — WorkflowInstance
// orqali bog'langan (Attendance'da alohida "kim yubordi" maydoni yo'q,
// workflowInstance.initiatorUserId shu ma'lumotni allaqachon saqlaydi).
export async function listMyCorrections(auth: AuthContext) {
  const corrections = await prisma.attendanceCorrection.findMany({
    where: {
      organizationId: auth.organizationId,
      workflowInstance: { initiatorUserId: auth.userId },
    },
    orderBy: { createdAt: 'desc' },
  });

  return attachEmployeeInfo(auth, corrections);
}

// "Menga kelgan" — HR tabelchi uchun ROLE:TIMEKEEPER bosqichida turgan so'rovlar.
export async function listPendingCorrections(auth: AuthContext) {
  if (!canManageAttendance(auth.role)) {
    throw AppError.forbidden();
  }

  const corrections = await prisma.attendanceCorrection.findMany({
    where: { organizationId: auth.organizationId, status: 'PENDING_TIMEKEEPER' },
    orderBy: { createdAt: 'asc' },
  });

  return attachEmployeeInfo(auth, corrections);
}

// HR tabelchi so'rovni yakuniy tasdiqlaydi/rad etadi. Workflow'ning oxirgi
// bosqichini decideStep() orqali yopadi, so'ng APPROVED bo'lsa
// AttendanceRecord'ni avtomatik yangilaydi.
export async function finalizeCorrection(
  auth: AuthContext,
  correctionId: string,
  decision: 'APPROVED' | 'REJECTED',
  comment?: string,
) {
  if (!canManageAttendance(auth.role)) {
    throw AppError.forbidden();
  }

  const correction = await prisma.attendanceCorrection.findFirst({
    where: { id: correctionId, organizationId: auth.organizationId },
  });
  if (!correction) {
    throw AppError.notFound("So'rov topilmadi");
  }
  if (correction.status !== 'PENDING_TIMEKEEPER') {
    throw AppError.badRequest("Bu so'rov hozir sizning bosqichingizda emas");
  }
  if (!correction.workflowInstanceId) {
    throw AppError.badRequest("So'rov workflow bilan bog'lanmagan");
  }

  await workflowInstanceService.decideStep({
    organizationId: auth.organizationId,
    instanceId: correction.workflowInstanceId,
    actingUserId: auth.userId,
    decision,
    comment,
  });

  if (decision === 'REJECTED') {
    return prisma.attendanceCorrection.update({
      where: { id: correction.id },
      data: { status: 'REJECTED' },
    });
  }

  const existingRecord = correction.attendanceRecordId
    ? await prisma.attendanceRecord.findUnique({ where: { id: correction.attendanceRecordId } })
    : null;

  const record = await upsertAttendanceRecord({
    organizationId: auth.organizationId,
    editedByUserId: auth.userId,
    employeeId: correction.employeeId,
    date: correction.date,
    checkInTime: correction.requestedCheckIn ?? existingRecord?.checkInTime ?? null,
    checkOutTime: correction.requestedCheckOut ?? existingRecord?.checkOutTime ?? null,
    note: `Tuzatish so'rovi orqali (${correction.reasonType})`,
  });

  return prisma.attendanceCorrection.update({
    where: { id: correction.id },
    data: { status: 'APPLIED', attendanceRecordId: record.id },
  });
}
