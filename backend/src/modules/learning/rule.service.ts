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
// GLOBAL qoida — materialsiz: "kimga va qanday" tayinlash. Kurs ichida
//   istalgan miqdordagi kursga biriktiriladi (LearningRuleMaterial) va har
//   bir biriktirilgan kurs bo'yicha ishlaydi.
// LOCAL qoida — kurs ichida yaratilgan, faqat o'sha kursga ta'sir qiladi.
//
// ONE_TIME  — faollashtirilganda bir marta ishlaydi, keyin "Bajarildi".
// PERMANENT — doimiy: shartga mos yangi xodimlarga tayinlaydi, shartdan
//             chiqqanlarning tugallanmagan tayinlovini bekor qiladi.
//
// Cron yo'q (Render bepul rejasi uxlaydi) — doimiy qoidalar voqealarda
// ishga tushadi: faollashtirilganda, kursga biriktirilganda, kurs nashr
// qilinganda, xodim yaratilganda/ko'chirilganda, xodim o'qish sahifasini
// ochganda, qoidalar sahifasi ochilganda (24 soatdan oshgan bo'lsa) va qo'lda.

const ASSIGNABLE_EMPLOYMENT_STATUSES = ['ACTIVE', 'PROBATION', 'ON_LEAVE'] as const;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function assertHr(auth: AuthContext) {
  if (!isLearningAdmin(auth.role)) throw AppError.forbidden('Qoidalarni faqat HR boshqaradi');
}

