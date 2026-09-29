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
// ONE_TIME  — yaratilganda bir marta ishlaydi, keyin "Bajarildi" holatiga o'tadi.
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
  description?: string | null;
  tag?: string | null;
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
  if (!rule || rule.status !== 'ACTIVE' || rule.material.status !== 'PUBLISHED') return { assigned: 0, cancelled: 0 };

  const audience = await resolveRuleAudience(rule, true, onlyEmployeeId);
  const split = await filterCandidates(rule.organizationId, rule.materialId, audience, rule.skipIfCompletedWithinDays);

  // Qoidaning tayinlovi ("Tayinlovlar" ro'yxatida bitta qator) — bitta, nomi qoida nomi
  const batch =
    split.toAssign.length > 0
      ? await prisma.learningAssignmentBatch.upsert({
          where: { ruleId: rule.id },
          create: {
            organizationId: rule.organizationId,
            name: rule.name,
            materialId: rule.materialId,
            source: 'RULE',
            ruleId: rule.id,
            reason: rule.reason,
            reasonText: rule.reasonText,
            note: rule.note,
            dueDate: rule.dueDate,
            dueInDays: rule.dueInDays,
            createdByUserId: rule.createdByUserId,
          },
          update: {},
        })
      : null;

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
    batchId: batch?.id ?? null,
  });

  let cancelled = 0;
  if (rule.type === 'PERMANENT' && rule.cancelOutOfScope) {
    cancelled = await cancelOutOfScopeAssignments(rule, onlyEmployeeId);
  }

  await prisma.learningAssignmentRule.update({
    where: { id: rule.id },
    // Bir martalik qoida to'liq ishlagach — Bajarildi
    data: { lastRunAt: new Date(), ...(rule.type === 'ONE_TIME' && !onlyEmployeeId ? { status: 'COMPLETED' as const } : {}) },
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
    where: { organizationId, status: 'ACTIVE', type: 'PERMANENT' },
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
    description: input.description?.trim() || null,
    tag: input.tag?.trim().toLowerCase().replace(/^#/, '') || null,
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

// Yangi qoida: activate=false — qoralama; true — darhol faollashtiriladi va ishlaydi
export async function createRule(auth: AuthContext, input: RuleInput, activate = true) {
  assertHr(auth);
  await validateRuleInput(auth, input);
  const rule = await prisma.learningAssignmentRule.create({
    data: {
      organizationId: auth.organizationId,
      createdByUserId: auth.userId,
      ...ruleData(input),
      status: activate ? 'ACTIVE' : 'DRAFT',
    },
  });
  if (!activate) return { rule, assigned: 0, cancelled: 0 };
  const result = await runRule(rule.id);
  // Bir martalik qoida ishlagach "Bajarildi"ga o'tadi — yangilangan holatni qaytaramiz
  const fresh = await prisma.learningAssignmentRule.findUniqueOrThrow({ where: { id: rule.id } });
  return { rule: fresh, ...result };
}

async function getRule(auth: AuthContext, ruleId: string) {
  assertHr(auth);
  const rule = await prisma.learningAssignmentRule.findFirst({ where: { id: ruleId, organizationId: auth.organizationId } });
  if (!rule) throw AppError.notFound('Qoida topilmadi');
  return rule;
}

// Tahrirlash formasi uchun
export async function getRuleDetail(auth: AuthContext, ruleId: string) {
  return getRule(auth, ruleId);
}

// Faqat qoralama yoki to'xtatilgan qoida tahrirlanadi (Pulsdagi kabi:
// faol qoidani avval to'xtatish kerak)
export async function updateRule(auth: AuthContext, ruleId: string, input: RuleInput) {
  const rule = await getRule(auth, ruleId);
  if (rule.status !== 'DRAFT' && rule.status !== 'STOPPED') {
    throw AppError.badRequest("Faqat qoralama yoki to'xtatilgan qoidani tahrirlash mumkin — avval to'xtating");
  }
  await validateRuleInput(auth, input);
  const data = ruleData(input);
  // Qoida tayinlovi nomi va parametrlari qoida bilan birga yangilanadi
  await prisma.learningAssignmentBatch.updateMany({
    where: { ruleId: rule.id },
    data: { name: data.name, reason: data.reason, reasonText: data.reasonText, note: data.note, dueDate: data.dueDate, dueInDays: data.dueInDays },
  });
  return prisma.learningAssignmentRule.update({ where: { id: rule.id }, data });
}

export async function runRuleNow(auth: AuthContext, ruleId: string) {
  const rule = await getRule(auth, ruleId);
  if (rule.status !== 'ACTIVE') throw AppError.badRequest('Qoida faol emas — avval faollashtiring');
  return runRule(rule.id);
}

async function cancelRuleAssignments(ruleId: string, materialId: string, userId: string) {
  const active = await prisma.learningAssignment.findMany({
    where: { ruleId, status: 'ACTIVE' },
    select: { id: true, employeeId: true },
  });
  if (active.length === 0) return 0;
  const completed = await prisma.learningProgress.findMany({
    where: { materialId, employeeId: { in: active.map((a) => a.employeeId) }, status: 'COMPLETED' },
    select: { employeeId: true },
  });
  const completedIds = new Set(completed.map((c) => c.employeeId));
  const result = await prisma.learningAssignment.updateMany({
    where: { id: { in: active.filter((a) => !completedIds.has(a.employeeId)).map((a) => a.id) } },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledByUserId: userId },
  });
  return result.count;
}

// Faollashtirish: qoralama yoki to'xtatilgan -> Faol, darhol ishga tushadi.
// Bir martalik qoida ishlagach o'zi "Bajarildi"ga o'tadi.
export async function activateRule(auth: AuthContext, ruleId: string) {
  const rule = await getRule(auth, ruleId);
  if (rule.status !== 'DRAFT' && rule.status !== 'STOPPED') {
    throw AppError.badRequest('Bu holatdagi qoidani faollashtirib bo‘lmaydi');
  }
  await validateRuleInput(auth, { ...rule, description: rule.description, tag: rule.tag });
  await prisma.learningAssignmentRule.update({ where: { id: rule.id }, data: { status: 'ACTIVE' } });
  return runRule(rule.id);
}

// To'xtatish. cancelAssignments=true — shu qoida bergan tugallanmagan
// tayinlovlar ham bekor qilinadi.
export async function stopRule(auth: AuthContext, ruleId: string, cancelAssignments: boolean) {
  const rule = await getRule(auth, ruleId);
  if (rule.status !== 'ACTIVE') throw AppError.badRequest('Faqat faol qoidani to‘xtatish mumkin');
  const cancelled = cancelAssignments ? await cancelRuleAssignments(rule.id, rule.materialId, auth.userId) : 0;
  await prisma.learningAssignmentRule.update({ where: { id: rule.id }, data: { status: 'STOPPED' } });
  return { cancelled };
}

// Nusxa — har doim qoralama sifatida
export async function copyRule(auth: AuthContext, ruleId: string) {
  const rule = await getRule(auth, ruleId);
  const { id: _id, createdAt: _c, updatedAt: _u, lastRunAt: _l, status: _s, createdByUserId: _cb, ...rest } = rule;
  return prisma.learningAssignmentRule.create({
    data: { ...rest, name: `${rule.name} (nusxa)`, status: 'DRAFT', createdByUserId: auth.userId },
  });
}

// Arxivlash: faol bo'lsa avval to'xtatiladi; tayinlovlarni bekor qilish ixtiyoriy
export async function archiveRule(auth: AuthContext, ruleId: string, cancelAssignments: boolean) {
  const rule = await getRule(auth, ruleId);
  if (rule.status === 'ARCHIVED') throw AppError.badRequest('Qoida allaqachon arxivda');
  const cancelled = cancelAssignments ? await cancelRuleAssignments(rule.id, rule.materialId, auth.userId) : 0;
  await prisma.learningAssignmentRule.update({ where: { id: rule.id }, data: { status: 'ARCHIVED' } });
  return { cancelled };
}

const STATUS_ORDER = { ACTIVE: 0, DRAFT: 1, STOPPED: 2, COMPLETED: 3, ARCHIVED: 4 } as const;

export async function listRules(auth: AuthContext) {
  assertHr(auth);

  // "Kunlik" ishga tushirish o'rniga: sahifa ochilganda eskirgan doimiy
  // qoidalar yangilanadi (24 soatdan oshgan bo'lsa).
  const stale = await prisma.learningAssignmentRule.findMany({
    where: {
      organizationId: auth.organizationId,
      status: 'ACTIVE',
      type: 'PERMANENT',
      OR: [{ lastRunAt: null }, { lastRunAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } }],
    },
    select: { id: true },
  });
  for (const rule of stale) await runRule(rule.id);

  const rules = await prisma.learningAssignmentRule.findMany({
    where: { organizationId: auth.organizationId },
    include: { material: { select: { id: true, title: true, type: true } } },
    orderBy: { createdAt: 'desc' },
  });
  rules.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  // Bajarilish: qoida bergan (bekor qilinmagan) tayinlovlardan nechtasi tugatilgan
  const assignments = await prisma.learningAssignment.findMany({
    where: { organizationId: auth.organizationId, ruleId: { in: rules.map((r) => r.id) } },
    select: { ruleId: true, status: true, employeeId: true, materialId: true },
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

  const [departments, positions, branches] = await Promise.all([
    prisma.department.findMany({ where: { organizationId: auth.organizationId }, select: { id: true, name: true } }),
    prisma.position.findMany({ where: { organizationId: auth.organizationId }, select: { id: true, name: true } }),
    prisma.branch.findMany({ where: { organizationId: auth.organizationId }, select: { id: true, name: true } }),
  ]);
  const nameOf = (list: { id: string; name: string }[], ids: string[]) =>
    ids.map((id) => list.find((x) => x.id === id)?.name).filter(Boolean) as string[];

  return rules.map((r) => {
    const own = assignments.filter((a) => a.ruleId === r.id);
    const live = own.filter((a) => a.status === 'ACTIVE');
    const completed = live.filter((a) => completedKeys.has(`${a.employeeId}:${a.materialId}`)).length;
    return {
      ...r,
      audience: {
        allOrganization: r.allOrganization,
        departments: nameOf(departments, r.departmentIds),
        positions: nameOf(positions, r.positionIds),
        branches: nameOf(branches, r.branchIds),
        hiredWithinDays: r.hiredWithinDays,
      },
      activeAssignments: live.length - completed,
      completedAssignments: completed,
      cancelledAssignments: own.filter((a) => a.status === 'CANCELLED').length,
      completionPercent: live.length ? Math.round((completed / live.length) * 100) : 0,
    };
  });
}
