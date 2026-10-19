// L&D tayinlash mexanizmi: auditoriya, tayinlash, qoidalar (backend'dagi
// assignment.service.ts va rule.service.ts mantiqining brauzer versiyasi).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { badRequest, byId, forbidden, formatDateUz, notFound, notify, sortBy, type Auth } from './core';
import { newId, nowIso, type DemoDb } from './store';

const ASSIGNABLE = ['ACTIVE', 'PROBATION', 'ON_LEAVE'];
const DAY = 24 * 60 * 60 * 1000;

export const isLearningAdmin = (role: string) => role === 'SUPER_ADMIN' || role === 'HR_MANAGER';

export interface Scope {
  all: boolean;
  employeeIds: Set<string>;
}

export function getScope(d: DemoDb, auth: Auth): Scope {
  if (isLearningAdmin(auth.role)) return { all: true, employeeIds: new Set() };
  if (auth.role !== 'DEPARTMENT_HEAD') throw forbidden();
  const self = d.employees.find((e) => e.userId === auth.userId);
  if (!self) throw forbidden();
  const headed = new Set(d.departments.filter((x) => x.headEmployeeId === self.id).map((x) => x.id));
  const subs = d.employees.filter((e) => e.id !== self.id && (e.managerId === self.id || headed.has(e.departmentId)));
  return { all: false, employeeIds: new Set(subs.map((e) => e.id)) };
}

export const inScope = (scope: Scope, id: string) => scope.all || scope.employeeIds.has(id);

export function summarizeEmployee(d: DemoDb, e: any) {
  return { id: e.id, fullName: e.fullName, employeeCode: e.employeeCode, department: byId(d.departments, e.departmentId)?.name ?? null };
}

export function resolveAudience(d: DemoDb, scope: Scope, a: any) {
  const deps = new Set(a.departmentIds ?? []);
  const poss = new Set(a.positionIds ?? []);
  const brs = new Set(a.branchIds ?? []);
  const ids = new Set(a.employeeIds ?? []);
  if (!a.allOrganization && !deps.size && !poss.size && !brs.size && !ids.size) return [];
  return sortBy(
    d.employees.filter(
      (e) =>
        ASSIGNABLE.includes(e.status) &&
        inScope(scope, e.id) &&
        (a.allOrganization || deps.has(e.departmentId) || poss.has(e.positionId) || brs.has(e.branchId) || ids.has(e.id)),
    ),
    (e) => e.fullName,
  );
}

export function filterCandidates(d: DemoDb, materialId: string, audience: any[], skipDays?: number | null) {
  const active = new Set(d.assignments.filter((a) => a.materialId === materialId && a.status === 'ACTIVE').map((a) => a.employeeId));
  const progressById = new Map(d.progress.filter((p) => p.materialId === materialId).map((p) => [p.employeeId, p]));
  const threshold = skipDays ? Date.now() - skipDays * DAY : null;
  const toAssign: any[] = [];
  const skippedActive: any[] = [];
  const skippedCompleted: any[] = [];
  for (const e of audience) {
    const p = progressById.get(e.id);
    if (active.has(e.id)) skippedActive.push(e);
    else if (threshold && p?.status === 'COMPLETED' && p.completedAt && new Date(p.completedAt).getTime() >= threshold) skippedCompleted.push(e);
    else toAssign.push(e);
  }
  return { toAssign, skippedActive, skippedCompleted, progressById };
}

export function resolveDueDate(input: { dueDate?: string | null; dueInDays?: number | null }): string | null {
  if (input.dueDate) return input.dueDate;
  if (input.dueInDays) {
    const dt = new Date();
    dt.setUTCDate(dt.getUTCDate() + Number(input.dueInDays));
    dt.setUTCHours(18, 59, 59, 0);
    return dt.toISOString();
  }
  return null;
}

