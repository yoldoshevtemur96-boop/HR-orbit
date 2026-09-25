import type { LearningAssignmentReason, Prisma, RoleName } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';

interface AuthContext {
  userId: string;
  organizationId: string;
  role: RoleName;
}

// L&D admin — tayinlash. HR (SUPER_ADMIN/HR_MANAGER) butun tashkilot
// bo'yicha, DEPARTMENT_HEAD faqat o'z bo'ysunuvchilari (bevosita
// xodimlari + o'zi boshqaradigan bo'limlar xodimlari) bo'yicha ishlaydi.

const ASSIGNABLE_EMPLOYMENT_STATUSES = ['ACTIVE', 'PROBATION', 'ON_LEAVE'] as const;
const REMINDER_DAYS_BEFORE_DUE = 3;

export function isLearningAdmin(role: RoleName) {
  return role === 'SUPER_ADMIN' || role === 'HR_MANAGER';
}

interface Scope {
  all: boolean;
  employeeIds: Set<string>;
}

async function getScope(auth: AuthContext): Promise<Scope> {
  if (isLearningAdmin(auth.role)) return { all: true, employeeIds: new Set() };
  if (auth.role !== 'DEPARTMENT_HEAD') throw AppError.forbidden();

  const self = await prisma.employee.findFirst({
    where: { userId: auth.userId, organizationId: auth.organizationId },
    select: { id: true },
  });
  if (!self) throw AppError.forbidden();

  const headed = await prisma.department.findMany({
    where: { organizationId: auth.organizationId, headEmployeeId: self.id },
    select: { id: true },
  });
  const subordinates = await prisma.employee.findMany({
    where: {
      organizationId: auth.organizationId,
      id: { not: self.id },
      OR: [{ managerId: self.id }, { departmentId: { in: headed.map((d) => d.id) } }],
    },
    select: { id: true },
  });
  return { all: false, employeeIds: new Set(subordinates.map((e) => e.id)) };
}

function scopeWhere(scope: Scope): Prisma.EmployeeWhereInput {
  return scope.all ? {} : { id: { in: [...scope.employeeIds] } };
}

export interface AudienceInput {
  allOrganization?: boolean;
  departmentIds?: string[];
  positionIds?: string[];
  branchIds?: string[];
  employeeIds?: string[];
}

// Auditoriya — tanlangan mezonlar birlashmasi (bo'lim YOKI lavozim YOKI ...).
async function resolveAudience(auth: AuthContext, scope: Scope, audience: AudienceInput) {
  // "Butun tashkilot" boshqa mezonlarni qamrab oladi. Uni OR ichida `{}`
  // qilib berib bo'lmaydi — Prisma bo'sh shartni OR'dan tashlab yuboradi.
  const or: Prisma.EmployeeWhereInput[] = audience.allOrganization ? [{ organizationId: auth.organizationId }] : [];
  if (audience.departmentIds?.length) or.push({ departmentId: { in: audience.departmentIds } });
  if (audience.positionIds?.length) or.push({ positionId: { in: audience.positionIds } });
  if (audience.branchIds?.length) or.push({ branchId: { in: audience.branchIds } });
  if (audience.employeeIds?.length) or.push({ id: { in: audience.employeeIds } });
  if (or.length === 0) return [];

  return prisma.employee.findMany({
    where: {
      organizationId: auth.organizationId,
      status: { in: [...ASSIGNABLE_EMPLOYMENT_STATUSES] },
      AND: [scopeWhere(scope), { OR: or }],
    },
    select: { id: true, fullName: true, employeeCode: true, userId: true, department: { select: { name: true } } },
    orderBy: { fullName: 'asc' },
  });
}

export interface AssignInput {
  materialId: string;
  audience: AudienceInput;
  reason: LearningAssignmentReason;
  reasonText?: string;
  note?: string;
  dueDate?: Date;
  dueInDays?: number;
  skipIfCompletedWithinDays?: number;
}

async function getPublishedMaterial(organizationId: string, materialId: string) {
  const material = await prisma.learningMaterial.findFirst({
    where: { id: materialId, organizationId, status: 'PUBLISHED' },
    select: { id: true, title: true },
  });
  if (!material) throw AppError.notFound('Material topilmadi');
  return material;
}

