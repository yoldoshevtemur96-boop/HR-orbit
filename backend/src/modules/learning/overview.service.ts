import type { RoleName } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { getScope, isLearningAdmin, scopeWhere } from './assignment.service';

interface AuthContext {
  userId: string;
  organizationId: string;
  role: RoleName;
}

// L&D admin bosh sahifasi kartalari uchun jonli raqamlar. HR butun
// tashkilot bo'yicha ko'radi; departament rahbari — faqat o'z
// bo'ysunuvchilari bo'yicha tayinlovlar va so'rovlarni (katalog, tadbirlar,
// qoidalar unga ko'rsatilmaydi).
export async function getOverview(auth: AuthContext) {
  const { organizationId } = auth;
  const scope = await getScope(auth);
  const isHr = isLearningAdmin(auth.role);
  const now = new Date();

  const scopedEmployees = await prisma.employee.findMany({
    where: { organizationId, ...scopeWhere(scope) },
    select: { id: true },
  });
  const employeeIds = scopedEmployees.map((e) => e.id);

  const [activeAssignments, pendingRequests] = await Promise.all([
    prisma.learningAssignment.findMany({
      where: { organizationId, status: 'ACTIVE', employeeId: { in: employeeIds } },
      select: { employeeId: true, materialId: true, dueDate: true },
    }),
    prisma.learningRequest.count({ where: { organizationId, status: 'PENDING', employeeId: { in: employeeIds } } }),
  ]);

  const completed = await prisma.learningProgress.findMany({
    where: {
      organizationId,
      status: 'COMPLETED',
      employeeId: { in: [...new Set(activeAssignments.map((a) => a.employeeId))] },
      materialId: { in: [...new Set(activeAssignments.map((a) => a.materialId))] },
    },
    select: { employeeId: true, materialId: true },
  });
  const completedKeys = new Set(completed.map((c) => `${c.employeeId}:${c.materialId}`));
  const isDone = (a: { employeeId: string; materialId: string }) => completedKeys.has(`${a.employeeId}:${a.materialId}`);

  const assignments = {
    active: activeAssignments.filter((a) => !isDone(a)).length,
    completed: activeAssignments.filter(isDone).length,
    overdue: activeAssignments.filter((a) => !isDone(a) && a.dueDate && a.dueDate < now).length,
  };

  if (!isHr) {
    return { isHr, assignments, requests: { pending: pendingRequests } };
  }

  const [latestMaterials, materialCount, upcomingEvents, activeRules] = await Promise.all([
    prisma.learningMaterial.findMany({
      where: { organizationId, status: { not: 'ARCHIVED' } },
      select: { id: true, title: true, type: true, coverUrl: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
    prisma.learningMaterial.count({ where: { organizationId, status: { not: 'ARCHIVED' } } }),
    prisma.learningEvent.count({ where: { organizationId, status: 'PUBLISHED', endsAt: { gte: now } } }),
    prisma.learningAssignmentRule.count({ where: { organizationId, isActive: true } }),
  ]);

  return {
    isHr,
    assignments,
    requests: { pending: pendingRequests },
    catalog: { total: materialCount, latest: latestMaterials },
    events: { upcoming: upcomingEvents },
    rules: { active: activeRules },
  };
}