/** "yyyy-mm-dd" → Toshkent kuni oxiri (backenddagi dateSchema kabi) */
export const endOfDayIso = (v: string | null | undefined) => (v ? new Date(`${String(v).slice(0, 10)}T18:59:59.000Z`).toISOString() : null);
export const startOfDayIso = (v: string | null | undefined) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00.000+05:00`).toISOString() : null);

export function performAssign(
  d: DemoDb,
  input: {
    material: any;
    employees: any[];
    progressById: Map<string, any>;
    assignedByUserId: string | null;
    dueDate: string | null;
    note?: string | null;
    reason: string;
    reasonText?: string | null;
    source: string;
    ruleId?: string | null;
    batchId?: string | null;
    notify?: boolean;
    remindBeforeDays?: number | null;
    remindAfterDays?: number | null;
    resetProgress?: boolean;
  },
) {
  if (input.employees.length === 0) return 0;
  const now = nowIso();
  const message = `Sizga yangi o'quv material tayinlandi: "${input.material.title}"` + (input.dueDate ? ` — muddat: ${formatDateUz(input.dueDate)}` : '');
  for (const e of input.employees) {
    d.assignments.push({
      id: newId(),
      organizationId: d.organization.id,
      employeeId: e.id,
      materialId: input.material.id,
      assignedByUserId: input.assignedByUserId,
      dueDate: input.dueDate,
      note: input.note?.trim() || null,
      reason: input.reason,
      reasonText: input.reason === 'OTHER' ? input.reasonText?.trim() || null : null,
      source: input.source,
      status: 'ACTIVE',
      cancelledAt: null,
      cancelledByUserId: null,
      reminderSentAt: null,
      remindBeforeDays: input.remindBeforeDays === undefined ? 3 : input.remindBeforeDays,
      remindAfterDays: input.remindAfterDays ?? null,
      reminderAfterSentAt: null,
      ruleId: input.ruleId ?? null,
      batchId: input.batchId ?? null,
      createdAt: now,
      updatedAt: now,
    });
    const p = input.progressById.get(e.id);
    if (p && (p.status === 'COMPLETED' || (input.resetProgress && p.status === 'IN_PROGRESS'))) {
      Object.assign(p, { progress: 0, status: 'IN_PROGRESS', completedAt: null });
    }
    if (input.notify !== false) notify(d, e.userId, 'LEARNING_ASSIGNED', message, 'LearningMaterial', input.material.id);
  }
  return input.employees.length;
}

export function describeAudience(d: DemoDb, a: any) {
  if (a.allOrganization) return 'Butun tashkilot';
  const names = [
    ...(a.departmentIds ?? []).map((id: string) => byId(d.departments, id)?.name),
    ...(a.positionIds ?? []).map((id: string) => byId(d.positions, id)?.name),
    ...(a.branchIds ?? []).map((id: string) => byId(d.branches, id)?.name),
  ].filter(Boolean);
  if (a.employeeIds?.length) names.push(`${a.employeeIds.length} ta xodim`);
  return names.join(', ') || null;
}

export function getBatchInScope(d: DemoDb, auth: Auth, batchId: string, forWrite = false) {
  const batch = byId(d.batches, batchId);
  if (!batch) throw notFound('Tayinlov topilmadi');
  if (isLearningAdmin(auth.role)) return batch;
  if (forWrite) {
    if (batch.createdByUserId !== auth.userId) throw forbidden("Bu tayinlovni faqat uni yaratgan yoki HR o'zgartira oladi");
    return batch;
  }
  const scope = getScope(d, auth);
  if (!d.assignments.some((a) => a.batchId === batch.id && scope.employeeIds.has(a.employeeId))) throw forbidden();
  return batch;
}

