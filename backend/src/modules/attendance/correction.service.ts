import type { CorrectionReasonType, RoleName } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { getMyEmployee } from '@/modules/core-hr/employee.service';
import * as workflowInstanceService from '@/modules/workflow/instance.service';
import { upsertAttendanceRecord } from './attendanceRecord.service';
import { canManageAttendance } from './rbac';

interface AuthContext {
  userId: string;
  organizationId: string;
  role: RoleName;
}

const CORRECTION_TEMPLATE_NAME = "Davomat tuzatish so'rovi";

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
  date: Date;
  reasonType: CorrectionReasonType;
  requestedCheckIn?: Date;
  requestedCheckOut?: Date;
  comment?: string;
}

// Xodim o'zi uchun davomat tuzatish so'rovi yuboradi — Workflow Engine
// qayta ishlatiladi (DIRECT_MANAGER -> ROLE:TIMEKEEPER zanjiri).
export async function submitCorrection(input: SubmitCorrectionInput) {
  const self = await getMyEmployee(input.auth);
  const template = await getCorrectionTemplate(input.auth.organizationId);

  const existingRecord = await prisma.attendanceRecord.findUnique({
    where: {
      organizationId_employeeId_date: { organizationId: input.auth.organizationId, employeeId: self.id, date: input.date },
    },
  });

  const formData = {
    employeeName: self.fullName,
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
    employeeId: self.id,
    formData,
  });

  return prisma.attendanceCorrection.create({
    data: {
      organizationId: input.auth.organizationId,
      employeeId: self.id,
      attendanceRecordId: existingRecord?.id,
      date: input.date,
      reasonType: input.reasonType,
      requestedCheckIn: input.requestedCheckIn,
      requestedCheckOut: input.requestedCheckOut,
      comment: input.comment,
      status: 'PENDING_MANAGER',
      workflowInstanceId: instance.id,
    },
  });
}

// DIRECT_MANAGER bosqichi Workflow Engine'ning umumiy /decide endpoint'i
// orqali o'tadi (Attendance'ga tegmasdan) — shuning uchun Attendance'dagi
// status shu yerda "o'qishda" WorkflowInstance holatiga solishtirilib
// yangilanadi. Bu Workflow Engine'ga Attendance haqida hech narsa
// import/bilishga majbur qilmasdan ikki modulni sinxron ushlab turadi.
async function syncPendingManagerCorrections(organizationId: string, corrections: Array<{ id: string; workflowInstanceId: string | null }>) {
  const pending = corrections.filter((c) => c.workflowInstanceId);
  if (pending.length === 0) return;

  await Promise.all(
    pending.map(async (correction) => {
      const instance = await workflowInstanceService.getInstanceById(organizationId, correction.workflowInstanceId!);
      if (instance.status === 'REJECTED') {
        await prisma.attendanceCorrection.update({ where: { id: correction.id }, data: { status: 'REJECTED' } });
      } else if (instance.currentStepOrder > 1 || instance.status === 'APPROVED') {
        await prisma.attendanceCorrection.update({ where: { id: correction.id }, data: { status: 'PENDING_TIMEKEEPER' } });
      }
    }),
  );
}

export async function listMyCorrections(auth: AuthContext) {
  const self = await getMyEmployee(auth);
  const corrections = await prisma.attendanceCorrection.findMany({
    where: { organizationId: auth.organizationId, employeeId: self.id },
    orderBy: { createdAt: 'desc' },
  });

  await syncPendingManagerCorrections(
    auth.organizationId,
    corrections.filter((c) => c.status === 'PENDING_MANAGER'),
  );

  return prisma.attendanceCorrection.findMany({
    where: { organizationId: auth.organizationId, employeeId: self.id },
    orderBy: { createdAt: 'desc' },
  });
}

// "Menga kelgan" — HR tabelchi uchun oxirgi (TIMEKEEPER) bosqichda turgan
// so'rovlar. Oraliq (DIRECT_MANAGER) bosqichi Workflow Engine'ning umumiy
// "/workflow/instances/pending-for-me" orqali ko'rinadi, bu yerga tegishli emas.
export async function listPendingCorrections(auth: AuthContext) {
  if (!canManageAttendance(auth.role)) {
    throw AppError.forbidden();
  }

  const stillPendingManager = await prisma.attendanceCorrection.findMany({
    where: { organizationId: auth.organizationId, status: 'PENDING_MANAGER' },
  });
  await syncPendingManagerCorrections(auth.organizationId, stillPendingManager);

  return prisma.attendanceCorrection.findMany({
    where: { organizationId: auth.organizationId, status: 'PENDING_TIMEKEEPER' },
    orderBy: { createdAt: 'asc' },
  });
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