// Auditoriyani 3 guruhga ajratadi: tayinlanadiganlar, faol tayinlovi
// borlar (doim o'tkazib yuboriladi) va yaqinda tugatganlar (sozlama).
async function planAssignment(auth: AuthContext, input: AssignInput) {
  const scope = await getScope(auth);
  const material = await getPublishedMaterial(auth.organizationId, input.materialId);
  const audience = await resolveAudience(auth, scope, input.audience);
  const ids = audience.map((e) => e.id);

  const [active, progress] = await Promise.all([
    prisma.learningAssignment.findMany({
      where: { organizationId: auth.organizationId, materialId: material.id, status: 'ACTIVE', employeeId: { in: ids } },
      select: { employeeId: true },
    }),
    prisma.learningProgress.findMany({
      where: { organizationId: auth.organizationId, materialId: material.id, employeeId: { in: ids } },
      select: { employeeId: true, status: true, completedAt: true },
    }),
  ]);
  const activeIds = new Set(active.map((a) => a.employeeId));
  const progressById = new Map(progress.map((p) => [p.employeeId, p]));

  const threshold = input.skipIfCompletedWithinDays
    ? new Date(Date.now() - input.skipIfCompletedWithinDays * 24 * 60 * 60 * 1000)
    : null;

  const toAssign: typeof audience = [];
  const skippedActive: typeof audience = [];
  const skippedCompleted: typeof audience = [];
  for (const employee of audience) {
    const p = progressById.get(employee.id);
    if (activeIds.has(employee.id)) skippedActive.push(employee);
    else if (threshold && p?.status === 'COMPLETED' && p.completedAt && p.completedAt >= threshold) skippedCompleted.push(employee);
    else toAssign.push(employee);
  }
  return { material, toAssign, skippedActive, skippedCompleted, progressById };
}

function summarizeEmployees(list: { id: string; fullName: string; employeeCode: string; department: { name: string } | null }[]) {
  return list.slice(0, 200).map((e) => ({ id: e.id, fullName: e.fullName, employeeCode: e.employeeCode, department: e.department?.name ?? null }));
}

export async function previewAssignment(auth: AuthContext, input: AssignInput) {
  const plan = await planAssignment(auth, input);
  return {
    total: plan.toAssign.length + plan.skippedActive.length + plan.skippedCompleted.length,
    toAssignCount: plan.toAssign.length,
    skippedActiveCount: plan.skippedActive.length,
    skippedCompletedCount: plan.skippedCompleted.length,
    toAssign: summarizeEmployees(plan.toAssign),
    skippedActive: summarizeEmployees(plan.skippedActive),
    skippedCompleted: summarizeEmployees(plan.skippedCompleted),
  };
}

function resolveDueDate(input: AssignInput): Date | null {
  if (input.dueDate) return input.dueDate;
  if (input.dueInDays) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + input.dueInDays);
    d.setUTCHours(18, 59, 59, 0); // Toshkent vaqti bilan kun oxiri (23:59, UTC+5)
    return d;
  }
  return null;
}

function formatDateUz(date: Date) {
  return date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Tashkent' });
}

export async function createAssignments(auth: AuthContext, input: AssignInput) {
  if (input.reason === 'OTHER' && !input.reasonText?.trim()) {
    throw AppError.badRequest('"Boshqa" sabab uchun izoh yozing');
  }
  const plan = await planAssignment(auth, input);
  if (plan.toAssign.length === 0) {
    throw AppError.badRequest("Tayinlanadigan xodim yo'q — hammasida faol tayinlov bor yoki yaqinda tugatgan");
  }

  const dueDate = resolveDueDate(input);
  const employeeIds = plan.toAssign.map((e) => e.id);
  // Avval tugatgan xodim qayta tayinlansa — yangi urinish: progress noldan.
  const completedBefore = employeeIds.filter((id) => plan.progressById.get(id)?.status === 'COMPLETED');

  const message =
    `Sizga yangi o'quv material tayinlandi: "${plan.material.title}"` + (dueDate ? ` — muddat: ${formatDateUz(dueDate)}` : '');

  const created = await prisma.$transaction(async (tx) => {
    const result = await tx.learningAssignment.createMany({
      data: employeeIds.map((employeeId) => ({
        organizationId: auth.organizationId,
        employeeId,
        materialId: plan.material.id,
        assignedByUserId: auth.userId,
        dueDate,
        note: input.note?.trim() || null,
        reason: input.reason,
        reasonText: input.reason === 'OTHER' ? input.reasonText?.trim() : null,
        source: 'MANUAL',
      })),
      skipDuplicates: true, // parallel so'rovda faol tayinlov unique indeksi bilan to'qnashsa
    });

    if (completedBefore.length > 0) {
      await tx.learningProgress.updateMany({
        where: { materialId: plan.material.id, employeeId: { in: completedBefore } },
        data: { progress: 0, status: 'IN_PROGRESS', completedAt: null },
      });
    }

    await tx.notification.createMany({
      data: plan.toAssign
        .filter((e) => e.userId)
        .map((e) => ({
          organizationId: auth.organizationId,
          userId: e.userId!,
          type: 'LEARNING_ASSIGNED' as const,
          message,
          entityType: 'LearningMaterial',
          entityId: plan.material.id,
        })),
    });
    return result.count;
  });

  return {
    assignedCount: created,
    skippedActiveCount: plan.skippedActive.length,
    skippedCompletedCount: plan.skippedCompleted.length,
  };
}