export function createAssignments(d: DemoDb, auth: Auth, input: any) {
  const batch = input.batchId ? getBatchInScope(d, auth, input.batchId, true) : null;
  if (batch?.source === 'RULE') throw badRequest("Qoida tayinloviga qo'lda xodim qo'shib bo'lmaydi");
  const eff = batch
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
  if (eff.reason === 'OTHER' && !eff.reasonText?.trim()) throw badRequest('"Boshqa" sabab uchun izoh yozing');

  const scope = getScope(d, auth);
  const material = d.materials.find((m) => m.id === eff.materialId && m.status === 'PUBLISHED');
  if (!material) throw notFound('Material topilmadi');
  const audience = resolveAudience(d, scope, eff.audience ?? {});
  const plan = filterCandidates(d, material.id, audience, eff.skipIfCompletedWithinDays);
  if (plan.toAssign.length === 0) throw badRequest("Tayinlanadigan xodim yo'q — hammasida faol tayinlov bor yoki yaqinda tugatgan");

  const dueDate = resolveDueDate(eff);
  let batchId = batch?.id;
  if (!batchId) {
    const now = nowIso();
    const row = {
      id: newId(),
      organizationId: d.organization.id,
      name: input.name?.trim() || `${material.title} — ${formatDateUz(now)}`,
      materialId: material.id,
      source: 'MANUAL',
      ruleId: null,
      reason: eff.reason,
      reasonText: eff.reason === 'OTHER' ? eff.reasonText?.trim() || null : null,
      note: eff.note?.trim() || null,
      dueDate: eff.dueDate ?? null,
      dueInDays: eff.dueDate ? null : eff.dueInDays ?? null,
      audienceSummary: describeAudience(d, eff.audience ?? {}),
      createdByUserId: auth.userId,
      createdAt: now,
      updatedAt: now,
    };
    d.batches.push(row);
    batchId = row.id;
  } else if (batch) {
    const added = describeAudience(d, eff.audience ?? {});
    if (added && !(batch.audienceSummary ?? '').includes(added)) {
      batch.audienceSummary = batch.audienceSummary ? `${batch.audienceSummary}, ${added}` : added;
    }
  }

  const created = performAssign(d, {
    material,
    employees: plan.toAssign,
    progressById: plan.progressById,
    assignedByUserId: auth.userId,
    dueDate,
    note: eff.note,
    reason: eff.reason,
    reasonText: eff.reasonText,
    source: 'MANUAL',
    batchId,
  });
  return { batchId, assignedCount: created, skippedActiveCount: plan.skippedActive.length, skippedCompletedCount: plan.skippedCompleted.length };
}

// ---------------------------------------------------------------------------
// Qoidalar
// ---------------------------------------------------------------------------

export function resolveRuleAudience(d: DemoDb, rule: any, withHireFilter: boolean, onlyEmployeeId?: string) {
  const deps = new Set(rule.departmentIds ?? []);
  const poss = new Set(rule.positionIds ?? []);
  const brs = new Set(rule.branchIds ?? []);
  const codes = new Set(rule.employeeCodes ?? []);
  if (!rule.allOrganization && !deps.size && !poss.size && !brs.size && !codes.size) return [];
  const from = rule.hiredFrom ? new Date(rule.hiredFrom).getTime() : null;
  const to = rule.hiredTo ? new Date(rule.hiredTo).getTime() : null;
  const within = withHireFilter && rule.hiredWithinDays ? Date.now() - rule.hiredWithinDays * DAY : null;
  return sortBy(
    d.employees.filter((e) => {
      if (!ASSIGNABLE.includes(e.status)) return false;
      if (onlyEmployeeId && e.id !== onlyEmployeeId) return false;
      if (!(rule.allOrganization || deps.has(e.departmentId) || poss.has(e.positionId) || brs.has(e.branchId) || codes.has(e.employeeCode))) return false;
      const hired = new Date(e.hiredAt).getTime();
      if (from && hired < from) return false;
      if (to && hired > to) return false;
      if (within && hired < within) return false;
      return true;
    }),
    (e) => e.fullName,
  );
}

