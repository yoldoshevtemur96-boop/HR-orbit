// Demo API: L&D boshqaruvi (/learning-admin/*) — katalog, tayinlovlar, qoidalar.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { badRequest, byId, contains, forbidden, notFound, requireRole, route, sortBy, type Ctx } from '../core';
import { newId, nowIso, type DemoDb } from '../store';
import {
  cancelRuleAssignments,
  createAssignments,
  createRule,
  endOfDayIso,
  filterCandidates,
  getBatchInScope,
  getScope,
  inScope,
  isCompleted,
  isLearningAdmin,
  normalizeRuleBody,
  resolveAudience,
  resolveRuleAudience,
  ruleData,
  rulesForMaterial,
  runRule,
  runRulesForMaterial,
  startOfDayIso,
  summarizeEmployee,
  validateRuleInput,
} from '../learningEngine';

const ADMIN_ROLES = ['SUPER_ADMIN', 'HR_MANAGER', 'DEPARTMENT_HEAD'];
const DAY = 24 * 60 * 60 * 1000;

function guard(ctx: Ctx) {
  requireRole(ctx, ...ADMIN_ROLES);
}
function assertHr(ctx: Ctx, message = 'Bu bo‘limni faqat HR boshqaradi') {
  if (!isLearningAdmin(ctx.auth!.role)) throw forbidden(message);
}

// --- Bosh sahifa -----------------------------------------------------------------

route('GET', '/learning-admin/overview', (ctx) => {
  guard(ctx);
  const d = ctx.db;
  const scope = getScope(d, ctx.auth!);
  const isHr = isLearningAdmin(ctx.auth!.role);
  const now = Date.now();
  const active = d.assignments.filter((a) => a.status === 'ACTIVE' && inScope(scope, a.employeeId));
  const done = (a: any) => isCompleted(d, a.employeeId, a.materialId);
  const assignments = {
    active: active.filter((a) => !done(a)).length,
    completed: active.filter(done).length,
    overdue: active.filter((a) => !done(a) && a.dueDate && new Date(a.dueDate).getTime() < now).length,
  };
  const pending = d.requests.filter((r) => r.status === 'PENDING' && inScope(scope, r.employeeId)).length;
  if (!isHr) return { isHr, assignments, requests: { pending } };
  const live = d.materials.filter((m) => m.status !== 'ARCHIVED');
  return {
    isHr,
    assignments,
    requests: { pending },
    catalog: {
      total: live.length,
      latest: sortBy(live, (m) => m.createdAt, 'desc')
        .slice(0, 3)
        .map((m) => ({ id: m.id, title: m.title, type: m.type, coverUrl: m.coverUrl, status: m.status })),
    },
    events: { upcoming: d.events.filter((e) => e.status === 'PUBLISHED' && new Date(e.endsAt).getTime() >= now).length },
    rules: { active: d.rules.filter((r) => r.status === 'ACTIVE').length },
  };
});

route('GET', '/learning-admin/materials', (ctx) => {
  guard(ctx);
  getScope(ctx.db, ctx.auth!);
  const d = ctx.db;
  return sortBy(
    d.materials.filter((m) => m.status === 'PUBLISHED'),
    (m) => m.title,
  ).map((m) => ({
    id: m.id,
    title: m.title,
    type: m.type,
    durationMinutes: m.durationMinutes,
    coverUrl: m.coverUrl,
    activeAssignments: d.assignments.filter((a) => a.materialId === m.id && a.status === 'ACTIVE').length,
  }));
});

route('GET', '/learning-admin/audience-options', (ctx) => {
  guard(ctx);
  const d = ctx.db;
  const scope = getScope(d, ctx.auth!);
  const employees = sortBy(
    d.employees.filter((e) => ['ACTIVE', 'PROBATION', 'ON_LEAVE'].includes(e.status) && inScope(scope, e.id)),
    (e) => e.fullName,
  );
  const ids = (key: string) => new Set(employees.map((e) => e[key]).filter(Boolean));
  const depIds = ids('departmentId');
  const posIds = ids('positionId');
  const brIds = ids('branchId');
  const count = (key: string, id: string) => employees.filter((e) => e[key] === id).length;
  return {
    canAssignWholeOrganization: scope.all,
    departments: sortBy(d.departments.filter((x) => x.status === 'ACTIVE' && (scope.all || depIds.has(x.id))), (x) => x.name).map((x) => ({ id: x.id, name: x.name, employeeCount: count('departmentId', x.id) })),
    positions: sortBy(d.positions.filter((x) => scope.all || posIds.has(x.id)), (x) => x.name).map((x) => ({ id: x.id, name: x.name, employeeCount: count('positionId', x.id) })),
    branches: sortBy(d.branches.filter((x) => x.status === 'ACTIVE' && (scope.all || brIds.has(x.id))), (x) => x.name).map((x) => ({ id: x.id, name: x.name, employeeCount: count('branchId', x.id) })),
    employees: employees.map((e) => ({ id: e.id, fullName: e.fullName, employeeCode: e.employeeCode, departmentId: e.departmentId })),
  };
});

