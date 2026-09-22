import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { recordAuditLog } from './auditLog.service';

const ACTIVE_STATUSES = ['ACTIVE', 'PROBATION', 'ON_LEAVE', 'SUSPENDED'] as const;

interface CreatePositionInput {
  organizationId: string;
  actingUserId: string;
  name: string;
  code: string;
  departmentId: string;
  branchId?: string;
  grade?: string;
  approvedHeadcount?: number;
}

export async function createPosition(input: CreatePositionInput) {
  const existing = await prisma.position.findFirst({ where: { organizationId: input.organizationId, code: input.code } });
  if (existing) throw AppError.conflict('Bu lavozim kodi band');

  const department = await prisma.department.findFirst({ where: { id: input.departmentId, organizationId: input.organizationId } });
  if (!department) throw AppError.badRequest("Ko'rsatilgan bo'lim topilmadi");

  return prisma.$transaction(async (tx) => {
    const created = await tx.position.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        code: input.code,
        departmentId: input.departmentId,
        branchId: input.branchId,
        grade: input.grade,
        approvedHeadcount: input.approvedHeadcount ?? 1,
      },
    });
    await recordAuditLog(
      { organizationId: input.organizationId, userId: input.actingUserId, action: 'position.created', entityType: 'Position', entityId: created.id, metadata: { name: created.name } },
      tx,
    );
    return created;
  });
}

export async function listPositions(organizationId: string) {
  const positions = await prisma.position.findMany({
    where: { organizationId },
    include: {
      department: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });

  const occupiedCounts = await prisma.employee.groupBy({
    by: ['positionId'],
    where: { organizationId, status: { in: [...ACTIVE_STATUSES] } },
    _count: { _all: true },
  });
  const occupiedByPosition = new Map(occupiedCounts.map((c) => [c.positionId, c._count._all]));

  return positions.map((p) => {
    const occupiedHeadcount = occupiedByPosition.get(p.id) ?? 0;
    return {
      ...p,
      occupiedHeadcount,
      vacantHeadcount: Math.max(p.approvedHeadcount - occupiedHeadcount, 0),
    };
  });
}

export async function getPositionById(organizationId: string, positionId: string) {
  const position = await prisma.position.findFirst({
    where: { id: positionId, organizationId },
    include: { department: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
  });
  if (!position) throw AppError.notFound('Lavozim topilmadi');

  const occupiedHeadcount = await prisma.employee.count({
    where: { positionId, organizationId, status: { in: [...ACTIVE_STATUSES] } },
  });

  return { ...position, occupiedHeadcount, vacantHeadcount: Math.max(position.approvedHeadcount - occupiedHeadcount, 0) };
}

interface UpdatePositionInput {
  name?: string;
  grade?: string | null;
  approvedHeadcount?: number;
  branchId?: string | null;
}

export async function updatePosition(organizationId: string, actingUserId: string, positionId: string, input: UpdatePositionInput) {
  await getPositionById(organizationId, positionId);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.position.update({ where: { id: positionId }, data: input });
    await recordAuditLog(
      { organizationId, userId: actingUserId, action: 'position.updated', entityType: 'Position', entityId: positionId, metadata: input },
      tx,
    );
    return updated;
  });
}

export async function archivePosition(organizationId: string, actingUserId: string, positionId: string) {
  await getPositionById(organizationId, positionId);
  const activeCount = await prisma.employee.count({
    where: { positionId, organizationId, status: { in: [...ACTIVE_STATUSES] } },
  });
  if (activeCount > 0) {
    throw AppError.conflict(`Bu lavozimda ${activeCount} ta faol xodim bor — avval ularni boshqa lavozimga o'tkazing`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.position.update({ where: { id: positionId }, data: { status: 'ARCHIVED', archivedAt: new Date() } });
    await recordAuditLog(
      { organizationId, userId: actingUserId, action: 'position.archived', entityType: 'Position', entityId: positionId },
      tx,
    );
    return updated;
  });
}
