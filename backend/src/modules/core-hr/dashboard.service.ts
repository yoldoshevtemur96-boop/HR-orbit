import { prisma } from '@/config/prisma';

const ACTIVE_STATUSES = ['ACTIVE', 'PROBATION', 'ON_LEAVE', 'SUSPENDED'] as const;

export async function getDashboardSummary(organizationId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalEmployees,
    activeEmployees,
    onLeaveEmployees,
    newEmployees,
    terminatedEmployees,
    positions,
    byDepartment,
    byBranch,
    byStatus,
  ] = await Promise.all([
    prisma.employee.count({ where: { organizationId } }),
    prisma.employee.count({ where: { organizationId, status: 'ACTIVE' } }),
    prisma.employee.count({ where: { organizationId, status: 'ON_LEAVE' } }),
    prisma.employee.count({ where: { organizationId, hiredAt: { gte: thirtyDaysAgo } } }),
    prisma.employee.count({ where: { organizationId, status: 'TERMINATED' } }),
    prisma.position.findMany({ where: { organizationId, status: 'ACTIVE' }, select: { id: true, approvedHeadcount: true } }),
    prisma.employee.groupBy({
      by: ['departmentId'],
      where: { organizationId, status: { in: [...ACTIVE_STATUSES] } },
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ['branchId'],
      where: { organizationId, status: { in: [...ACTIVE_STATUSES] } },
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: { _all: true },
    }),
  ]);

  const occupiedByPosition = await prisma.employee.groupBy({
    by: ['positionId'],
    where: { organizationId, status: { in: [...ACTIVE_STATUSES] } },
    _count: { _all: true },
  });
  const occupiedMap = new Map(occupiedByPosition.map((o) => [o.positionId, o._count._all]));
  const vacantPositions = positions.reduce(
    (sum, p) => sum + Math.max(p.approvedHeadcount - (occupiedMap.get(p.id) ?? 0), 0),
    0,
  );

  const departmentIds = byDepartment.map((d) => d.departmentId).filter((id): id is string => !!id);
  const branchIds = byBranch.map((b) => b.branchId).filter((id): id is string => !!id);
  const [departments, branches] = await Promise.all([
    prisma.department.findMany({ where: { id: { in: departmentIds } }, select: { id: true, name: true } }),
    prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } }),
  ]);
  const deptNameMap = new Map(departments.map((d) => [d.id, d.name]));
  const branchNameMap = new Map(branches.map((b) => [b.id, b.name]));

  return {
    kpi: {
      totalEmployees,
      activeEmployees,
      onLeaveEmployees,
      newEmployees,
      terminatedEmployees,
      vacantPositions,
    },
    byDepartment: byDepartment.map((d) => ({
      departmentId: d.departmentId,
      departmentName: d.departmentId ? deptNameMap.get(d.departmentId) ?? "Noma'lum" : 'Bo\'limsiz',
      count: d._count._all,
    })),
    byBranch: byBranch.map((b) => ({
      branchId: b.branchId,
      branchName: b.branchId ? branchNameMap.get(b.branchId) ?? "Noma'lum" : 'Filialsiz',
      count: b._count._all,
    })),
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
  };
}