// --- Qo'lda tayinlash ------------------------------------------------------------

function normalizeAssignBody(b: any) {
  if (b.dueDate && b.dueInDays) throw badRequest('Muddatni bitta usulda kiriting');
  return {
    ...b,
    dueDate: b.dueDate ? endOfDayIso(b.dueDate) : undefined,
    dueInDays: b.dueInDays ? Number(b.dueInDays) : undefined,
    skipIfCompletedWithinDays: b.skipIfCompletedWithinDays ? Number(b.skipIfCompletedWithinDays) : undefined,
  };
}

route('POST', '/learning-admin/assignments/preview', (ctx) => {
  guard(ctx);
  const d = ctx.db;
  const input = normalizeAssignBody(ctx.body ?? {});
  const scope = getScope(d, ctx.auth!);
  const material = d.materials.find((m) => m.id === input.materialId && m.status === 'PUBLISHED');
  if (!material) throw notFound('Material topilmadi');
  const plan = filterCandidates(d, material.id, resolveAudience(d, scope, input.audience ?? {}), input.skipIfCompletedWithinDays);
  const sum = (l: any[]) => l.slice(0, 200).map((e) => summarizeEmployee(d, e));
  return {
    total: plan.toAssign.length + plan.skippedActive.length + plan.skippedCompleted.length,
    toAssignCount: plan.toAssign.length,
    skippedActiveCount: plan.skippedActive.length,
    skippedCompletedCount: plan.skippedCompleted.length,
    toAssign: sum(plan.toAssign),
    skippedActive: sum(plan.skippedActive),
    skippedCompleted: sum(plan.skippedCompleted),
  };
});

route(
  'POST',
  '/learning-admin/assignments',
  (ctx) => {
    guard(ctx);
    return createAssignments(ctx.db, ctx.auth!, normalizeAssignBody(ctx.body ?? {}));
  },
  { status: 201 },
);

function assignmentState(d: DemoDb, a: any) {
  const p = d.progress.find((x) => x.employeeId === a.employeeId && x.materialId === a.materialId) ?? null;
  let state: string;
  if (a.status === 'CANCELLED') state = 'CANCELLED';
  else if (p?.status === 'COMPLETED') state = 'COMPLETED';
  else if (a.dueDate && new Date(a.dueDate).getTime() < Date.now()) state = 'OVERDUE';
  else if (p) state = 'IN_PROGRESS';
  else state = 'NOT_STARTED';
  return { p, state };
}

route('GET', '/learning-admin/assignments', (ctx) => {
  guard(ctx);
  const d = ctx.db;
  const q = ctx.query;
  const scope = getScope(d, ctx.auth!);
  const s = String(q.search ?? '').trim();
  const employees = d.employees.filter(
    (e) => inScope(scope, e.id) && (!q.departmentId || e.departmentId === q.departmentId) && (!s || contains(e.fullName, s) || contains(e.employeeCode, s)),
  );
  const empById = new Map(employees.map((e) => [e.id, e]));
  const list = sortBy(
    d.assignments.filter((a) => empById.has(a.employeeId) && (!q.materialId || a.materialId === q.materialId) && (!q.batchId || a.batchId === q.batchId)),
    (a) => a.createdAt,
    'desc',
  ).slice(0, 2000);
  const rows = list.map((a) => {
    const { p, state } = assignmentState(d, a);
    const m = byId(d.materials, a.materialId);
    const rule = byId(d.rules, a.ruleId);
    const batch = byId(d.batches, a.batchId);
    return {
      id: a.id,
      employee: summarizeEmployee(d, empById.get(a.employeeId)),
      material: m ? { id: m.id, title: m.title, type: m.type } : null,
      reason: a.reason,
      reasonText: a.reasonText,
      note: a.note,
      source: a.source,
      rule: rule ? { id: rule.id, name: rule.name } : null,
      batch: batch ? { id: batch.id, name: batch.name } : null,
      dueDate: a.dueDate,
      createdAt: a.createdAt,
      cancelledAt: a.cancelledAt,
      progress: p ? { progress: p.progress, completedAt: p.completedAt } : null,
      state,
    };
  });
  const counts: Record<string, number> = { NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETED: 0, OVERDUE: 0, CANCELLED: 0 };
  for (const r of rows) counts[r.state] += 1;
  return { counts, rows: q.state ? rows.filter((r) => r.state === q.state) : rows };
});

