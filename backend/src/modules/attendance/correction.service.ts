import type { RoleName } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { assertCanViewEmployeeAttendance } from './attendanceRecord.service';
import { canSubmitCorrection } from './rbac';

interface AuthContext {
  userId: string;
  organizationId: string;
  role: RoleName;
}

interface SubmitCorrectionInput {
  auth: AuthContext;
  employeeId: string;
  date: Date;
  comment: string;
}

// Departament rahbari o'z bo'limi xodimi uchun davomat bilan bog'liq
// erkin matnli izoh qoldiradi (masalan "turniket ishlamadi"). Bu hech
// qanday tasdiqlash zanjiri boshlamaydi — shunchaki AttendanceCorrection
// yozuvi sifatida saqlanadi. HR tabelchi buni bo'lim tabelidagi (kunma-
// kun jadval) belgilangan katakcha orqali ko'radi, kerak bo'lsa kunlik
// jadvaldagi "Tuzatish" tugmasi orqali yozuvni o'zi to'g'irlaydi.
export async function submitCorrection(input: SubmitCorrectionInput) {
  if (!canSubmitCorrection(input.auth.role)) {
    throw AppError.forbidden("Faqat departament rahbari izoh qoldira oladi");
  }

  await assertCanViewEmployeeAttendance(input.auth, input.employeeId);

  const existingRecord = await prisma.attendanceRecord.findUnique({
    where: {
      organizationId_employeeId_date: {
        organizationId: input.auth.organizationId,
        employeeId: input.employeeId,
        date: input.date,
      },
    },
  });

  return prisma.attendanceCorrection.create({
    data: {
      organizationId: input.auth.organizationId,
      employeeId: input.employeeId,
      attendanceRecordId: existingRecord?.id,
      date: input.date,
      reasonType: 'WRONG_CHECK_IN',
      comment: input.comment,
      status: 'APPLIED',
    },
  });
}

// Bo'lim + oy oralig'i uchun barcha izohlarni {employeeId, day, comment}
// ko'rinishida qaytaradi — timesheet.service.ts kunma-kun jadval
// katakchalarini belgilash uchun ishlatadi.
export async function listCorrectionsForDepartmentMonth(
  organizationId: string,
  employeeIds: string[],
  start: Date,
  end: Date,
) {
  if (employeeIds.length === 0) return [];

  return prisma.attendanceCorrection.findMany({
    where: { organizationId, employeeId: { in: employeeIds }, date: { gte: start, lt: end } },
    select: { employeeId: true, date: true, comment: true },
  });
}