function ruleMaterials(d: DemoDb, rule: any, onlyMaterialId?: string) {
  const ids: string[] =
    rule.scope === 'LOCAL' ? (rule.materialId ? [rule.materialId] : []) : d.ruleMaterials.filter((m) => m.ruleId === rule.id).map((m) => m.materialId);
  return ids
    .filter((id) => !onlyMaterialId || id === onlyMaterialId)
    .map((id) => d.materials.find((m) => m.id === id && m.status === 'PUBLISHED'))
    .filter(Boolean) as any[];
}

export function runRule(d: DemoDb, ruleId: string, onlyEmployeeId?: string, onlyMaterialId?: string) {
  const rule = byId(d.rules, ruleId);
  if (!rule || rule.status !== 'ACTIVE') return { assigned: 0, cancelled: 0 };
  const materials = ruleMaterials(d, rule, onlyMaterialId);
  const audience = materials.length ? resolveRuleAudience(d, rule, true, onlyEmployeeId) : [];
  const dueDate = resolveDueDate({ dueDate: rule.type === 'ONE_TIME' ? rule.dueDate : null, dueInDays: rule.dueInDays });
  const done = rule.type === 'ONE_TIME' ? new Set(d.batches.filter((b) => b.ruleId === rule.id).map((b) => b.materialId)) : new Set<string>();

  let assigned = 0;
  let cancelled = 0;
  for (const material of materials) {
    if (done.has(material.id)) continue;
    const split = filterCandidates(d, material.id, audience, rule.skipIfCompletedWithinDays);
    let batch: any = null;
    if (split.toAssign.length > 0) {
      batch = d.batches.find((b) => b.ruleId === rule.id && b.materialId === material.id);
      if (!batch) {
        const now = nowIso();
        batch = {
          id: newId(),
          organizationId: d.organization.id,
          name: rule.name,
          materialId: material.id,
          source: 'RULE',
          ruleId: rule.id,
          reason: rule.reason,
          reasonText: rule.reasonText,
          note: rule.note,
          dueDate: rule.dueDate,
          dueInDays: rule.dueInDays,
          audienceSummary: null,
          createdByUserId: rule.createdByUserId,
          createdAt: now,
          updatedAt: now,
        };
        d.batches.push(batch);
      }
    }
    assigned += performAssign(d, {
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
      notify: rule.notifyOnAssign,
      remindBeforeDays: rule.remindBeforeDays,
      remindAfterDays: rule.remindAfterDays,
      resetProgress: rule.resetProgress,
    });
    if (rule.type === 'PERMANENT' && rule.cancelOutOfScope) {
      const inScopeIds = new Set(resolveRuleAudience(d, rule, false, onlyEmployeeId).map((e) => e.id));
      for (const a of d.assignments) {
        if (a.ruleId !== rule.id || a.materialId !== material.id || a.status !== 'ACTIVE') continue;
        if (onlyEmployeeId && a.employeeId !== onlyEmployeeId) continue;
        if (inScopeIds.has(a.employeeId)) continue;
        if (d.progress.some((p) => p.employeeId === a.employeeId && p.materialId === material.id && p.status === 'COMPLETED')) continue;
        a.status = 'CANCELLED';
        a.cancelledAt = nowIso();
        cancelled += 1;
      }
    }
  }
  rule.lastRunAt = nowIso();
  if (rule.type === 'ONE_TIME' && rule.scope === 'LOCAL' && !onlyEmployeeId && !onlyMaterialId) rule.status = 'COMPLETED';
  return { assigned, cancelled };
}

export function syncRulesForEmployee(d: DemoDb, employeeId: string) {
  for (const rule of d.rules.filter((r) => r.status === 'ACTIVE' && r.type === 'PERMANENT')) runRule(d, rule.id, employeeId);
}