function assignmentInScope(ctx: Ctx) {
  const a = byId(ctx.db.assignments, ctx.params.id);
  if (!a) throw notFound('Tayinlov topilmadi');
  if (!inScope(getScope(ctx.db, ctx.auth!), a.employeeId)) throw forbidden();
  return a;
}

route('POST', '/learning-admin/assignments/:id/cancel', (ctx) => {
  guard(ctx);
  const a = assignmentInScope(ctx);
  if (a.status === 'CANCELLED') throw badRequest('Tayinlov allaqachon bekor qilingan');
  Object.assign(a, { status: 'CANCELLED', cancelledAt: nowIso(), cancelledByUserId: ctx.auth!.userId });
  return a;
});

route('PATCH', '/learning-admin/assignments/:id', (ctx) => {
  guard(ctx);
  const a = assignmentInScope(ctx);
  if (a.status === 'CANCELLED') throw badRequest("Bekor qilingan tayinlovni o'zgartirib bo'lmaydi");
  Object.assign(a, { dueDate: endOfDayIso(ctx.body?.dueDate), reminderSentAt: null, reminderAfterSentAt: null });
  return a;
});

// --- Tayinlovlar (partiyalar) ----------------------------------------------------

function creatorName(d: DemoDb, userId: string | null) {
  const u = byId(d.users, userId);
  if (!u) return null;
  return byId(d.employees, u.employeeId)?.fullName ?? u.email;
}

route('GET', '/learning-admin/batches', (ctx) => {
  guard(ctx);
  const d = ctx.db;
  const q = ctx.query;
  const scope = getScope(d, ctx.auth!);
  const assignments = d.assignments.filter(
    (a) => a.batchId && inScope(scope, a.employeeId) && (!q.materialId || a.materialId === q.materialId) && (!q.source || a.source === q.source),
  );
  const ids = new Set(assignments.map((a) => a.batchId));
  const s = String(q.search ?? '').trim();
  const batches = sortBy(
    d.batches.filter((b) => ids.has(b.id) && (!s || contains(b.name, s) || contains(byId(d.materials, b.materialId)?.title, s))),
    (b) => b.createdAt,
    'desc',
  );
  const now = Date.now();
  const rows = batches.map((b) => {
    const own = assignments.filter((a) => a.batchId === b.id);
    const live = own.filter((a) => a.status === 'ACTIVE');
    const completed = live.filter((a) => isCompleted(d, a.employeeId, a.materialId)).length;
    const overdue = live.filter((a) => !isCompleted(d, a.employeeId, a.materialId) && a.dueDate && new Date(a.dueDate).getTime() < now).length;
    const state = live.length === 0 ? 'CANCELLED' : completed === live.length ? 'COMPLETED' : overdue > 0 ? 'HAS_OVERDUE' : 'IN_PROGRESS';
    const m = byId(d.materials, b.materialId);
    const rule = byId(d.rules, b.ruleId);
    return {
      id: b.id,
      name: b.name,
      source: b.source,
      material: m ? { id: m.id, title: m.title, type: m.type } : null,
      rule: rule ? { id: rule.id, name: rule.name, status: rule.status } : null,
      reason: b.reason,
      reasonText: b.reasonText,
      dueDate: b.dueDate,
      dueInDays: b.dueInDays,
      audienceSummary: b.audienceSummary,
      createdAt: b.createdAt,
      createdBy: creatorName(d, b.createdByUserId),
      total: live.length,
      completed,
      overdue,
      cancelled: own.length - live.length,
      completionPercent: live.length ? Math.round((completed / live.length) * 100) : 0,
      state,
    };
  });
  const counts: Record<string, number> = { IN_PROGRESS: 0, COMPLETED: 0, HAS_OVERDUE: 0, CANCELLED: 0 };
  for (const r of rows) counts[r.state] += 1;
  return { counts, rows: q.state ? rows.filter((r) => r.state === q.state) : rows };
});

route('GET', '/learning-admin/batches/:id', (ctx) => {
  guard(ctx);
  const d = ctx.db;
  const b = getBatchInScope(d, ctx.auth!, ctx.params.id);
  const m = byId(d.materials, b.materialId);
  const rule = byId(d.rules, b.ruleId);
  return {
    ...b,
    material: m ? { id: m.id, title: m.title, type: m.type, status: m.status } : null,
    rule: rule ? { id: rule.id, name: rule.name, status: rule.status } : null,
    createdBy: creatorName(d, b.createdByUserId),
    canEdit: isLearningAdmin(ctx.auth!.role) || b.createdByUserId === ctx.auth!.userId,
  };
});

