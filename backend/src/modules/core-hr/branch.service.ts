import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { recordAuditLog } from './auditLog.service';

interface CreateBranchInput {
  organizationId: string;
  actingUserId: string;
  name: string;
  code: string;
  region?: string;
  address?: string;
}

export async function createBranch(input: CreateBranchInput) {
  const existing = await prisma.branch.findFirst({ where: { organizationId: input.organizationId, code: input.code } });
  if (existing) throw AppError.conflict('Bu filial kodi band');

  return prisma.$transaction(async (tx) => {
    const created = await tx.branch.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        code: input.code,
        region: input.region,
        address: input.address,
      },
    });
    await recordAuditLog(
      { organizationId: input.organizationId, userId: input.actingUserId, action: 'branch.created', entityType: 'Branch', entityId: created.id, metadata: { name: created.name } },
      tx,
    );
    return created;
  });
}

export async function listBranches(organizationId: string) {
  const branches = await prisma.branch.findMany({
    where: { organizationId },
    include: {
      manager: { select: { id: true, fullName: true } },
      _count: { select: { employees: true, positions: true } },
    },
    orderBy: { name: 'asc' },
  });

  return branches.map((b) => ({ ...b, employeeCount: b._count.employees, positionCount: b._count.positions }));
}

export async function getBranchById(organizationId: string, branchId: string) {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    include: { manager: { select: { id: true, fullName: true } } },
  });
  if (!branch) throw AppError.notFound('Filial topilmadi');
  return branch;
}

interface UpdateBranchInput {
  name?: string;
  region?: string | null;
  address?: string | null;
  managerId?: string | null;
}

export async function updateBranch(organizationId: string, actingUserId: string, branchId: string, input: UpdateBranchInput) {
  await getBranchById(organizationId, branchId);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.branch.update({ where: { id: branchId }, data: input });
    await recordAuditLog(
      { organizationId, userId: actingUserId, action: 'branch.updated', entityType: 'Branch', entityId: branchId, metadata: input },
      tx,
    );
    return updated;
  });
}

export async function archiveBranch(organizationId: string, actingUserId: string, branchId: string) {
  await getBranchById(organizationId, branchId);
  const activeCount = await prisma.employee.count({
    where: { branchId, organizationId, status: { in: ['ACTIVE', 'PROBATION', 'ON_LEAVE', 'SUSPENDED'] } },
  });
  if (activeCount > 0) {
    throw AppError.conflict(`Filialda ${activeCount} ta faol xodim bor — avval ularni boshqa filialga o'tkazing`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.branch.update({ where: { id: branchId }, data: { status: 'ARCHIVED', archivedAt: new Date() } });
    await recordAuditLog(
      { organizationId, userId: actingUserId, action: 'branch.archived', entityType: 'Branch', entityId: branchId },
      tx,
    );
    return updated;
  });
}
