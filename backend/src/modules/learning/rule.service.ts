import type { LearningAssignmentReason, LearningAssignmentRule, LearningRuleType, Prisma, RoleName } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { filterCandidates, isLearningAdmin, performAssign, resolveDueDate } from './assignment.service';

interface AuthContext {
  userId: string;
  organizationId: string;
  role: RoleName;
}

// L&D admin — qoidalar orqali avtomatik tayinlash (faqat HR).
//
// ONE_TIME  — yaratilganda bir marta ishlaydi, keyin yakunlanadi (isActive=false).
// PERMANENT — doimiy: shartga mos yangi xodimlarga tayinlaydi, shartdan
//             chiqqanlarning tugallanmagan tayinlovini bekor qiladi.
//
// Cron yo'q (Render bepul rejasi uxlaydi) — doimiy qoidalar voqealarda
// ishga tushadi: yaratilganda, xodim yaratilganda/ko'chirilganda (faqat
// o'sha xodim uchun), xodim o'qish sahifasini ochganda (o'zi uchun),
// qoidalar sahifasi ochilganda (24 soatdan oshgan bo'lsa) va qo'lda.

const ASSIGNABLE_EMPLOYMENT_STATUSES = ['ACTIVE', 'PROBATION', 'ON_LEAVE'] as const;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function assertHr(auth: AuthContext) {
  if (!isLearningAdmin(auth.role)) throw AppError.forbidden('Qoidalarni faqat HR boshqaradi');
}

export interface RuleInput {
  name: string;
  materialId: string;
  type: LearningRuleType;
  allOrganization?: boolean;
  departmentIds?: string[];
  positionIds?: string[];
  branchIds?: string[];
  hiredWithinDays?: number | null;
  reason: LearningAssignmentReason;
  reasonText?: string | null;
  note?: string | null;
  dueInDays?: number | null;
  dueDate?: Date | null;
  skipIfCompletedWithinDays?: number | null;
  cancelOutOfScope?: boolean;
}

type RuleCriteria = Pick<
  LearningAssignmentRule,
  'organizationId' | 'allOrganization' | 'departmentIds' | 'positionIds' | 'branchIds' | 'hiredWithinDays'
>;

// Qoida auditoriyasi. withHireFilter=false — "shartdan chiqdimi?" tekshiruvi
// uchun: faqat "yangi xodim" oynasidan chiqish tayinlovni bekor qilmasligi kerak.
function ruleEmployeeWhere(rule: RuleCriteria, withHireFilter: boolean, onlyEmployeeId?: string): Prisma.EmployeeWhereInput | null {
  const or: Prisma.EmployeeWhereInput[] = rule.allOrganization ? [{ organizationId: rule.organizationId }] : [];
  if (rule.departmentIds.length) or.push({ departmentId: { in: rule.departmentIds } });
  if (rule.positionIds.length) or.push({ positionId: { in: rule.positionIds } });
  if (rule.branchIds.length) or.push({ branchId: { in: rule.branchIds } });
  if (or.length === 0) return null;

  const and: Prisma.EmployeeWhereInput[] = [{ OR: or }];
  if (withHireFilter && rule.hiredWithinDays) {
    and.push({ hiredAt: { gte: new Date(Date.now() - rule.hiredWithinDays * 24 * 60 * 60 * 1000) } });
  }
  if (onlyEmployeeId) and.push({ id: onlyEmployeeId });

  return {
    organizationId: rule.organizationId,
    status: { in: [...ASSIGNABLE_EMPLOYMENT_STATUSES] },
    AND: and,
  };
}

async function resolveRuleAudience(rule: RuleCriteria, withHireFilter: boolean, onlyEmployeeId?: string) {
  const where = ruleEmployeeWhere(rule, withHireFilter, onlyEmployeeId);
  if (!where) return [];
  return prisma.employee.findMany({
    where,
    select: { id: true, fullName: true, employeeCode: true, userId: true, department: { select: { name: true } } },
    orderBy: { fullName: 'asc' },
  });
}