function activeUnfinished(ctx: Ctx, batchId: string) {
  const scope = getScope(ctx.db, ctx.auth!);
  return ctx.db.assignments.filter(
    (a) => a.batchId === batchId && a.status === 'ACTIVE' && inScope(scope, a.employeeId) && !isCompleted(ctx.db, a.employeeId, a.materialId),
  );
}

route('PATCH', '/learning-admin/batches/:id', (ctx) => {
  guard(ctx);
  const b = getBatchInScope(ctx.db, ctx.auth!, ctx.params.id, true);
  const body = ctx.body ?? {};
  if (body.name) b.name = String(body.name).trim();
  let updated = 0;
  if (body.dueDate !== undefined) {
    const due = endOfDayIso(body.dueDate);
    const targets = activeUnfinished(ctx, b.id);
    Object.assign(b, { dueDate: due, dueInDays: null });
    for (const a of targets) Object.assign(a, { dueDate: due, reminderSentAt: null, reminderAfterSentAt: null });
    updated = targets.length;
  }
  return { ok: true, updated };
});

route('POST', '/learning-admin/batches/:id/cancel', (ctx) => {
  guard(ctx);
  const b = getBatchInScope(ctx.db, ctx.auth!, ctx.params.id, true);
  if (b.source === 'RULE') throw badRequest("Qoida tayinlovini qoidalar bo'limida to'xtating");
  const targets = activeUnfinished(ctx, b.id);
  for (const a of targets) Object.assign(a, { status: 'CANCELLED', cancelledAt: nowIso(), cancelledByUserId: ctx.auth!.userId });
  return { cancelled: targets.length };
});

// --- Qoidalar ----------------------------------------------------------------------

const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, DRAFT: 1, STOPPED: 2, COMPLETED: 3, ARCHIVED: 4 };

function decorateRules(d: DemoDb, rules: any[]) {
  const nameOf = (list: any[], ids: string[]) => ids.map((id) => byId(list, id)?.name).filter(Boolean);
  return rules.map((r) => {
    const own = d.assignments.filter((a) => a.ruleId === r.id);
    const live = own.filter((a) => a.status === 'ACTIVE');
    const completed = live.filter((a) => isCompleted(d, a.employeeId, a.materialId)).length;
    const materials =
      r.scope === 'LOCAL'
        ? [byId(d.materials, r.materialId)].filter(Boolean).map((m: any) => ({ id: m.id, title: m.title, type: m.type }))
        : d.ruleMaterials
            .filter((x) => x.ruleId === r.id)
            .map((x) => byId(d.materials, x.materialId))
            .filter(Boolean)
            .map((m: any) => ({ id: m.id, title: m.title, type: m.type, status: m.status }));
    const material = byId(d.materials, r.materialId);
    return {
      ...r,
      material: material ? { id: material.id, title: material.title, type: material.type } : null,
      materials,
      audience: {
        allOrganization: r.allOrganization,
        departments: nameOf(d.departments, r.departmentIds),
        positions: nameOf(d.positions, r.positionIds),
        branches: nameOf(d.branches, r.branchIds),
        hiredWithinDays: r.hiredWithinDays,
      },
      activeAssignments: live.length - completed,
      completedAssignments: completed,
      cancelledAssignments: own.filter((a) => a.status === 'CANCELLED').length,
      completionPercent: live.length ? Math.round((completed / live.length) * 100) : 0,
    };
  });
}

function getRule(ctx: Ctx) {
  assertHr(ctx, 'Qoidalarni faqat HR boshqaradi');
  const r = byId(ctx.db.rules, ctx.params.id);
  if (!r) throw notFound('Qoida topilmadi');
  return r;
}

route('GET', '/learning-admin/rules', (ctx) => {
  guard(ctx);
  assertHr(ctx, 'Qoidalarni faqat HR boshqaradi');
  const d = ctx.db;
  for (const r of d.rules) {
    if (r.status === 'ACTIVE' && r.type === 'PERMANENT' && (!r.lastRunAt || Date.now() - new Date(r.lastRunAt).getTime() > DAY)) runRule(d, r.id);
  }
  const scope = ctx.query.scope ?? 'GLOBAL';
  const rules = sortBy(
    d.rules.filter((r) => scope === 'ALL' || r.scope === scope),
    (r) => r.createdAt,
    'desc',
  ).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  return decorateRules(d, rules);
});