export function rulesForMaterial(d: DemoDb, materialId: string, statuses?: string[]) {
  return d.rules.filter(
    (r) =>
      (!statuses || statuses.includes(r.status)) &&
      ((r.scope === 'LOCAL' && r.materialId === materialId) ||
        (r.scope === 'GLOBAL' && d.ruleMaterials.some((m) => m.ruleId === r.id && m.materialId === materialId))),
  );
}

export function runRulesForMaterial(d: DemoDb, materialId: string) {
  let assigned = 0;
  for (const rule of rulesForMaterial(d, materialId, ['ACTIVE'])) assigned += runRule(d, rule.id, undefined, materialId).assigned;
  return { assigned };
}

export function validateRuleInput(d: DemoDb, input: any) {
  if (input.materialId && !d.materials.some((m) => m.id === input.materialId && m.status !== 'ARCHIVED')) throw notFound('Material topilmadi');
  if (input.reason === 'OTHER' && !input.reasonText?.trim()) throw badRequest('"Boshqa" sabab uchun izoh yozing');
  const has = input.allOrganization || input.departmentIds?.length || input.positionIds?.length || input.branchIds?.length || input.employeeCodes?.length;
  if (!has) throw badRequest('Maqsadli guruhni tanlang: butun tashkilot, bo‘lim, lavozim, filial yoki tabel raqamlari');
  if (input.hiredFrom && input.hiredTo && input.hiredFrom > input.hiredTo) throw badRequest("Ishga kirgan sana oralig'i noto'g'ri");
  if (input.type === 'PERMANENT' && input.dueDate) throw badRequest("Doimiy qoidada aniq sana bo'lmaydi — 'N kun ichida' muddatidan foydalaning");
}

/** So'rov tanasidagi sanalarni backend'dagi kabi normallashtiradi */
export function normalizeRuleBody(b: any) {
  return {
    ...b,
    hiredFrom: b.hiredFrom ? startOfDayIso(b.hiredFrom) : b.hiredFrom ?? undefined,
    hiredTo: b.hiredTo ? endOfDayIso(b.hiredTo) : b.hiredTo ?? undefined,
    dueDate: b.dueDate ? endOfDayIso(b.dueDate) : b.dueDate ?? undefined,
    dueInDays: b.dueInDays === '' || b.dueInDays === undefined ? undefined : b.dueInDays === null ? null : Number(b.dueInDays),
    hiredWithinDays: b.hiredWithinDays === '' || b.hiredWithinDays == null ? null : Number(b.hiredWithinDays),
    skipIfCompletedWithinDays: b.skipIfCompletedWithinDays === '' || b.skipIfCompletedWithinDays == null ? null : Number(b.skipIfCompletedWithinDays),
    remindBeforeDays: b.remindBeforeDays === undefined ? undefined : b.remindBeforeDays === null || b.remindBeforeDays === '' ? null : Number(b.remindBeforeDays),
    remindAfterDays: b.remindAfterDays == null || b.remindAfterDays === '' ? null : Number(b.remindAfterDays),
  };
}