// ---------------------------------------------------------------------------
// Ro'yxat va boshqaruv
// ---------------------------------------------------------------------------

export type AssignmentState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';

export async function listAssignments(
  auth: AuthContext,
  query: { materialId?: string; departmentId?: string; state?: AssignmentState; search?: string },
) {
  const scope = await getScope(auth);
  const employeeWhere: Prisma.EmployeeWhereInput = { organizationId: auth.organizationId, ...scopeWhere(scope) };
  if (query.departmentId) employeeWhere.departmentId = query.departmentId;
  if (query.search) {
    employeeWhere.OR = [
      { fullName: { contains: query.search, mode: 'insensitive' } },
      { employeeCode: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    select: { id: true, fullName: true, employeeCode: true, department: { select: { name: true } } },
  });
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const assignments = await prisma.learningAssignment.findMany({
    where: {
      organizationId: auth.organizationId,
      employeeId: { in: employees.map((e) => e.id) },
      ...(query.materialId && { materialId: query.materialId }),
    },
    include: { material: { select: { id: true, title: true, type: true } } },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });

  const progress = await prisma.learningProgress.findMany({
    where: {
      organizationId: auth.organizationId,
      employeeId: { in: [...new Set(assignments.map((a) => a.employeeId))] },
      materialId: { in: [...new Set(assignments.map((a) => a.materialId))] },
    },
    select: { employeeId: true, materialId: true, progress: true, status: true, completedAt: true },
  });
  const progressByKey = new Map(progress.map((p) => [`${p.employeeId}:${p.materialId}`, p]));

  const now = new Date();
  const rows = assignments.map((a) => {
    const p = progressByKey.get(`${a.employeeId}:${a.materialId}`) ?? null;
    let state: AssignmentState;
    if (a.status === 'CANCELLED') state = 'CANCELLED';
    else if (p?.status === 'COMPLETED') state = 'COMPLETED';
    else if (a.dueDate && a.dueDate < now) state = 'OVERDUE';
    else if (p) state = 'IN_PROGRESS';
    else state = 'NOT_STARTED';

    const employee = employeeById.get(a.employeeId)!;
    return {
      id: a.id,
      employee: { id: employee.id, fullName: employee.fullName, employeeCode: employee.employeeCode, department: employee.department?.name ?? null },
      material: a.material,
      reason: a.reason,
      reasonText: a.reasonText,
      note: a.note,
      source: a.source,
      dueDate: a.dueDate,
      createdAt: a.createdAt,
      cancelledAt: a.cancelledAt,
      progress: p ? { progress: p.progress, completedAt: p.completedAt } : null,
      state,
    };
  });

  const counts: Record<AssignmentState, number> = { NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETED: 0, OVERDUE: 0, CANCELLED: 0 };
  for (const r of rows) counts[r.state] += 1;

  return { counts, rows: query.state ? rows.filter((r) => r.state === query.state) : rows };
}

async function getAssignmentInScope(auth: AuthContext, assignmentId: string) {
  const assignment = await prisma.learningAssignment.findFirst({
    where: { id: assignmentId, organizationId: auth.organizationId },
  });
  if (!assignment) throw AppError.notFound('Tayinlov topilmadi');
  const scope = await getScope(auth);
  if (!scope.all && !scope.employeeIds.has(assignment.employeeId)) throw AppError.forbidden();
  return assignment;
}

export async function cancelAssignment(auth: AuthContext, assignmentId: string) {
  const assignment = await getAssignmentInScope(auth, assignmentId);
  if (assignment.status === 'CANCELLED') throw AppError.badRequest('Tayinlov allaqachon bekor qilingan');
  return prisma.learningAssignment.update({
    where: { id: assignmentId },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledByUserId: auth.userId },
  });
}

export async function updateAssignmentDueDate(auth: AuthContext, assignmentId: string, dueDate: Date | null) {
  const assignment = await getAssignmentInScope(auth, assignmentId);
  if (assignment.status === 'CANCELLED') throw AppError.badRequest('Bekor qilingan tayinlovni o\'zgartirib bo\'lmaydi');
  return prisma.learningAssignment.update({
    where: { id: assignmentId },
    // Muddat o'zgarsa — eslatma yangi muddat bo'yicha qayta yuboriladi
    data: { dueDate, reminderSentAt: null },
  });
}

// ---------------------------------------------------------------------------
// Forma uchun ma'lumotnomalar
// ---------------------------------------------------------------------------