route('POST', '/learning-admin/rules/preview', (ctx) => {
  guard(ctx);
  assertHr(ctx, 'Qoidalarni faqat HR boshqaradi');
  const d = ctx.db;
  const input = normalizeRuleBody(ctx.body ?? {});
  validateRuleInput(d, input);
  const criteria = { organizationId: d.organization.id, ...ruleData(input) };
  const audience = resolveRuleAudience(d, criteria, true);
  const codes = new Set(d.employees.map((e) => e.employeeCode));
  const unmatchedCodes = criteria.employeeCodes.filter((c: string) => !codes.has(c));
  const sum = (l: any[]) => l.slice(0, 200).map((e) => summarizeEmployee(d, e));
  if (!input.materialId) {
    return { total: audience.length, toAssignCount: audience.length, skippedActiveCount: 0, skippedCompletedCount: 0, toAssign: sum(audience), skippedActive: [], skippedCompleted: [], unmatchedCodes };
  }
  const split = filterCandidates(d, input.materialId, audience, input.skipIfCompletedWithinDays);
  return {
    total: audience.length,
    toAssignCount: split.toAssign.length,
    skippedActiveCount: split.skippedActive.length,
    skippedCompletedCount: split.skippedCompleted.length,
    toAssign: sum(split.toAssign),
    skippedActive: sum(split.skippedActive),
    skippedCompleted: sum(split.skippedCompleted),
    unmatchedCodes,
  };
});

route(
  'POST',
  '/learning-admin/rules',
  (ctx) => {
    guard(ctx);
    const activate = String(ctx.query.activate ?? '1') === '1';
    return createRule(ctx.db, ctx.auth!, normalizeRuleBody(ctx.body ?? {}), activate);
  },
  { status: 201 },
);

route('GET', '/learning-admin/rules/:id', (ctx) => {
  guard(ctx);
  const d = ctx.db;
  const r = getRule(ctx);
  const materials =
    r.scope === 'LOCAL'
      ? [byId(d.materials, r.materialId)].filter(Boolean)
      : d.ruleMaterials.filter((x) => x.ruleId === r.id).map((x) => byId(d.materials, x.materialId)).filter(Boolean);
  return { ...r, materials: materials.map((m: any) => ({ id: m.id, title: m.title, type: m.type, status: m.status })) };
});

route('PUT', '/learning-admin/rules/:id', (ctx) => {
  guard(ctx);
  const d = ctx.db;
  const r = getRule(ctx);
  if (r.status !== 'DRAFT' && r.status !== 'STOPPED') throw badRequest("Faqat qoralama yoki to'xtatilgan qoidani tahrirlash mumkin — avval to'xtating");
  const input = normalizeRuleBody(ctx.body ?? {});
  validateRuleInput(d, { ...input, materialId: r.materialId });
  const data = ruleData(input);
  for (const b of d.batches.filter((x) => x.ruleId === r.id)) {
    Object.assign(b, { name: data.name, reason: data.reason, reasonText: data.reasonText, note: data.note, dueDate: data.dueDate, dueInDays: data.dueInDays });
  }
  Object.assign(r, data, { updatedAt: nowIso() });
  return r;
});

route('POST', '/learning-admin/rules/:id/run', (ctx) => {
  guard(ctx);
  const r = getRule(ctx);
  if (r.status !== 'ACTIVE') throw badRequest('Qoida faol emas — avval faollashtiring');
  return runRule(ctx.db, r.id);
});

route('POST', '/learning-admin/rules/:id/activate', (ctx) => {
  guard(ctx);
  const r = getRule(ctx);
  if (r.status !== 'DRAFT' && r.status !== 'STOPPED') throw badRequest('Bu holatdagi qoidani faollashtirib bo‘lmaydi');
  validateRuleInput(ctx.db, r);
  r.status = 'ACTIVE';
  return runRule(ctx.db, r.id);
});

route('POST', '/learning-admin/rules/:id/stop', (ctx) => {
  guard(ctx);
  const r = getRule(ctx);
  if (r.status !== 'ACTIVE') throw badRequest('Faqat faol qoidani to‘xtatish mumkin');
  const cancelled = ctx.body?.cancelAssignments ? cancelRuleAssignments(ctx.db, r.id, ctx.auth!.userId) : 0;
  r.status = 'STOPPED';
  return { cancelled };
});

route('POST', '/learning-admin/rules/:id/archive', (ctx) => {
  guard(ctx);
  const r = getRule(ctx);
  if (r.status === 'ARCHIVED') throw badRequest('Qoida allaqachon arxivda');
  const cancelled = ctx.body?.cancelAssignments ? cancelRuleAssignments(ctx.db, r.id, ctx.auth!.userId) : 0;
  r.status = 'ARCHIVED';
  return { cancelled };
});

route(
  'POST',
  '/learning-admin/rules/:id/copy',
  (ctx) => {
    guard(ctx);
    const r = getRule(ctx);
    const now = nowIso();
    const copy = { ...r, id: newId(), name: `${r.name} (nusxa)`, status: 'DRAFT', createdByUserId: ctx.auth!.userId, lastRunAt: null, createdAt: now, updatedAt: now };
    ctx.db.rules.push(copy);
    return copy;
  },
  { status: 201 },
);