export function ruleData(input: any) {
  return {
    name: String(input.name ?? '').trim(),
    description: input.description?.trim() || null,
    tag: input.tag?.trim().toLowerCase().replace(/^#/, '') || null,
    type: input.type,
    allOrganization: Boolean(input.allOrganization),
    departmentIds: input.allOrganization ? [] : input.departmentIds ?? [],
    positionIds: input.allOrganization ? [] : input.positionIds ?? [],
    branchIds: input.allOrganization ? [] : input.branchIds ?? [],
    hiredWithinDays: input.hiredWithinDays ?? null,
    employeeCodes: [...new Set(((input.employeeCodes ?? []) as string[]).map((c) => c.trim()).filter(Boolean))].slice(0, 2000),
    hiredFrom: input.hiredFrom ?? null,
    hiredTo: input.hiredTo ?? null,
    notifyOnAssign: input.notifyOnAssign ?? true,
    remindBeforeDays: input.remindBeforeDays === undefined ? 3 : input.remindBeforeDays,
    remindAfterDays: input.remindAfterDays ?? null,
    resetProgress: Boolean(input.resetProgress),
    reason: input.reason,
    reasonText: input.reason === 'OTHER' ? input.reasonText?.trim() ?? null : null,
    note: input.note?.trim() || null,
    dueInDays: input.dueDate ? null : input.dueInDays ?? null,
    dueDate: input.type === 'ONE_TIME' ? input.dueDate ?? null : null,
    skipIfCompletedWithinDays: input.skipIfCompletedWithinDays ?? null,
    cancelOutOfScope: input.type === 'PERMANENT' ? input.cancelOutOfScope ?? true : false,
  };
}

export function createRule(d: DemoDb, auth: Auth, input: any, activate = true) {
  if (!isLearningAdmin(auth.role)) throw forbidden('Qoidalarni faqat HR boshqaradi');
  if (!String(input.name ?? '').trim()) throw badRequest('Qoida nomini kiriting');
  validateRuleInput(d, input);
  const now = nowIso();
  const rule = {
    id: newId(),
    organizationId: d.organization.id,
    createdByUserId: auth.userId,
    ...ruleData(input),
    scope: input.materialId ? 'LOCAL' : 'GLOBAL',
    materialId: input.materialId ?? null,
    status: activate ? 'ACTIVE' : 'DRAFT',
    lastRunAt: null,
    createdAt: now,
    updatedAt: now,
  };
  d.rules.push(rule);
  if (!activate) return { rule, assigned: 0, cancelled: 0 };
  const result = runRule(d, rule.id);
  return { rule, ...result };
}

export function cancelRuleAssignments(d: DemoDb, ruleId: string, userId: string, materialId?: string) {
  let count = 0;
  for (const a of d.assignments) {
    if (a.ruleId !== ruleId || a.status !== 'ACTIVE' || (materialId && a.materialId !== materialId)) continue;
    if (d.progress.some((p) => p.employeeId === a.employeeId && p.materialId === a.materialId && p.status === 'COMPLETED')) continue;
    Object.assign(a, { status: 'CANCELLED', cancelledAt: nowIso(), cancelledByUserId: userId });
    count += 1;
  }
  return count;
}

export const isCompleted = (d: DemoDb, employeeId: string, materialId: string) =>
  d.progress.some((p) => p.employeeId === employeeId && p.materialId === materialId && p.status === 'COMPLETED');

/** Muddati yaqin/o'tgan tayinlovlar uchun eslatmalar (xodim o'z sahifasini ochganda) */
export function sendDueReminders(d: DemoDb, employeeId: string, userId: string) {
  const now = Date.now();
  for (const a of d.assignments) {
    if (a.employeeId !== employeeId || a.status !== 'ACTIVE' || !a.dueDate) continue;
    if (isCompleted(d, employeeId, a.materialId)) continue;
    const due = new Date(a.dueDate).getTime();
    const material = byId(d.materials, a.materialId);
    if (!material) continue;
    if (a.reminderSentAt === null && a.remindBeforeDays != null && due > now && due - a.remindBeforeDays * DAY <= now) {
      notify(d, userId, 'LEARNING_REMINDER', `"${material.title}" materialini ${formatDateUz(a.dueDate)} gacha tugatishingiz kerak`, 'LearningMaterial', material.id);
      a.reminderSentAt = nowIso();
    }
    if (a.reminderAfterSentAt === null && a.remindAfterDays != null && due + a.remindAfterDays * DAY <= now) {
      notify(d, userId, 'LEARNING_REMINDER', `"${material.title}" materialini o'tish muddati o'tib ketdi (${formatDateUz(a.dueDate)}) — iltimos, tugating`, 'LearningMaterial', material.id);
      a.reminderAfterSentAt = nowIso();
    }
  }
}