// ---------------------------------------------------------------------------
// Qoidani ishga tushirish
// ---------------------------------------------------------------------------

export async function runRule(ruleId: string, onlyEmployeeId?: string) {
  const rule = await prisma.learningAssignmentRule.findUnique({
    where: { id: ruleId },
    include: { material: { select: { id: true, title: true, status: true } } },
  });
  if (!rule || !rule.isActive || rule.material.status !== 'PUBLISHED') return { assigned: 0, cancelled: 0 };

  const audience = await resolveRuleAudience(rule, true, onlyEmployeeId);
  const split = await filterCandidates(rule.organizationId, rule.materialId, audience, rule.skipIfCompletedWithinDays);

  const assigned = await performAssign({
    organizationId: rule.organizationId,
    material: rule.material,
    employees: split.toAssign,
    progressById: split.progressById,
    assignedByUserId: rule.createdByUserId,
    dueDate: resolveDueDate({ dueDate: rule.type === 'ONE_TIME' ? rule.dueDate : null, dueInDays: rule.dueInDays }),
    note: rule.note,
    reason: rule.reason,
    reasonText: rule.reasonText,
    source: 'RULE',
    ruleId: rule.id,
  });

  let cancelled = 0;
  if (rule.type === 'PERMANENT' && rule.cancelOutOfScope) {
    cancelled = await cancelOutOfScopeAssignments(rule, onlyEmployeeId);
  }

  await prisma.learningAssignmentRule.update({
    where: { id: rule.id },
    data: { lastRunAt: new Date(), ...(rule.type === 'ONE_TIME' && !onlyEmployeeId ? { isActive: false } : {}) },
  });
  return { assigned, cancelled };
}

// Shartdan chiqqan xodimlarning shu qoida bergan, hali tugatilmagan
// tayinlovlarini bekor qiladi. Qo'lda yoki boshqa qoida bergan tayinlovlarga tegmaydi.
async function cancelOutOfScopeAssignments(rule: LearningAssignmentRule, onlyEmployeeId?: string) {
  const active = await prisma.learningAssignment.findMany({
    where: { ruleId: rule.id, status: 'ACTIVE', ...(onlyEmployeeId ? { employeeId: onlyEmployeeId } : {}) },
    select: { id: true, employeeId: true },
  });
  if (active.length === 0) return 0;

  const inScope = await resolveRuleAudience(rule, false, onlyEmployeeId);
  const inScopeIds = new Set(inScope.map((e) => e.id));
  const outOfScope = active.filter((a) => !inScopeIds.has(a.employeeId));
  if (outOfScope.length === 0) return 0;

  const completed = await prisma.learningProgress.findMany({
    where: { materialId: rule.materialId, employeeId: { in: outOfScope.map((a) => a.employeeId) }, status: 'COMPLETED' },
    select: { employeeId: true },
  });
  const completedIds = new Set(completed.map((c) => c.employeeId));
  const toCancel = outOfScope.filter((a) => !completedIds.has(a.employeeId));
  if (toCancel.length === 0) return 0;

  const result = await prisma.learningAssignment.updateMany({
    where: { id: { in: toCancel.map((a) => a.id) } },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });
  return result.count;
}