// --- Katalog --------------------------------------------------------------------

const normalizeTags = (tags?: string[]) => [...new Set((tags ?? []).map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))].slice(0, 10);

function assertPublishable(s: any) {
  if (s.availableFrom && s.availableUntil && s.availableFrom > s.availableUntil) throw badRequest("Ko'rinish sanalari noto'g'ri: boshlanishi tugashidan keyin");
  if (s.status !== 'PUBLISHED') return;
  if (s.contentSource === 'LINK' && !s.contentUrl) throw badRequest('Nashr qilish uchun kontent havolasini kiriting');
  if (s.contentSource === 'FILE' && !s.contentFileId) throw badRequest('Nashr qilish uchun kontent faylini yuklang');
  if (s.visibility === 'AUDIENCE' && s.audienceSize === 0) throw badRequest("'Faqat tanlanganlarga' uchun kamida bitta bo'lim, lavozim yoki filial tanlang");
}

const SETTINGS_KEYS = ['contentSource', 'contentFileId', 'displayMode', 'completionRule', 'level', 'language', 'allowDownload', 'visibility', 'visibleDepartmentIds', 'visiblePositionIds', 'visibleBranchIds'];

function normalizeMaterialInput(b: any) {
  const out: any = {};
  for (const k of SETTINGS_KEYS) if (b[k] !== undefined) out[k] = k === 'contentFileId' || k === 'language' ? b[k] || null : b[k];
  if (b.availableFrom !== undefined) out.availableFrom = startOfDayIso(b.availableFrom);
  if (b.availableUntil !== undefined) out.availableUntil = startOfDayIso(b.availableUntil);
  if (b.title !== undefined) out.title = String(b.title).trim();
  if (b.description !== undefined) out.description = String(b.description ?? '').trim() || null;
  if (b.type !== undefined) out.type = b.type;
  if (b.coverUrl !== undefined) out.coverUrl = b.coverUrl || null;
  if (b.contentUrl !== undefined) {
    const url = String(b.contentUrl ?? '').trim();
    if (url && !/^https?:\/\/\S+$/.test(url)) throw badRequest("Havola noto'g'ri — https:// bilan boshlang");
    out.contentUrl = url || null;
  }
  if (b.durationMinutes !== undefined) out.durationMinutes = Number(b.durationMinutes) || 0;
  if (b.author !== undefined) out.author = String(b.author ?? '').trim() || null;
  if (b.tags !== undefined) out.tags = normalizeTags(b.tags);
  if (b.requiresApproval !== undefined) out.requiresApproval = Boolean(b.requiresApproval);
  if (b.status !== undefined) out.status = b.status;
  return out;
}

function syncAttachedRules(ctx: Ctx, materialId: string, ruleIds: string[]) {
  const d = ctx.db;
  const wanted = new Set(d.rules.filter((r) => ruleIds.includes(r.id) && r.scope === 'GLOBAL' && r.status !== 'ARCHIVED').map((r) => r.id));
  const current = new Set(d.ruleMaterials.filter((x) => x.materialId === materialId).map((x) => x.ruleId));
  const toAdd = [...wanted].filter((id) => !current.has(id));
  d.ruleMaterials = d.ruleMaterials.filter((x) => x.materialId !== materialId || wanted.has(x.ruleId));
  for (const ruleId of toAdd) d.ruleMaterials.push({ id: newId(), organizationId: d.organization.id, ruleId, materialId, attachedByUserId: ctx.auth!.userId, createdAt: nowIso() });
  return toAdd;
}

function runMaterialAssignment(ctx: Ctx, material: any, s: any) {
  const audience = s.sameAsVisibility
    ? material.visibility === 'ALL'
      ? { allOrganization: true }
      : material.visibility === 'AUDIENCE'
        ? { departmentIds: material.visibleDepartmentIds, positionIds: material.visiblePositionIds, branchIds: material.visibleBranchIds }
        : null
    : { allOrganization: s.allOrganization, departmentIds: s.departmentIds ?? [], positionIds: s.positionIds ?? [], branchIds: s.branchIds ?? [] };
  if (!audience) return { ok: false, message: 'Yashirin material uchun tayinlash auditoriyasini alohida tanlang' };
  const dueDate = s.mode === 'ONE_TIME' && s.dueDate ? endOfDayIso(s.dueDate) : null;
  try {
    if (s.mode === 'PERMANENT') {
      const result = createRule(ctx.db, ctx.auth!, {
        name: `${material.title} — avtomatik tayinlash`,
        materialId: material.id,
        type: 'PERMANENT',
        ...audience,
        reason: s.reason,
        reasonText: s.reasonText,
        dueInDays: s.dueInDays ?? null,
        skipIfCompletedWithinDays: s.skipIfCompletedWithinDays ?? null,
        cancelOutOfScope: true,
      });
      return { ok: true, message: `Doimiy qoida yaratildi, ${result.assigned} ta xodimga tayinlandi` };
    }
    const result = createAssignments(ctx.db, ctx.auth!, {
      materialId: material.id,
      audience,
      reason: s.reason,
      reasonText: s.reasonText ?? undefined,
      dueDate: dueDate ?? undefined,
      dueInDays: dueDate ? undefined : s.dueInDays ?? undefined,
      skipIfCompletedWithinDays: s.skipIfCompletedWithinDays ?? undefined,
    });
    return { ok: true, message: `${result.assignedCount} ta xodimga tayinlandi` };
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Tayinlab bo'lmadi" };
  }
}