export interface RuleInput {
  name: string;
  description?: string | null;
  tag?: string | null;
  materialId?: string | null; // berilsa — LOCAL (faqat shu kurs uchun) qoida
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

// Qoida ta'sir qiladigan nashr qilingan kurslar: LOCAL — o'z kursi,
// GLOBAL — biriktirilgan kurslar
async function ruleMaterials(rule: LearningAssignmentRule, onlyMaterialId?: string) {
  const ids =
    rule.scope === 'LOCAL'
      ? rule.materialId
        ? [rule.materialId]
        : []
      : (await prisma.learningRuleMaterial.findMany({ where: { ruleId: rule.id }, select: { materialId: true } })).map((m) => m.materialId);
  const filtered = onlyMaterialId ? ids.filter((id) => id === onlyMaterialId) : ids;
  if (filtered.length === 0) return [];
  return prisma.learningMaterial.findMany({
    where: { id: { in: filtered }, status: 'PUBLISHED' },
    select: { id: true, title: true },
  });
}

// ---------------------------------------------------------------------------
// Qoidani ishga tushirish
// ---------------------------------------------------------------------------

export async function runRule(ruleId: string, onlyEmployeeId?: string, onlyMaterialId?: string) {
  const rule = await prisma.learningAssignmentRule.findUnique({ where: { id: ruleId } });
  if (!rule || rule.status !== 'ACTIVE') return { assigned: 0, cancelled: 0 };

  const materials = await ruleMaterials(rule, onlyMaterialId);
  const audience = materials.length ? await resolveRuleAudience(rule, true, onlyEmployeeId) : [];
  const dueDate = resolveDueDate({ dueDate: rule.type === 'ONE_TIME' ? rule.dueDate : null, dueInDays: rule.dueInDays });

  let assigned = 0;
  let cancelled = 0;
  for (const material of materials) {
    const split = await filterCandidates(rule.organizationId, material.id, audience, rule.skipIfCompletedWithinDays);

    // Har bir (qoida, kurs) juftligi — "Tayinlovlar" ro'yxatida bitta qator
    const batch =
      split.toAssign.length > 0
        ? await prisma.learningAssignmentBatch.upsert({
            where: { ruleId_materialId: { ruleId: rule.id, materialId: material.id } },
            create: {
              organizationId: rule.organizationId,
              name: rule.name,
              materialId: material.id,
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

    assigned += await performAssign({
      organizationId: rule.organizationId,
      material,
      employees: split.toAssign,
      progressById: split.progressById,
      assignedByUserId: rule.createdByUserId,
      dueDate,
      note: rule.note,
      reason: rule.reason,
      reasonText: rule.reasonText,
      source: 'RULE',
      ruleId: rule.id,
      batchId: batch?.id ?? null,
    });

    if (rule.type === 'PERMANENT' && rule.cancelOutOfScope) {
      cancelled += await cancelOutOfScopeAssignments(rule, material.id, onlyEmployeeId);
    }
  }

  await prisma.learningAssignmentRule.update({
    where: { id: rule.id },
    // Bir martalik qoida to'liq ishlagach — Bajarildi
    data: {
      lastRunAt: new Date(),
      ...(rule.type === 'ONE_TIME' && !onlyEmployeeId && !onlyMaterialId ? { status: 'COMPLETED' as const } : {}),
    },
  });
  return { assigned, cancelled };
}

// Shartdan chiqqan xodimlarning shu qoida (shu kurs bo'yicha) bergan, hali
// tugatilmagan tayinlovlarini bekor qiladi. Boshqa tayinlovlarga tegmaydi.
async function cancelOutOfScopeAssignments(rule: LearningAssignmentRule, materialId: string, onlyEmployeeId?: string) {
  const active = await prisma.learningAssignment.findMany({
    where: { ruleId: rule.id, materialId, status: 'ACTIVE', ...(onlyEmployeeId ? { employeeId: onlyEmployeeId } : {}) },
    select: { id: true, employeeId: true },
  });
  if (active.length === 0) return 0;

  const inScope = await resolveRuleAudience(rule, false, onlyEmployeeId);
  const inScopeIds = new Set(inScope.map((e) => e.id));
  const outOfScope = active.filter((a) => !inScopeIds.has(a.employeeId));
  if (outOfScope.length === 0) return 0;

  const completed = await prisma.learningProgress.findMany({
    where: { materialId, employeeId: { in: outOfScope.map((a) => a.employeeId) }, status: 'COMPLETED' },
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

// Kurs nashr qilinganda — unga biriktirilgan va lokal faol qoidalar shu kurs bo'yicha ishlaydi
export async function runRulesForMaterial(organizationId: string, materialId: string) {
  const rules = await prisma.learningAssignmentRule.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      OR: [{ scope: 'LOCAL', materialId }, { scope: 'GLOBAL', materials: { some: { materialId } } }],
    },
    select: { id: true },
  });
  let assigned = 0;
  for (const rule of rules) assigned += (await runRule(rule.id, undefined, materialId)).assigned;
  return { assigned };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

async function validateRuleInput(auth: AuthContext, input: RuleInput) {
  if (input.materialId) {
    const material = await prisma.learningMaterial.findFirst({
      where: { id: input.materialId, organizationId: auth.organizationId, status: { not: 'ARCHIVED' } },
      select: { id: true },
    });
    if (!material) throw AppError.notFound('Material topilmadi');
  }
  if (input.reason === 'OTHER' && !input.reasonText?.trim()) {
    throw AppError.badRequest('"Boshqa" sabab uchun izoh yozing');
  }
  const hasAudience =
    input.allOrganization || input.departmentIds?.length || input.positionIds?.length || input.branchIds?.length;
  if (!hasAudience) throw AppError.badRequest('Maqsadli guruhni tanlang: butun tashkilot, bo‘lim, lavozim yoki filial');
  if (input.type === 'PERMANENT' && input.dueDate) {
    throw AppError.badRequest("Doimiy qoidada aniq sana bo'lmaydi — 'N kun ichida' muddatidan foydalaning");
  }
}

function ruleData(input: RuleInput) {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    tag: input.tag?.trim().toLowerCase().replace(/^#/, '') || null,
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

// Qoida saqlanmasdan — maqsadli guruhga nechta xodim mos kelishini hisoblaydi.
// Kurs berilsa (lokal qoida) — shu kurs bo'yicha faol/yaqinda o'tganlar ham ajratiladi.
export async function previewRule(auth: AuthContext, input: RuleInput) {
  assertHr(auth);
  await validateRuleInput(auth, input);
  const criteria = { organizationId: auth.organizationId, ...ruleData(input) };
  const audience = await resolveRuleAudience(criteria, true);
  const summarize = (list: typeof audience) =>
    list.slice(0, 200).map((e) => ({ id: e.id, fullName: e.fullName, employeeCode: e.employeeCode, department: e.department?.name ?? null }));
  if (!input.materialId) {
    return {
      total: audience.length,
      toAssignCount: audience.length,
      skippedActiveCount: 0,
      skippedCompletedCount: 0,
      toAssign: summarize(audience),
      skippedActive: [],
      skippedCompleted: [],
    };
  }
  const split = await filterCandidates(auth.organizationId, input.materialId, audience, input.skipIfCompletedWithinDays);
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

// Yangi qoida: materialId berilsa — LOCAL, aks holda GLOBAL.
// activate=false — qoralama; true — darhol faollashtiriladi va ishlaydi.
export async function createRule(auth: AuthContext, input: RuleInput, activate = true) {
  assertHr(auth);
  await validateRuleInput(auth, input);
  const rule = await prisma.learningAssignmentRule.create({
    data: {
      organizationId: auth.organizationId,
      createdByUserId: auth.userId,
      ...ruleData(input),
      scope: input.materialId ? 'LOCAL' : 'GLOBAL',
      materialId: input.materialId ?? null,
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

// Tahrirlash formasi uchun: qoida + biriktirilgan (yoki lokal) kurslar
export async function getRuleDetail(auth: AuthContext, ruleId: string) {
  const rule = await getRule(auth, ruleId);
  const materials =
    rule.scope === 'LOCAL'
      ? await prisma.learningMaterial.findMany({ where: { id: rule.materialId ?? '' }, select: { id: true, title: true, type: true, status: true } })
      : (
          await prisma.learningRuleMaterial.findMany({
            where: { ruleId: rule.id },
            include: { material: { select: { id: true, title: true, type: true, status: true } } },
          })
        ).map((m) => m.material);
  return { ...rule, materials };
}

// Faqat qoralama yoki to'xtatilgan qoida tahrirlanadi (faol qoidani avval to'xtatish kerak)
export async function updateRule(auth: AuthContext, ruleId: string, input: RuleInput) {
  const rule = await getRule(auth, ruleId);
  if (rule.status !== 'DRAFT' && rule.status !== 'STOPPED') {
    throw AppError.badRequest("Faqat qoralama yoki to'xtatilgan qoidani tahrirlash mumkin — avval to'xtating");
  }
  await validateRuleInput(auth, { ...input, materialId: rule.materialId });
  const data = ruleData(input);
  // Qoida tayinlovlari nomi va parametrlari qoida bilan birga yangilanadi
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

async function cancelRuleAssignments(ruleId: string, userId: string, materialId?: string) {
  const active = await prisma.learningAssignment.findMany({
    where: { ruleId, status: 'ACTIVE', ...(materialId ? { materialId } : {}) },
    select: { id: true, employeeId: true, materialId: true },
  });
  if (active.length === 0) return 0;
  const completed = await prisma.learningProgress.findMany({
    where: {
      employeeId: { in: active.map((a) => a.employeeId) },
      materialId: { in: [...new Set(active.map((a) => a.materialId))] },
      status: 'COMPLETED',
    },
    select: { employeeId: true, materialId: true },
  });
  const done = new Set(completed.map((c) => `${c.employeeId}:${c.materialId}`));
  const result = await prisma.learningAssignment.updateMany({
    where: { id: { in: active.filter((a) => !done.has(`${a.employeeId}:${a.materialId}`)).map((a) => a.id) } },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledByUserId: userId },
  });
  return result.count;
}

// Faollashtirish: qoralama yoki to'xtatilgan -> Faol, darhol ishga tushadi.
export async function activateRule(auth: AuthContext, ruleId: string) {
  const rule = await getRule(auth, ruleId);
  if (rule.status !== 'DRAFT' && rule.status !== 'STOPPED') {
    throw AppError.badRequest('Bu holatdagi qoidani faollashtirib bo‘lmaydi');
  }
  await validateRuleInput(auth, { ...rule, description: rule.description, tag: rule.tag });
  await prisma.learningAssignmentRule.update({ where: { id: rule.id }, data: { status: 'ACTIVE' } });
  return runRule(rule.id);
}

// To'xtatish. cancelAssignments=true — qoida bergan tugallanmagan tayinlovlar ham bekor qilinadi.
export async function stopRule(auth: AuthContext, ruleId: string, cancelAssignments: boolean) {
  const rule = await getRule(auth, ruleId);
  if (rule.status !== 'ACTIVE') throw AppError.badRequest('Faqat faol qoidani to‘xtatish mumkin');
  const cancelled = cancelAssignments ? await cancelRuleAssignments(rule.id, auth.userId) : 0;
  await prisma.learningAssignmentRule.update({ where: { id: rule.id }, data: { status: 'STOPPED' } });
  return { cancelled };
}

// Nusxa — har doim qoralama; kurs biriktirmalari ko'chirilmaydi
export async function copyRule(auth: AuthContext, ruleId: string) {
  const rule = await getRule(auth, ruleId);
  const { id: _id, createdAt: _c, updatedAt: _u, lastRunAt: _l, status: _s, createdByUserId: _cb, ...rest } = rule;
  return prisma.learningAssignmentRule.create({
    data: { ...rest, name: `${rule.name} (nusxa)`, status: 'DRAFT', createdByUserId: auth.userId },
  });
}

// Arxivlash: tayinlovlarni bekor qilish ixtiyoriy
export async function archiveRule(auth: AuthContext, ruleId: string, cancelAssignments: boolean) {
  const rule = await getRule(auth, ruleId);
  if (rule.status === 'ARCHIVED') throw AppError.badRequest('Qoida allaqachon arxivda');
  const cancelled = cancelAssignments ? await cancelRuleAssignments(rule.id, auth.userId) : 0;
  await prisma.learningAssignmentRule.update({ where: { id: rule.id }, data: { status: 'ARCHIVED' } });
  return { cancelled };
}

// ---------------------------------------------------------------------------
// Kurs ichida: global qoidani biriktirish / ajratish
// ---------------------------------------------------------------------------

async function getMaterialForRules(auth: AuthContext, materialId: string) {
  const material = await prisma.learningMaterial.findFirst({
    where: { id: materialId, organizationId: auth.organizationId },
    select: { id: true, status: true },
  });
  if (!material) throw AppError.notFound('Material topilmadi');
  return material;
}

// Biriktirish; qoida faol va kurs nashr qilingan bo'lsa — darhol shu kurs bo'yicha ishlaydi
export async function attachRule(auth: AuthContext, materialId: string, ruleId: string) {
  assertHr(auth);
  await getMaterialForRules(auth, materialId);
  const rule = await getRule(auth, ruleId);
  if (rule.scope !== 'GLOBAL') throw AppError.badRequest('Faqat global qoidani biriktirish mumkin');
  if (rule.status === 'ARCHIVED') throw AppError.badRequest('Arxivdagi qoidani biriktirib bo‘lmaydi');
  await prisma.learningRuleMaterial.upsert({
    where: { ruleId_materialId: { ruleId, materialId } },
    create: { ruleId, materialId, organizationId: auth.organizationId, attachedByUserId: auth.userId },
    update: {},
  });
  return runRule(rule.id, undefined, materialId);
}

// Ajratish; cancelAssignments=true — shu qoida shu kurs bo'yicha bergan tugallanmagan tayinlovlar bekor qilinadi
export async function detachRule(auth: AuthContext, materialId: string, ruleId: string, cancelAssignments: boolean) {
  assertHr(auth);
  await getMaterialForRules(auth, materialId);
  const rule = await getRule(auth, ruleId);
  await prisma.learningRuleMaterial.deleteMany({ where: { ruleId, materialId } });
  const cancelled = cancelAssignments ? await cancelRuleAssignments(rule.id, auth.userId, materialId) : 0;
  return { cancelled };
}

// ---------------------------------------------------------------------------
// Ro'yxatlar
// ---------------------------------------------------------------------------

const STATUS_ORDER = { ACTIVE: 0, DRAFT: 1, STOPPED: 2, COMPLETED: 3, ARCHIVED: 4 } as const;

async function decorateRules(organizationId: string, rules: (LearningAssignmentRule & { material: { id: string; title: string; type: string } | null })[]) {
  const ruleIds = rules.map((r) => r.id);
  const [attachments, assignments, departments, positions, branches] = await Promise.all([
    prisma.learningRuleMaterial.findMany({
      where: { ruleId: { in: ruleIds } },
      include: { material: { select: { id: true, title: true, type: true, status: true } } },
    }),
    prisma.learningAssignment.findMany({
      where: { organizationId, ruleId: { in: ruleIds } },
      select: { ruleId: true, status: true, employeeId: true, materialId: true },
    }),
    prisma.department.findMany({ where: { organizationId }, select: { id: true, name: true } }),
    prisma.position.findMany({ where: { organizationId }, select: { id: true, name: true } }),
    prisma.branch.findMany({ where: { organizationId }, select: { id: true, name: true } }),
  ]);
  const completedRows = await prisma.learningProgress.findMany({
    where: {
      organizationId,
      status: 'COMPLETED',
      employeeId: { in: [...new Set(assignments.map((a) => a.employeeId))] },
      materialId: { in: [...new Set(assignments.map((a) => a.materialId))] },
    },
    select: { employeeId: true, materialId: true },
  });
  const completedKeys = new Set(completedRows.map((c) => `${c.employeeId}:${c.materialId}`));
  const nameOf = (list: { id: string; name: string }[], ids: string[]) =>
    ids.map((id) => list.find((x) => x.id === id)?.name).filter(Boolean) as string[];

  return rules.map((r) => {
    const own = assignments.filter((a) => a.ruleId === r.id);
    const live = own.filter((a) => a.status === 'ACTIVE');
    const completed = live.filter((a) => completedKeys.has(`${a.employeeId}:${a.materialId}`)).length;
    const materials = r.scope === 'LOCAL' ? (r.material ? [r.material] : []) : attachments.filter((a) => a.ruleId === r.id).map((a) => a.material);
    return {
      ...r,
      materials,
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

// Qoidalar sahifasi — global qoidalar (lokal qoidalar kurs ichida ko'rinadi)
export async function listRules(auth: AuthContext, query: { scope?: 'GLOBAL' | 'LOCAL' | 'ALL' } = {}) {
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

  const scope = query.scope ?? 'GLOBAL';
  const rules = await prisma.learningAssignmentRule.findMany({
    where: { organizationId: auth.organizationId, ...(scope === 'ALL' ? {} : { scope }) },
    include: { material: { select: { id: true, title: true, type: true } } },
    orderBy: { createdAt: 'desc' },
  });
  rules.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  return decorateRules(auth.organizationId, rules);
}

// Kurs ichidagi "Tayinlash" bloki: shu kursga biriktirilgan global va lokal qoidalar
export async function listRulesForMaterial(auth: AuthContext, materialId: string) {
  assertHr(auth);
  await getMaterialForRules(auth, materialId);
  const rules = await prisma.learningAssignmentRule.findMany({
    where: {
      organizationId: auth.organizationId,
      status: { not: 'ARCHIVED' },
      OR: [{ scope: 'LOCAL', materialId }, { scope: 'GLOBAL', materials: { some: { materialId } } }],
    },
    include: { material: { select: { id: true, title: true, type: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return decorateRules(auth.organizationId, rules);
}
