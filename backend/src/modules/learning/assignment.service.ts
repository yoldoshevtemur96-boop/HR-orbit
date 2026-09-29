import type { LearningAssignmentReason, LearningAssignmentSource, Prisma, RoleName } from '@prisma/client';
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

export interface Scope {
  all: boolean;
  employeeIds: Set<string>;
}

export async function getScope(auth: AuthContext): Promise<Scope> {
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

export function scopeWhere(scope: Scope): Prisma.EmployeeWhereInput {
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
  name?: string; // tayinlov nomi (bo'sh bo'lsa — "Material — sana")
  batchId?: string; // mavjud tayinlovga xodim qo'shish
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
// Qo'lda tayinlash ham, qoidalar ham shundan foydalanadi.
export async function filterCandidates<T extends { id: string }>(
  organizationId: string,
  materialId: string,
  audience: T[],
  skipIfCompletedWithinDays?: number | null,
) {
  const ids = audience.map((e) => e.id);
  const [active, progress] = await Promise.all([
    prisma.learningAssignment.findMany({
      where: { organizationId, materialId, status: 'ACTIVE', employeeId: { in: ids } },
      select: { employeeId: true },
    }),
    prisma.learningProgress.findMany({
      where: { organizationId, materialId, employeeId: { in: ids } },
      select: { employeeId: true, status: true, completedAt: true },
    }),
  ]);
  const activeIds = new Set(active.map((a) => a.employeeId));
  const progressById = new Map(progress.map((p) => [p.employeeId, p]));

  const threshold = skipIfCompletedWithinDays
    ? new Date(Date.now() - skipIfCompletedWithinDays * 24 * 60 * 60 * 1000)
    : null;

  const toAssign: T[] = [];
  const skippedActive: T[] = [];
  const skippedCompleted: T[] = [];
  for (const employee of audience) {
    const p = progressById.get(employee.id);
    if (activeIds.has(employee.id)) skippedActive.push(employee);
    else if (threshold && p?.status === 'COMPLETED' && p.completedAt && p.completedAt >= threshold) skippedCompleted.push(employee);
    else toAssign.push(employee);
  }
  return { toAssign, skippedActive, skippedCompleted, progressById };
}

async function planAssignment(auth: AuthContext, input: AssignInput) {
  const scope = await getScope(auth);
  const material = await getPublishedMaterial(auth.organizationId, input.materialId);
  const audience = await resolveAudience(auth, scope, input.audience);
  const split = await filterCandidates(auth.organizationId, material.id, audience, input.skipIfCompletedWithinDays);
  return { material, ...split };
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

export function resolveDueDate(input: { dueDate?: Date | null; dueInDays?: number | null }): Date | null {
  if (input.dueDate) return input.dueDate;
  if (input.dueInDays) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + input.dueInDays);
    d.setUTCHours(18, 59, 59, 0); // Toshkent vaqti bilan kun oxiri (23:59, UTC+5)
    return d;
  }
  return null;
}

export function formatDateUz(date: Date) {
  return date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Tashkent' });
}

export interface PerformAssignInput {
  organizationId: string;
  material: { id: string; title: string };
  employees: { id: string; userId: string | null }[];
  progressById: Map<string, { status: string }>;
  assignedByUserId: string | null;
  dueDate: Date | null;
  note?: string | null;
  reason: LearningAssignmentReason;
  reasonText?: string | null;
  source: LearningAssignmentSource;
  ruleId?: string | null;
  batchId?: string | null;
  notify?: boolean; // tayinlanganda bildirishnoma (standart — ha)
  remindBeforeDays?: number | null; // standart — 3
  remindAfterDays?: number | null;
  resetProgress?: boolean; // boshlaganlarning progressi ham noldan
}

// Tayinlovlarni yaratadi, avval tugatganlarning progressini nollaydi va
// bildirishnoma yuboradi. Qaytaradi — haqiqatda yaratilgan tayinlovlar soni.
export async function performAssign(input: PerformAssignInput) {
  if (input.employees.length === 0) return 0;
  const employeeIds = input.employees.map((e) => e.id);
  // Avval tugatgan xodim qayta tayinlansa — yangi urinish: progress noldan.
  // resetProgress — boshlab qo'yganlarniki ham noldan.
  const completedBefore = employeeIds.filter((id) => {
    const status = input.progressById.get(id)?.status;
    return status === 'COMPLETED' || (input.resetProgress && status === 'IN_PROGRESS');
  });

  const message =
    `Sizga yangi o'quv material tayinlandi: "${input.material.title}"` +
    (input.dueDate ? ` — muddat: ${formatDateUz(input.dueDate)}` : '');

  return prisma.$transaction(async (tx) => {
    const result = await tx.learningAssignment.createMany({
      data: employeeIds.map((employeeId) => ({
        organizationId: input.organizationId,
        employeeId,
        materialId: input.material.id,
        assignedByUserId: input.assignedByUserId,
        dueDate: input.dueDate,
        note: input.note?.trim() || null,
        reason: input.reason,
        reasonText: input.reason === 'OTHER' ? input.reasonText?.trim() || null : null,
        source: input.source,
        ruleId: input.ruleId ?? null,
        batchId: input.batchId ?? null,
        remindBeforeDays: input.remindBeforeDays === undefined ? 3 : input.remindBeforeDays,
        remindAfterDays: input.remindAfterDays ?? null,
      })),
      skipDuplicates: true, // parallel so'rovda faol tayinlov unique indeksi bilan to'qnashsa
    });

    if (completedBefore.length > 0) {
      await tx.learningProgress.updateMany({
        where: { materialId: input.material.id, employeeId: { in: completedBefore } },
        data: { progress: 0, status: 'IN_PROGRESS', completedAt: null },
      });
    }

    await tx.notification.createMany({
      data: input.employees
        .filter((e) => e.userId && input.notify !== false)
        .map((e) => ({
          organizationId: input.organizationId,
          userId: e.userId!,
          type: 'LEARNING_ASSIGNED' as const,
          message,
          entityType: 'LearningMaterial',
          entityId: input.material.id,
        })),
    });
    return result.count;
  });
}

// Auditoriyaning qisqa tavsifi — tayinlovlar ro'yxatida "Kimga" ustuni uchun
async function describeAudience(organizationId: string, audience: AudienceInput) {
  if (audience.allOrganization) return 'Butun tashkilot';
  const [departments, positions, branches] = await Promise.all([
    audience.departmentIds?.length
      ? prisma.department.findMany({ where: { organizationId, id: { in: audience.departmentIds } }, select: { name: true } })
      : [],
    audience.positionIds?.length
      ? prisma.position.findMany({ where: { organizationId, id: { in: audience.positionIds } }, select: { name: true } })
      : [],
    audience.branchIds?.length
      ? prisma.branch.findMany({ where: { organizationId, id: { in: audience.branchIds } }, select: { name: true } })
      : [],
  ]);
  const parts = [...departments, ...positions, ...branches].map((x) => x.name);
  if (audience.employeeIds?.length) parts.push(`${audience.employeeIds.length} ta xodim`);
  return parts.join(', ') || null;
}

// Rahbar: tayinlovni ko'rishi uchun unda o'z xodimi bo'lishi kifoya;
// o'zgartirish (nom, muddat, bekor qilish, xodim qo'shish) — faqat o'zi
// yaratgan tayinlovda. HR — hammasi.
async function getBatchInScope(auth: AuthContext, batchId: string, forWrite = false) {
  const batch = await prisma.learningAssignmentBatch.findFirst({
    where: { id: batchId, organizationId: auth.organizationId },
    include: { material: { select: { id: true, title: true, type: true, status: true } }, rule: { select: { id: true, name: true, status: true } } },
  });
  if (!batch) throw AppError.notFound('Tayinlov topilmadi');
  if (isLearningAdmin(auth.role)) return batch;
  if (forWrite) {
    if (batch.createdByUserId !== auth.userId) throw AppError.forbidden("Bu tayinlovni faqat uni yaratgan yoki HR o'zgartira oladi");
    return batch;
  }
  const scope = await getScope(auth);
  const visible = await prisma.learningAssignment.count({ where: { batchId: batch.id, employeeId: { in: [...scope.employeeIds] } } });
  if (visible === 0) throw AppError.forbidden();
  return batch;
}

export async function createAssignments(auth: AuthContext, input: AssignInput) {
  // Mavjud tayinlovga xodim qo'shish — material va parametrlar tayinlovdan olinadi
  const batch = input.batchId ? await getBatchInScope(auth, input.batchId, true) : null;
  if (batch?.source === 'RULE') throw AppError.badRequest("Qoida tayinloviga qo'lda xodim qo'shib bo'lmaydi");
  const effective: AssignInput = batch
    ? {
        ...input,
        materialId: batch.materialId,
        reason: batch.reason,
        reasonText: batch.reasonText ?? undefined,
        note: batch.note ?? undefined,
        dueDate: batch.dueDate ?? undefined,
        dueInDays: batch.dueDate ? undefined : batch.dueInDays ?? undefined,
      }
    : input;

  if (effective.reason === 'OTHER' && !effective.reasonText?.trim()) {
    throw AppError.badRequest('"Boshqa" sabab uchun izoh yozing');
  }
  const plan = await planAssignment(auth, effective);
  if (plan.toAssign.length === 0) {
    throw AppError.badRequest("Tayinlanadigan xodim yo'q — hammasida faol tayinlov bor yoki yaqinda tugatgan");
  }

  const dueDate = resolveDueDate(effective);
  const batchId =
    batch?.id ??
    (
      await prisma.learningAssignmentBatch.create({
        data: {
          organizationId: auth.organizationId,
          name: input.name?.trim() || `${plan.material.title} — ${formatDateUz(new Date())}`,
          materialId: plan.material.id,
          source: 'MANUAL',
          reason: effective.reason,
          reasonText: effective.reason === 'OTHER' ? effective.reasonText?.trim() || null : null,
          note: effective.note?.trim() || null,
          dueDate: effective.dueDate ?? null,
          dueInDays: effective.dueDate ? null : effective.dueInDays ?? null,
          audienceSummary: await describeAudience(auth.organizationId, effective.audience),
          createdByUserId: auth.userId,
        },
      })
    ).id;

  if (batch) {
    const added = await describeAudience(auth.organizationId, effective.audience);
    if (added && !(batch.audienceSummary ?? '').includes(added)) {
      await prisma.learningAssignmentBatch.update({
        where: { id: batch.id },
        data: { audienceSummary: batch.audienceSummary ? `${batch.audienceSummary}, ${added}` : added },
      });
    }
  }

  const created = await performAssign({
    organizationId: auth.organizationId,
    material: plan.material,
    employees: plan.toAssign,
    progressById: plan.progressById,
    assignedByUserId: auth.userId,
    dueDate,
    note: effective.note,
    reason: effective.reason,
    reasonText: effective.reasonText,
    source: 'MANUAL',
    batchId,
  });

  return {
    batchId,
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
  query: { materialId?: string; batchId?: string; departmentId?: string; state?: AssignmentState; search?: string },
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
      ...(query.batchId && { batchId: query.batchId }),
    },
    include: {
      material: { select: { id: true, title: true, type: true } },
      rule: { select: { id: true, name: true } },
      batch: { select: { id: true, name: true } },
    },
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
      rule: a.rule,
      batch: a.batch,
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
    data: { dueDate, reminderSentAt: null, reminderAfterSentAt: null },
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

// Cron yo'q (Render bepul rejasi uxlaydi) — eslatmalar xodim o'qish sahifasini
// ochganda, o'zi uchun tekshiriladi. Har bir tayinlov o'z sozlamasi bilan:
// - "oldin": muddatga remindBeforeDays yoki kamroq kun qolganda (bir marta);
// - "keyin": muddatdan remindAfterDays kun o'tganda (bir marta).
// Tugatilgan materiallar uchun eslatma yuborilmaydi.
export async function sendDueReminders(organizationId: string, employeeId: string, userId: string) {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const candidates = await prisma.learningAssignment.findMany({
    where: {
      organizationId,
      employeeId,
      status: 'ACTIVE',
      dueDate: { not: null },
      OR: [
        { reminderSentAt: null, remindBeforeDays: { not: null } },
        { reminderAfterSentAt: null, remindAfterDays: { not: null } },
      ],
    },
    include: { material: { select: { id: true, title: true } } },
  });
  if (candidates.length === 0) return;

  const completed = await prisma.learningProgress.findMany({
    where: { employeeId, materialId: { in: candidates.map((a) => a.materialId) }, status: 'COMPLETED' },
    select: { materialId: true },
  });
  const completedIds = new Set(completed.map((c) => c.materialId));

  const before = candidates.filter(
    (a) =>
      !completedIds.has(a.materialId) &&
      a.reminderSentAt === null &&
      a.remindBeforeDays !== null &&
      a.dueDate! > now &&
      a.dueDate!.getTime() - a.remindBeforeDays * day <= now.getTime(),
  );
  const after = candidates.filter(
    (a) =>
      !completedIds.has(a.materialId) &&
      a.reminderAfterSentAt === null &&
      a.remindAfterDays !== null &&
      a.dueDate!.getTime() + a.remindAfterDays * day <= now.getTime(),
  );
  if (before.length === 0 && after.length === 0) return;

  await prisma.$transaction([
    prisma.notification.createMany({
      data: [
        ...before.map((a) => ({
          organizationId,
          userId,
          type: 'LEARNING_REMINDER' as const,
          message: `"${a.material.title}" materialini ${formatDateUz(a.dueDate!)} gacha tugatishingiz kerak`,
          entityType: 'LearningMaterial',
          entityId: a.material.id,
        })),
        ...after.map((a) => ({
          organizationId,
          userId,
          type: 'LEARNING_REMINDER' as const,
          message: `"${a.material.title}" materialini o'tish muddati o'tib ketdi (${formatDateUz(a.dueDate!)}) — iltimos, tugating`,
          entityType: 'LearningMaterial',
          entityId: a.material.id,
        })),
      ],
    }),
    prisma.learningAssignment.updateMany({ where: { id: { in: before.map((a) => a.id) } }, data: { reminderSentAt: now } }),
    prisma.learningAssignment.updateMany({ where: { id: { in: after.map((a) => a.id) } }, data: { reminderAfterSentAt: now } }),
  ]);
}

// ---------------------------------------------------------------------------
// Tayinlovlar (partiyalar): ro'yxat va boshqaruv
// ---------------------------------------------------------------------------

export type BatchState = 'IN_PROGRESS' | 'COMPLETED' | 'HAS_OVERDUE' | 'CANCELLED';

// Har bir tayinlov bo'yicha: xodimlar soni, tugatgan, muddati o'tgan,
// bekor qilingan, bajarilish foizi. Rahbar faqat o'z xodimlari bo'yicha ko'radi.
export async function listBatches(
  auth: AuthContext,
  query: { materialId?: string; source?: LearningAssignmentSource; state?: BatchState; search?: string },
) {
  const scope = await getScope(auth);
  const employees = await prisma.employee.findMany({
    where: { organizationId: auth.organizationId, ...scopeWhere(scope) },
    select: { id: true },
  });
  const employeeIds = employees.map((e) => e.id);

  const assignments = await prisma.learningAssignment.findMany({
    where: {
      organizationId: auth.organizationId,
      employeeId: { in: employeeIds },
      batchId: { not: null },
      ...(query.materialId && { materialId: query.materialId }),
      ...(query.source && { source: query.source }),
    },
    select: { batchId: true, employeeId: true, materialId: true, status: true, dueDate: true },
  });
  const batchIds = [...new Set(assignments.map((a) => a.batchId!))];
  const search = query.search?.trim();
  const batches = await prisma.learningAssignmentBatch.findMany({
    where: {
      id: { in: batchIds },
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { material: { title: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    },
    include: { material: { select: { id: true, title: true, type: true } }, rule: { select: { id: true, name: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const completedRows = await prisma.learningProgress.findMany({
    where: {
      organizationId: auth.organizationId,
      status: 'COMPLETED',
      employeeId: { in: [...new Set(assignments.map((a) => a.employeeId))] },
      materialId: { in: [...new Set(assignments.map((a) => a.materialId))] },
    },
    select: { employeeId: true, materialId: true },
  });
  const completedKeys = new Set(completedRows.map((c) => `${c.employeeId}:${c.materialId}`));
  const creators = await prisma.user.findMany({
    where: { id: { in: batches.map((b) => b.createdByUserId).filter(Boolean) as string[] } },
    select: { id: true, email: true, employee: { select: { fullName: true } } },
  });
  const creatorName = new Map(creators.map((u) => [u.id, u.employee?.fullName ?? u.email]));

  const now = new Date();
  const rows = batches.map((b) => {
    const own = assignments.filter((a) => a.batchId === b.id);
    const live = own.filter((a) => a.status === 'ACTIVE');
    const completed = live.filter((a) => completedKeys.has(`${a.employeeId}:${a.materialId}`)).length;
    const overdue = live.filter((a) => !completedKeys.has(`${a.employeeId}:${a.materialId}`) && a.dueDate && a.dueDate < now).length;
    const cancelled = own.length - live.length;
    const state: BatchState =
      live.length === 0 ? 'CANCELLED' : completed === live.length ? 'COMPLETED' : overdue > 0 ? 'HAS_OVERDUE' : 'IN_PROGRESS';
    return {
      id: b.id,
      name: b.name,
      source: b.source,
      material: b.material,
      rule: b.rule,
      reason: b.reason,
      reasonText: b.reasonText,
      dueDate: b.dueDate,
      dueInDays: b.dueInDays,
      audienceSummary: b.audienceSummary,
      createdAt: b.createdAt,
      createdBy: b.createdByUserId ? creatorName.get(b.createdByUserId) ?? null : null,
      total: live.length,
      completed,
      overdue,
      cancelled,
      completionPercent: live.length ? Math.round((completed / live.length) * 100) : 0,
      state,
    };
  });

  const counts: Record<BatchState, number> = { IN_PROGRESS: 0, COMPLETED: 0, HAS_OVERDUE: 0, CANCELLED: 0 };
  for (const r of rows) counts[r.state] += 1;
  return { counts, rows: query.state ? rows.filter((r) => r.state === query.state) : rows };
}

export async function getBatch(auth: AuthContext, batchId: string) {
  const batch = await getBatchInScope(auth, batchId);
  const creator = batch.createdByUserId
    ? await prisma.user.findUnique({ where: { id: batch.createdByUserId }, select: { email: true, employee: { select: { fullName: true } } } })
    : null;
  return {
    ...batch,
    createdBy: creator ? creator.employee?.fullName ?? creator.email : null,
    canEdit: isLearningAdmin(auth.role) || batch.createdByUserId === auth.userId,
  };
}

async function batchActiveUnfinished(auth: AuthContext, batchId: string) {
  const scope = await getScope(auth);
  const active = await prisma.learningAssignment.findMany({
    where: {
      organizationId: auth.organizationId,
      batchId,
      status: 'ACTIVE',
      ...(scope.all ? {} : { employeeId: { in: [...scope.employeeIds] } }),
    },
    select: { id: true, employeeId: true, materialId: true },
  });
  const completed = await prisma.learningProgress.findMany({
    where: { employeeId: { in: active.map((a) => a.employeeId) }, materialId: { in: [...new Set(active.map((a) => a.materialId))] }, status: 'COMPLETED' },
    select: { employeeId: true, materialId: true },
  });
  const done = new Set(completed.map((c) => `${c.employeeId}:${c.materialId}`));
  return active.filter((a) => !done.has(`${a.employeeId}:${a.materialId}`));
}

// Butun tayinlovning muddatini o'zgartirish (tugatilmaganlar uchun)
export async function updateBatchDueDate(auth: AuthContext, batchId: string, dueDate: Date | null) {
  const batch = await getBatchInScope(auth, batchId, true);
  const targets = await batchActiveUnfinished(auth, batch.id);
  await prisma.$transaction([
    prisma.learningAssignmentBatch.update({ where: { id: batch.id }, data: { dueDate, dueInDays: null } }),
    prisma.learningAssignment.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { dueDate, reminderSentAt: null, reminderAfterSentAt: null },
    }),
  ]);
  return { updated: targets.length };
}

// Butun tayinlovni bekor qilish (tugatganlarniki qoladi)
export async function cancelBatch(auth: AuthContext, batchId: string) {
  const batch = await getBatchInScope(auth, batchId, true);
  if (batch.source === 'RULE') throw AppError.badRequest("Qoida tayinlovini qoidalar bo'limida to'xtating");
  const targets = await batchActiveUnfinished(auth, batch.id);
  const result = await prisma.learningAssignment.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledByUserId: auth.userId },
  });
  return { cancelled: result.count };
}

export async function renameBatch(auth: AuthContext, batchId: string, name: string) {
  const batch = await getBatchInScope(auth, batchId, true);
  return prisma.learningAssignmentBatch.update({ where: { id: batch.id }, data: { name: name.trim() } });
}