route('GET', '/learning-admin/catalog', (ctx) => {
  guard(ctx);
  assertHr(ctx, 'Katalogni faqat HR boshqaradi');
  const d = ctx.db;
  const q = ctx.query;
  const s = String(q.search ?? '').trim();
  const list = sortBy(
    d.materials.filter(
      (m) => (!q.type || m.type === q.type) && (!q.status || m.status === q.status) && (!s || contains(m.title, s) || contains(m.author, s) || m.tags.includes(s.toLowerCase())),
    ),
    (m) => m.updatedAt,
    'desc',
  );
  const count = (st: string) => d.materials.filter((m) => m.status === st).length;
  return {
    counts: { DRAFT: count('DRAFT'), PUBLISHED: count('PUBLISHED'), ARCHIVED: count('ARCHIVED') },
    rows: list.map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      coverUrl: m.coverUrl,
      durationMinutes: m.durationMinutes,
      author: m.author,
      tags: m.tags,
      status: m.status,
      requiresApproval: m.requiresApproval,
      publishedAt: m.publishedAt,
      updatedAt: m.updatedAt,
      visibility: m.visibility,
      contentSource: m.contentSource,
      activeAssignments: d.assignments.filter((a) => a.materialId === m.id && a.status === 'ACTIVE').length,
      completions: d.progress.filter((p) => p.materialId === m.id && p.status === 'COMPLETED').length,
    })),
  };
});

function materialRow(ctx: Ctx, id: string) {
  assertHr(ctx, 'Katalogni faqat HR boshqaradi');
  const m = byId(ctx.db.materials, id);
  if (!m) throw notFound('Material topilmadi');
  return m;
}

route('GET', '/learning-admin/catalog/:id', (ctx) => {
  guard(ctx);
  const d = ctx.db;
  const m = materialRow(ctx, ctx.params.id);
  const file = byId(d.files, m.contentFileId);
  return {
    ...m,
    contentFile: file ? { id: file.id, fileName: file.fileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes, url: `/files/${file.id}` } : null,
    activeAssignments: d.assignments.filter((a) => a.materialId === m.id && a.status === 'ACTIVE').length,
    activeRules: rulesForMaterial(d, m.id, ['ACTIVE']).length,
    attachedRuleIds: d.ruleMaterials.filter((x) => x.materialId === m.id).map((x) => x.ruleId),
  };
});

