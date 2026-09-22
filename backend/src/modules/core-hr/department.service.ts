import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { recordAuditLog } from './auditLog.service';

interface CreateDepartmentInput {
  organizationId: string;
  actingUserId: string;
  name: string;
  code: string;
  parentId?: string;
}

export async function createDepartment(input: CreateDepartmentInput) {
  const existing = await prisma.department.findFirst({ where: { organizationId: input.organizationId, code: input.code } });
  if (existing) throw AppError.conflict("Bu bo'lim kodi band");

  const department = await prisma.$transaction(async (tx) => {
    const created = await tx.department.create({
      data: { organizationId: input.organizationId, name: input.name, code: input.code, parentId: input.parentId },
    });
    await recordAuditLog(
      {
        organizationId: input.organizationId,
        userId: input.actingUserId,
        action: 'department.created',
        entityType: 'Department',
        entityId: created.id,
        metadata: { name: created.name, code: created.code },
      },
      tx,
    );
    return created;
  });

  return department;
}

export async function listDepartments(organizationId: string) {
  const departments = await prisma.department.findMany({
    where: { organizationId },
    include: {
      headEmployee: { select: { id: true, fullName: true } },
      _count: { select: { employees: true, positions: true } },
    },
    orderBy: { name: 'asc' },
  });

  // Vacant positions = shu bo'limdagi barcha lavozimlarning approvedHeadcount
  // yig'indisi - shu bo'limdagi faol xodimlar soni.
  const positions = await prisma.position.groupBy({
    by: ['departmentId'],
    where: { organizationId },
    _sum: { approvedHeadcount: true },
  });
  const approvedByDept = new Map(positions.map((p) => [p.departmentId, p._sum.approvedHeadcount ?? 0]));

  return departments.map((d) => ({
    ...d,
    positionCount: d._count.positions,
    employeeCount: d._count.employees,
    vacantPositionCount: Math.max((approvedByDept.get(d.id) ?? 0) - d._count.employees, 0),
  }));
}

export async function getDepartmentById(organizationId: string, departmentId: string) {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, organizationId },
    include: { headEmployee: { select: { id: true, fullName: true } }, children: true },
  });
  if (!department) throw AppError.notFound("Bo'lim topilmadi");
  return department;
}

interface UpdateDepartmentInput {
  name?: string;
  parentId?: string | null;
}

export async function updateDepartment(organizationId: string, actingUserId: string, departmentId: string, input: UpdateDepartmentInput) {
  await getDepartmentById(organizationId, departmentId);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.department.update({ where: { id: departmentId }, data: input });
    await recordAuditLog(
      { organizationId, userId: actingUserId, action: 'department.updated', entityType: 'Department', entityId: departmentId, metadata: input },
      tx,
    );
    return updated;
  });
}

export async function setDepartmentHead(organizationId: string, actingUserId: string, departmentId: string, headEmployeeId: string) {
  await getDepartmentById(organizationId, departmentId);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.department.update({ where: { id: departmentId }, data: { headEmployeeId } });
    await recordAuditLog(
      { organizationId, userId: actingUserId, action: 'department.head_changed', entityType: 'Department', entityId: departmentId, metadata: { headEmployeeId } },
      tx,
    );
    return updated;
  });
}

// Hard-delete yo'q — faol xodimlar bo'lsa arxivlashga ruxsat berilmaydi,
// chunki tarixiy EmploymentRecord'lar shu bo'limga ishora qilib qolaveradi.
export async function archiveDepartment(organizationId: string, actingUserId: string, departmentId: string) {
  const department = await getDepartmentById(organizationId, departmentId);
  const activeCount = await prisma.employee.count({
    where: { departmentId, organizationId, status: { in: ['ACTIVE', 'PROBATION', 'ON_LEAVE', 'SUSPENDED'] } },
  });
  if (activeCount > 0) {
    throw AppError.conflict(`Bo'limda ${activeCount} ta faol xodim bor — avval ularni boshqa bo'limga o'tkazing`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.department.update({
      where: { id: departmentId },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    await recordAuditLog(
      { organizationId, userId: actingUserId, action: 'department.archived', entityType: 'Department', entityId: departmentId },
      tx,
    );
    return updated;
  });
}