export async function getAudienceOptions(auth: AuthContext) {
  const scope = await getScope(auth);
  const employees = await prisma.employee.findMany({
    where: {
      organizationId: auth.organizationId,
      status: { in: [...ASSIGNABLE_EMPLOYMENT_STATUSES] },
      ...scopeWhere(scope),
    },
    select: { id: true, fullName: true, employeeCode: true, departmentId: true, positionId: true, branchId: true },
    orderBy: { fullName: 'asc' },
  });

  const departmentIds = new Set(employees.map((e) => e.departmentId).filter(Boolean) as string[]);
  const positionIds = new Set(employees.map((e) => e.positionId).filter(Boolean) as string[]);
  const branchIds = new Set(employees.map((e) => e.branchId).filter(Boolean) as string[]);

  const [departments, positions, branches] = await Promise.all([
    prisma.department.findMany({
      where: { organizationId: auth.organizationId, status: 'ACTIVE', ...(scope.all ? {} : { id: { in: [...departmentIds] } }) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.position.findMany({
      where: { organizationId: auth.organizationId, ...(scope.all ? {} : { id: { in: [...positionIds] } }) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.branch.findMany({
      where: { organizationId: auth.organizationId, status: 'ACTIVE', ...(scope.all ? {} : { id: { in: [...branchIds] } }) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const count = (key: 'departmentId' | 'positionId' | 'branchId', id: string) => employees.filter((e) => e[key] === id).length;

  return {
    canAssignWholeOrganization: scope.all,
    departments: departments.map((d) => ({ ...d, employeeCount: count('departmentId', d.id) })),
    positions: positions.map((p) => ({ ...p, employeeCount: count('positionId', p.id) })),
    branches: branches.map((b) => ({ ...b, employeeCount: count('branchId', b.id) })),
    employees: employees.map(({ id, fullName, employeeCode, departmentId }) => ({ id, fullName, employeeCode, departmentId })),
  };
}

export async function listAssignableMaterials(auth: AuthContext) {
  await getScope(auth);
  const materials = await prisma.learningMaterial.findMany({
    where: { organizationId: auth.organizationId, status: 'PUBLISHED' },
    select: { id: true, title: true, type: true, durationMinutes: true, coverUrl: true },
    orderBy: { title: 'asc' },
  });
  const active = await prisma.learningAssignment.groupBy({
    by: ['materialId'],
    where: { organizationId: auth.organizationId, status: 'ACTIVE' },
    _count: { _all: true },
  });
  const activeById = new Map(active.map((a) => [a.materialId, a._count._all]));
  return materials.map((m) => ({ ...m, activeAssignments: activeById.get(m.id) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Muddat eslatmasi
// ---------------------------------------------------------------------------

// Cron yo'q (Render bepul rejasi uxlaydi) — eslatma xodim o'qish sahifasini
// ochganda, o'zi uchun tekshiriladi: muddatga 3 kun yoki kamroq qolgan
// (yoki o'tib ketgan), hali tugatilmagan va eslatma yuborilmagan tayinlovlar.
export async function sendDueReminders(organizationId: string, employeeId: string, userId: string) {
  const soon = new Date(Date.now() + REMINDER_DAYS_BEFORE_DUE * 24 * 60 * 60 * 1000);
  const due = await prisma.learningAssignment.findMany({
    where: { organizationId, employeeId, status: 'ACTIVE', reminderSentAt: null, dueDate: { not: null, lte: soon } },
    include: { material: { select: { id: true, title: true } } },
  });
  if (due.length === 0) return;

  const completed = await prisma.learningProgress.findMany({
    where: { employeeId, materialId: { in: due.map((a) => a.materialId) }, status: 'COMPLETED' },
    select: { materialId: true },
  });
  const completedIds = new Set(completed.map((c) => c.materialId));
  const pending = due.filter((a) => !completedIds.has(a.materialId));
  if (pending.length === 0) return;

  const now = new Date();
  await prisma.$transaction([
    prisma.notification.createMany({
      data: pending.map((a) => ({
        organizationId,
        userId,
        type: 'LEARNING_REMINDER' as const,
        message:
          a.dueDate! < now
            ? `"${a.material.title}" materialini o'tish muddati o'tib ketdi (${formatDateUz(a.dueDate!)})`
            : `"${a.material.title}" materialini ${formatDateUz(a.dueDate!)} gacha tugatishingiz kerak`,
        entityType: 'LearningMaterial',
        entityId: a.material.id,
      })),
    }),
    prisma.learningAssignment.updateMany({
      where: { id: { in: pending.map((a) => a.id) } },
      data: { reminderSentAt: now },
    }),
  ]);
}