route(
  'POST',
  '/learning-admin/catalog',
  (ctx) => {
    guard(ctx);
    assertHr(ctx, 'Katalogni faqat HR boshqaradi');
    const d = ctx.db;
    const b = ctx.body ?? {};
    if (!String(b.title ?? '').trim()) throw badRequest('Nomini kiriting');
    const input = normalizeMaterialInput(b);
    const status = input.status ?? 'DRAFT';
    const merged = {
      contentSource: 'LINK',
      contentFileId: null,
      displayMode: 'NEW_TAB',
      completionRule: 'MANUAL',
      level: null,
      language: null,
      allowDownload: true,
      visibility: 'ALL',
      visibleDepartmentIds: [],
      visiblePositionIds: [],
      visibleBranchIds: [],
      availableFrom: null,
      availableUntil: null,
      description: null,
      coverUrl: null,
      contentUrl: null,
      durationMinutes: 0,
      author: null,
      tags: [],
      requiresApproval: false,
      ...input,
      status,
    };
    assertPublishable({ ...merged, audienceSize: merged.visibleDepartmentIds.length + merged.visiblePositionIds.length + merged.visibleBranchIds.length });
    const now = nowIso();
    const created = {
      id: newId(),
      organizationId: d.organization.id,
      createdByUserId: ctx.auth!.userId,
      ...merged,
      pendingAssignment: status === 'DRAFT' && b.assignment ? b.assignment : null,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    d.materials.push(created);
    if (b.attachedRuleIds?.length) syncAttachedRules(ctx, created.id, b.attachedRuleIds);
    const assignmentResult = status === 'PUBLISHED' && b.assignment ? runMaterialAssignment(ctx, created, b.assignment) : null;
    const rulesAssigned = status === 'PUBLISHED' ? runRulesForMaterial(d, created.id).assigned : 0;
    return { ...created, assignmentResult, rulesAssigned };
  },
  { status: 201 },
);

route('PATCH', '/learning-admin/catalog/:id', (ctx) => {
  guard(ctx);
  const d = ctx.db;
  const existing = materialRow(ctx, ctx.params.id);
  const b = ctx.body ?? {};
  const input = normalizeMaterialInput(b);
  const next = { ...existing, ...input };
  assertPublishable({ ...next, audienceSize: next.visibleDepartmentIds.length + next.visiblePositionIds.length + next.visibleBranchIds.length });

  const prevStatus = existing.status;
  const nextStatus = next.status;
  if (input.status === 'PUBLISHED' && prevStatus === 'DRAFT') input.publishedAt = nowIso();
  const settings = b.assignment !== undefined ? b.assignment : existing.pendingAssignment ?? null;
  const runNow = nextStatus === 'PUBLISHED' && settings !== null && (b.assignment != null || prevStatus !== 'PUBLISHED');
  if (nextStatus === 'DRAFT' && b.assignment !== undefined) input.pendingAssignment = b.assignment ?? null;
  if (runNow) input.pendingAssignment = null;
  Object.assign(existing, input, { updatedAt: nowIso() });

  let cancelledAssignments = 0;
  if (nextStatus === 'ARCHIVED' && prevStatus !== 'ARCHIVED' && b.cancelActiveAssignments) {
    for (const a of d.assignments) {
      if (a.materialId === existing.id && a.status === 'ACTIVE') {
        Object.assign(a, { status: 'CANCELLED', cancelledAt: nowIso(), cancelledByUserId: ctx.auth!.userId });
        cancelledAssignments += 1;
      }
    }
    for (const r of d.rules) if (r.materialId === existing.id && r.scope === 'LOCAL' && r.status === 'ACTIVE') r.status = 'STOPPED';
    d.ruleMaterials = d.ruleMaterials.filter((x) => x.materialId !== existing.id);
  }
  const newlyAttached = b.attachedRuleIds ? syncAttachedRules(ctx, existing.id, b.attachedRuleIds) : [];
  const assignmentResult = runNow && settings ? runMaterialAssignment(ctx, existing, settings) : null;
  let rulesAssigned = 0;
  if (nextStatus === 'PUBLISHED' && (prevStatus !== 'PUBLISHED' || newlyAttached.length > 0)) rulesAssigned = runRulesForMaterial(d, existing.id).assigned;
  return { ...existing, assignmentResult, cancelledAssignments, rulesAssigned };
});

route('GET', '/learning-admin/catalog/:id/rules', (ctx) => {
  guard(ctx);
  materialRow(ctx, ctx.params.id);
  const d = ctx.db;
  return decorateRules(
    d,
    sortBy(
      rulesForMaterial(d, ctx.params.id).filter((r) => r.status !== 'ARCHIVED'),
      (r) => r.createdAt,
      'desc',
    ),
  );
});

route('POST', '/learning-admin/catalog/:id/rules/:ruleId', (ctx) => {
  guard(ctx);
  const d = ctx.db;
  materialRow(ctx, ctx.params.id);
  const r = byId(d.rules, ctx.params.ruleId);
  if (!r) throw notFound('Qoida topilmadi');
  if (r.scope !== 'GLOBAL') throw badRequest('Faqat global qoidani biriktirish mumkin');
  if (r.status === 'ARCHIVED') throw badRequest('Arxivdagi qoidani biriktirib bo‘lmaydi');
  if (!d.ruleMaterials.some((x) => x.ruleId === r.id && x.materialId === ctx.params.id)) {
    d.ruleMaterials.push({ id: newId(), organizationId: d.organization.id, ruleId: r.id, materialId: ctx.params.id, attachedByUserId: ctx.auth!.userId, createdAt: nowIso() });
  }
  return runRule(d, r.id, undefined, ctx.params.id);
});

route('DELETE', '/learning-admin/catalog/:id/rules/:ruleId', (ctx) => {
  guard(ctx);
  const d = ctx.db;
  materialRow(ctx, ctx.params.id);
  const r = byId(d.rules, ctx.params.ruleId);
  if (!r) throw notFound('Qoida topilmadi');
  d.ruleMaterials = d.ruleMaterials.filter((x) => !(x.ruleId === r.id && x.materialId === ctx.params.id));
  const cancelled = String(ctx.query.cancelAssignments ?? '0') === '1' ? cancelRuleAssignments(d, r.id, ctx.auth!.userId, ctx.params.id) : 0;
  return { cancelled };
});