// Xodim yaratilganda/ko'chirilganda yoki o'qish sahifasini ochganda —
// barcha faol doimiy qoidalarni faqat shu xodim uchun ishga tushiradi.
export async function syncRulesForEmployee(organizationId: string, employeeId: string) {
  const rules = await prisma.learningAssignmentRule.findMany({
    where: { organizationId, isActive: true, type: 'PERMANENT' },
    select: { id: true },
  });
  for (const rule of rules) {
    await runRule(rule.id, employeeId);
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

async function validateRuleInput(auth: AuthContext, input: RuleInput) {
  const material = await prisma.learningMaterial.findFirst({
    where: { id: input.materialId, organizationId: auth.organizationId, status: 'PUBLISHED' },
    select: { id: true },
  });
  if (!material) throw AppError.notFound('Material topilmadi');
  if (input.reason === 'OTHER' && !input.reasonText?.trim()) {
    throw AppError.badRequest('"Boshqa" sabab uchun izoh yozing');
  }
  const hasAudience =
    input.allOrganization || input.departmentIds?.length || input.positionIds?.length || input.branchIds?.length;
  if (!hasAudience) throw AppError.badRequest('Auditoriyani tanlang: butun tashkilot, bo‘lim, lavozim yoki filial');
  if (input.type === 'PERMANENT' && input.dueDate) {
    throw AppError.badRequest("Doimiy qoidada aniq sana bo'lmaydi — 'N kun ichida' muddatidan foydalaning");
  }
}

function ruleData(input: RuleInput) {
  return {
    name: input.name.trim(),
    materialId: input.materialId,
    type: input.type,
    allOrganization: Boolean(input.allOrganization),
    departmentIds: input.allOrganization ? [] : input.departmentIds ?? [],
    positionIds: input.allOrganization ? [] : input.positionIds ?? [],
    branchIds: input.allOrganization ? [] : input.branchIds ?? [],
    hiredWithinDays: input.hiredWithinDays ?? null,
    reason: input.reason,
    reasonText: input.reason === 'OTHER' ? input.reasonText?.trim() ?? null : null,
    note: input.note?.trim() || null,
    dueInDays: input.dueDate ? null : input.dueInDays ?? null,
    dueDate: input.type === 'ONE_TIME' ? input.dueDate ?? null : null,
    skipIfCompletedWithinDays: input.skipIfCompletedWithinDays ?? null,
    cancelOutOfScope: input.type === 'PERMANENT' ? input.cancelOutOfScope ?? true : false,
  };
}

// Qoida saqlanmasdan — hozir nechta xodimga tushishini hisoblaydi
export async function previewRule(auth: AuthContext, input: RuleInput) {
  assertHr(auth);
  await validateRuleInput(auth, input);
  const criteria = { organizationId: auth.organizationId, ...ruleData(input) };
  const audience = await resolveRuleAudience(criteria, true);
  const split = await filterCandidates(auth.organizationId, input.materialId, audience, input.skipIfCompletedWithinDays);
  const summarize = (list: typeof audience) =>
    list.slice(0, 200).map((e) => ({ id: e.id, fullName: e.fullName, employeeCode: e.employeeCode, department: e.department?.name ?? null }));
  return {
    total: audience.length,
    toAssignCount: split.toAssign.length,
    skippedActiveCount: split.skippedActive.length,
    skippedCompletedCount: split.skippedCompleted.length,
    toAssign: summarize(split.toAssign),
    skippedActive: summarize(split.skippedActive),
    skippedCompleted: summarize(split.skippedCompleted),
  };
}

export async function createRule(auth: AuthContext, input: RuleInput) {
  assertHr(auth);
  await validateRuleInput(auth, input);
  const rule = await prisma.learningAssignmentRule.create({
    data: { organizationId: auth.organizationId, createdByUserId: auth.userId, ...ruleData(input) },
  });
  const result = await runRule(rule.id);
  return { rule, ...result };
}

async function getRule(auth: AuthContext, ruleId: string) {
  assertHr(auth);
  const rule = await prisma.learningAssignmentRule.findFirst({ where: { id: ruleId, organizationId: auth.organizationId } });
  if (!rule) throw AppError.notFound('Qoida topilmadi');
  return rule;
}

export async function runRuleNow(auth: AuthContext, ruleId: string) {
  const rule = await getRule(auth, ruleId);
  if (!rule.isActive) throw AppError.badRequest("Qoida o'chirilgan — avval yoqing");
  return runRule(rule.id);
}

// Qoidani to'xtatish. cancelAssignments=true bo'lsa — shu qoida bergan
// tugallanmagan tayinlovlar ham bekor qilinadi.
export async function deactivateRule(auth: AuthContext, ruleId: string, cancelAssignments: boolean) {
  const rule = await getRule(auth, ruleId);
  let cancelled = 0;
  if (cancelAssignments) {
    const active = await prisma.learningAssignment.findMany({
      where: { ruleId: rule.id, status: 'ACTIVE' },
      select: { id: true, employeeId: true },
    });
    const completed = await prisma.learningProgress.findMany({
      where: { materialId: rule.materialId, employeeId: { in: active.map((a) => a.employeeId) }, status: 'COMPLETED' },
      select: { employeeId: true },
    });
    const completedIds = new Set(completed.map((c) => c.employeeId));
    const result = await prisma.learningAssignment.updateMany({
      where: { id: { in: active.filter((a) => !completedIds.has(a.employeeId)).map((a) => a.id) } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledByUserId: auth.userId },
    });
    cancelled = result.count;
  }
  await prisma.learningAssignmentRule.update({ where: { id: rule.id }, data: { isActive: false } });
  return { cancelled };
}

export async function activateRule(auth: AuthContext, ruleId: string) {
  const rule = await getRule(auth, ruleId);
  if (rule.type === 'ONE_TIME') throw AppError.badRequest('Bir martalik qoidani qayta yoqib bo‘lmaydi — yangisini yarating');
  await prisma.learningAssignmentRule.update({ where: { id: rule.id }, data: { isActive: true } });
  return runRule(rule.id);
}

export async function listRules(auth: AuthContext) {
  assertHr(auth);

  // "Kunlik" ishga tushirish o'rniga: sahifa ochilganda eskirgan doimiy
  // qoidalar yangilanadi (24 soatdan oshgan bo'lsa).
  const stale = await prisma.learningAssignmentRule.findMany({
    where: {
      organizationId: auth.organizationId,
      isActive: true,
      type: 'PERMANENT',
      OR: [{ lastRunAt: null }, { lastRunAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } }],
    },
    select: { id: true },
  });
  for (const rule of stale) await runRule(rule.id);

  const rules = await prisma.learningAssignmentRule.findMany({
    where: { organizationId: auth.organizationId },
    include: { material: { select: { id: true, title: true, type: true } } },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });

  const counts = await prisma.learningAssignment.groupBy({
    by: ['ruleId', 'status'],
    where: { organizationId: auth.organizationId, ruleId: { in: rules.map((r) => r.id) } },
    _count: { _all: true },
  });
  const countFor = (ruleId: string, status: 'ACTIVE' | 'CANCELLED') =>
    counts.find((c) => c.ruleId === ruleId && c.status === status)?._count._all ?? 0;

  const [departments, positions, branches] = await Promise.all([
    prisma.department.findMany({ where: { organizationId: auth.organizationId }, select: { id: true, name: true } }),
    prisma.position.findMany({ where: { organizationId: auth.organizationId }, select: { id: true, name: true } }),
    prisma.branch.findMany({ where: { organizationId: auth.organizationId }, select: { id: true, name: true } }),
  ]);
  const nameOf = (list: { id: string; name: string }[], ids: string[]) =>
    ids.map((id) => list.find((x) => x.id === id)?.name).filter(Boolean) as string[];

  return rules.map((r) => ({
    ...r,
    audience: {
      allOrganization: r.allOrganization,
      departments: nameOf(departments, r.departmentIds),
      positions: nameOf(positions, r.positionIds),
      branches: nameOf(branches, r.branchIds),
      hiredWithinDays: r.hiredWithinDays,
    },
    activeAssignments: countFor(r.id, 'ACTIVE'),
    cancelledAssignments: countFor(r.id, 'CANCELLED'),
  }));
}
