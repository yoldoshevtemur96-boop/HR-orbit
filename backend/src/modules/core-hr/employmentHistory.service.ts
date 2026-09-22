import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { recordAuditLog } from './auditLog.service';
import type { EmploymentStatus } from '@prisma/client';

interface ApplyEmploymentChangeInput {
  organizationId: string;
  employeeId: string;
  changedByUserId: string;
  changes: {
    positionId?: string | null;
    departmentId?: string | null;
    branchId?: string | null;
    managerId?: string | null;
    status?: EmploymentStatus;
  };
  reason: string;
}

// Markaziy funksiya — lavozim/bo'lim/filial/rahbar/status o'zgarishi FAQAT
// shu orqali amalga oshiriladi. Hech qachon Employee.position/department/
// branch/manager to'g'ridan-to'g'ri prisma.employee.update() bilan
// o'zgartirilmaydi (bu yerdan tashqarida) — chunki har bir o'zgarish
// tarixiy iz qoldirishi shart (foydalanuvchi talabi: "Never destroy
// historical employment records").
export async function applyEmploymentChange(input: ApplyEmploymentChangeInput) {
  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id: input.employeeId, organizationId: input.organizationId },
    });
    if (!employee) {
      throw AppError.notFound('Xodim topilmadi');
    }

    const now = new Date();

    // 1. Joriy ochiq EmploymentRecord'ni yopish (agar mavjud bo'lsa)
    const openRecord = await tx.employmentRecord.findFirst({
      where: { employeeId: employee.id, endDate: null },
      orderBy: { startDate: 'desc' },
    });
    if (openRecord) {
      await tx.employmentRecord.update({
        where: { id: openRecord.id },
        data: { endDate: now },
      });
    }

    // 2. Yangi maydonlar — o'zgarmagan qiymatlar eski holatdan olinadi (to'liq snapshot)
    const nextPositionId = input.changes.positionId !== undefined ? input.changes.positionId : employee.positionId;
    const nextDepartmentId = input.changes.departmentId !== undefined ? input.changes.departmentId : employee.departmentId;
    const nextBranchId = input.changes.branchId !== undefined ? input.changes.branchId : employee.branchId;
    const nextManagerId = input.changes.managerId !== undefined ? input.changes.managerId : employee.managerId;

    // 3. Yangi EmploymentRecord ochish
    await tx.employmentRecord.create({
      data: {
        organizationId: input.organizationId,
        employeeId: employee.id,
        positionId: nextPositionId,
        departmentId: nextDepartmentId,
        branchId: nextBranchId,
        managerId: nextManagerId,
        startDate: now,
        endDate: null,
        reason: input.reason,
        changedByUserId: input.changedByUserId,
      },
    });

    // 4. Employee'dagi denormalized joriy holatni yangilash
    const updated = await tx.employee.update({
      where: { id: employee.id },
      data: {
        positionId: nextPositionId,
        departmentId: nextDepartmentId,
        branchId: nextBranchId,
        managerId: nextManagerId,
        status: input.changes.status ?? employee.status,
      },
    });

    // 5. Audit log
    await recordAuditLog(
      {
        organizationId: input.organizationId,
        userId: input.changedByUserId,
        action: 'employee.employment.changed',
        entityType: 'Employee',
        entityId: employee.id,
        metadata: {
          reason: input.reason,
          oldValue: {
            positionId: employee.positionId,
            departmentId: employee.departmentId,
            branchId: employee.branchId,
            managerId: employee.managerId,
            status: employee.status,
          },
          newValue: {
            positionId: nextPositionId,
            departmentId: nextDepartmentId,
            branchId: nextBranchId,
            managerId: nextManagerId,
            status: updated.status,
          },
        },
      },
      tx,
    );

    return updated;
  });
}

export async function getEmploymentHistory(organizationId: string, employeeId: string) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, organizationId } });
  if (!employee) {
    throw AppError.notFound('Xodim topilmadi');
  }

  return prisma.employmentRecord.findMany({
    where: { employeeId },
    include: {
      position: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      manager: { select: { id: true, fullName: true } },
      changedByUser: { select: { id: true, email: true } },
    },
    orderBy: { startDate: 'desc' },
  });
}
