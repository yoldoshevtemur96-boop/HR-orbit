// Demo API: xodimning o'quv kabineti (/learning/*).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { badRequest, byId, contains, forbidden, notFound, notify, route, selfEmployee, sortBy, type Ctx } from '../core';
import { newId, nowIso, type DemoDb } from '../store';
import { sendDueReminders, syncRulesForEmployee } from '../learningEngine';

const LIST_FIELDS = ['id', 'title', 'description', 'type', 'coverUrl', 'durationMinutes', 'author', 'tags', 'requiresApproval', 'publishedAt'];
const pickList = (m: any) => Object.fromEntries(LIST_FIELDS.map((k) => [k, m[k]]));

function isVisible(d: DemoDb, m: any, emp: any) {
  if (m.status !== 'PUBLISHED') return false;
  if (d.assignments.some((a) => a.materialId === m.id && a.employeeId === emp.id && a.status === 'ACTIVE')) return true;
  const now = Date.now();
  if (m.availableFrom && new Date(m.availableFrom).getTime() > now) return false;
  if (m.availableUntil && new Date(m.availableUntil).getTime() < now) return false;
  if (m.visibility === 'ALL') return true;
  if (m.visibility === 'AUDIENCE') {
    return (
      (emp.departmentId && m.visibleDepartmentIds.includes(emp.departmentId)) ||
      (emp.positionId && m.visiblePositionIds.includes(emp.positionId)) ||
      (emp.branchId && m.visibleBranchIds.includes(emp.branchId))
    );
  }
  return false;
}

function decorate(d: DemoDb, employeeId: string, materials: any[]) {
  return materials.map((m) => {
    const p = d.progress.find((x) => x.employeeId === employeeId && x.materialId === m.id);
    const a = d.assignments.find((x) => x.employeeId === employeeId && x.materialId === m.id && x.status === 'ACTIVE');
    return {
      ...pickList(m),
      isFavorite: d.favorites.some((f) => f.employeeId === employeeId && f.materialId === m.id),
      myProgress: p ? { progress: p.progress, status: p.status, lastOpenedAt: p.lastOpenedAt, completedAt: p.completedAt } : null,
      assignment: a ? { dueDate: a.dueDate, note: a.note, reason: a.reason, reasonText: a.reasonText, createdAt: a.createdAt } : null,
    };
  });
}

function visibleMaterial(ctx: Ctx, id: string) {
  const emp = selfEmployee(ctx);
  const m = byId(ctx.db.materials, id);
  if (!m || !isVisible(ctx.db, m, emp)) throw notFound('Material topilmadi');
  return { emp, m };
}

function hasAccess(d: DemoDb, emp: any, m: any) {
  if (!m.requiresApproval) return true;
  return (
    d.assignments.some((a) => a.employeeId === emp.id && a.materialId === m.id && a.status === 'ACTIVE') ||
    d.requests.some((r) => r.employeeId === emp.id && r.materialId === m.id && r.status === 'APPROVED') ||
    d.progress.some((p) => p.employeeId === emp.id && p.materialId === m.id)
  );
}

route('GET', '/learning/summary', (ctx) => {
  const d = ctx.db;
  const emp = selfEmployee(ctx);
  syncRulesForEmployee(d, emp.id);
  sendDueReminders(d, emp.id, ctx.auth!.userId);
  const published = new Set(d.materials.filter((m) => m.status === 'PUBLISHED').map((m) => m.id));
  return {
    favorites: d.favorites.filter((f) => f.employeeId === emp.id && published.has(f.materialId)).length,
    pendingRequests: d.requests.filter((r) => r.employeeId === emp.id && r.status === 'PENDING').length,
    activeGoals: d.goals.filter((g) => g.employeeId === emp.id && g.status === 'ACTIVE').length,
    upcomingEvents: d.events.filter((e) => e.status === 'PUBLISHED' && new Date(e.endsAt).getTime() >= Date.now()).length,
    inProgress: d.progress.filter((p) => p.employeeId === emp.id && p.status === 'IN_PROGRESS').length,
    assigned: d.assignments.filter((a) => a.employeeId === emp.id && a.status === 'ACTIVE').length,
    recommended: new Set(d.recommendations.filter((r) => r.toEmployeeId === emp.id && !r.dismissedAt && published.has(r.materialId)).map((r) => r.materialId)).size,
  };
});

route('GET', '/learning/materials', (ctx) => {
  const d = ctx.db;
  const emp = selfEmployee(ctx);
  let list = d.materials.filter((m) => isVisible(d, m, emp));
  if (ctx.query.type) list = list.filter((m) => m.type === ctx.query.type);
  const s = String(ctx.query.search ?? '').trim();
  if (s) list = list.filter((m) => contains(m.title, s) || contains(m.description, s) || contains(m.author, s) || m.tags.includes(s.toLowerCase()));
  list = sortBy(list, (m) => m.publishedAt, 'desc').slice(0, Number(ctx.query.limit ?? 100));
  return decorate(d, emp.id, list);
});

route('GET', '/learning/materials/:id', (ctx) => {
  const d = ctx.db;
  const { emp, m } = visibleMaterial(ctx, ctx.params.id);
  const [decorated] = decorate(d, emp.id, [m]);
  const request =
    sortBy(
      d.requests.filter((r) => r.employeeId === emp.id && r.materialId === m.id && ['PENDING', 'APPROVED'].includes(r.status)),
      (r) => r.createdAt,
      'desc',
    ).map((r) => ({ id: r.id, status: r.status }))[0] ?? null;
  const access = hasAccess(d, emp, m);
  const file = m.contentSource === 'FILE' && m.contentFileId ? byId(d.files, m.contentFileId) : null;
  return {
    ...decorated,
    contentSource: m.contentSource,
    displayMode: m.displayMode,
    completionRule: m.completionRule,
    allowDownload: m.allowDownload,
    level: m.level,
    language: m.language,
    contentUrl: !access ? null : file ? `/files/${file.id}` : m.contentUrl,
    downloadUrl: access && file && m.allowDownload ? `/files/${file.id}?download=1` : null,
    contentFile: access && file ? { fileName: file.fileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes } : null,
    hasAccess: access,
    request,
  };
});

function assertAccess(ctx: Ctx, id: string) {
  const { emp, m } = visibleMaterial(ctx, id);
  if (!hasAccess(ctx.db, emp, m)) throw forbidden("Bu material uchun avval rahbar tasdig'i kerak — so'rov yuboring");
  return { emp, m };
}

route('POST', '/learning/materials/:id/start', (ctx) => {
  const d = ctx.db;
  const { emp, m } = assertAccess(ctx, ctx.params.id);
  const now = nowIso();
  let p = d.progress.find((x) => x.employeeId === emp.id && x.materialId === m.id);
  if (!p) {
    p = { id: newId(), organizationId: d.organization.id, employeeId: emp.id, materialId: m.id, progress: 0, status: 'IN_PROGRESS', startedAt: now, lastOpenedAt: now, completedAt: null };
    d.progress.push(p);
  }
  p.lastOpenedAt = now;
  if (m.completionRule === 'ON_OPEN') Object.assign(p, { progress: 100, status: 'COMPLETED', completedAt: now });
  return { progress: p, contentUrl: m.contentSource === 'FILE' && m.contentFileId ? `/files/${m.contentFileId}` : m.contentUrl };
});

route('PUT', '/learning/materials/:id/progress', (ctx) => {
  const d = ctx.db;
  const { emp, m } = assertAccess(ctx, ctx.params.id);
  const value = Math.min(100, Math.max(0, Number(ctx.body?.progress ?? 0)));
  const now = nowIso();
  let p = d.progress.find((x) => x.employeeId === emp.id && x.materialId === m.id);
  if (p?.status === 'COMPLETED') {
    p.lastOpenedAt = now;
    return p;
  }
  const next = Math.min(100, Math.max(p?.progress ?? 0, value));
  const completed = next >= 100;
  const data = { progress: next, status: completed ? 'COMPLETED' : 'IN_PROGRESS', completedAt: completed ? now : null, lastOpenedAt: now };
  if (!p) {
    p = { id: newId(), organizationId: d.organization.id, employeeId: emp.id, materialId: m.id, startedAt: now, ...data };
    d.progress.push(p);
  } else Object.assign(p, data);
  return p;
});

function setFavorite(ctx: Ctx, on: boolean) {
  const d = ctx.db;
  const emp = selfEmployee(ctx);
  const m = d.materials.find((x) => x.id === ctx.params.id && x.status === 'PUBLISHED');
  if (!m) throw notFound('Material topilmadi');
  const exists = d.favorites.some((f) => f.employeeId === emp.id && f.materialId === m.id);
  if (on && !exists) d.favorites.push({ id: newId(), organizationId: d.organization.id, employeeId: emp.id, materialId: m.id, createdAt: nowIso() });
  if (!on) d.favorites = d.favorites.filter((f) => !(f.employeeId === emp.id && f.materialId === m.id));
  return { materialId: m.id, isFavorite: on };
}
route('PUT', '/learning/materials/:id/favorite', (ctx) => setFavorite(ctx, true));
route('DELETE', '/learning/materials/:id/favorite', (ctx) => setFavorite(ctx, false));

route('GET', '/learning/my/progress', (ctx) => {
  const d = ctx.db;
  const emp = selfEmployee(ctx);
  const status = ctx.query.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS';
  const rows = sortBy(
    d.progress.filter((p) => p.employeeId === emp.id && p.status === status),
    (p) => (status === 'COMPLETED' ? p.completedAt : p.lastOpenedAt),
    'desc',
  );
  const materials = rows.map((p) => byId(d.materials, p.materialId)).filter((m) => m && m.status === 'PUBLISHED');
  return decorate(d, emp.id, materials);
});

route('GET', '/learning/my/assignments', (ctx) => {
  const d = ctx.db;
  const emp = selfEmployee(ctx);
  const rows = d.assignments.filter((a) => a.employeeId === emp.id && a.status === 'ACTIVE');
  rows.sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  const materials = rows.map((a) => byId(d.materials, a.materialId)).filter((m) => m && m.status === 'PUBLISHED');
  return decorate(d, emp.id, materials);
});

route('GET', '/learning/my/favorites', (ctx) => {
  const d = ctx.db;
  const emp = selfEmployee(ctx);
  const rows = sortBy(
    d.favorites.filter((f) => f.employeeId === emp.id),
    (f) => f.createdAt,
    'desc',
  );
  const materials = rows.map((f) => byId(d.materials, f.materialId)).filter((m) => m && m.status === 'PUBLISHED');
  return decorate(d, emp.id, materials);
});

// --- Hamkasblar va tavsiyalar ----------------------------------------------------

route('GET', '/learning/colleagues', (ctx) => {
  const d = ctx.db;
  const emp = selfEmployee(ctx);
  const s = String(ctx.query.search ?? '').trim();
  return sortBy(
    d.employees.filter(
      (e) => e.id !== emp.id && ['ACTIVE', 'PROBATION', 'ON_LEAVE'].includes(e.status) && (!s || contains(e.fullName, s) || contains(e.employeeCode, s)),
    ),
    (e) => e.fullName,
  )
    .slice(0, 50)
    .map((e) => ({ id: e.id, fullName: e.fullName, department: byId(d.departments, e.departmentId)?.name ?? null, position: byId(d.positions, e.positionId)?.name ?? null }));
});

route(
  'POST',
  '/learning/materials/:id/recommend',
  (ctx) => {
    const d = ctx.db;
    const emp = selfEmployee(ctx);
    const m = d.materials.find((x) => x.id === ctx.params.id && x.status === 'PUBLISHED');
    if (!m) throw notFound('Material topilmadi');
    const ids: string[] = ctx.body?.employeeIds ?? [];
    const recipients = d.employees.filter((e) => ids.includes(e.id) && e.id !== emp.id && ['ACTIVE', 'PROBATION', 'ON_LEAVE'].includes(e.status));
    if (recipients.length === 0) throw badRequest('Kamida bitta hamkasbni tanlang');
    const comment = String(ctx.body?.comment ?? '').trim() || null;
    const now = nowIso();
    for (const r of recipients) {
      const existing = d.recommendations.find((x) => x.fromEmployeeId === emp.id && x.toEmployeeId === r.id && x.materialId === m.id);
      if (existing) Object.assign(existing, { comment, dismissedAt: null, updatedAt: now });
      else d.recommendations.push({ id: newId(), organizationId: d.organization.id, fromEmployeeId: emp.id, toEmployeeId: r.id, materialId: m.id, comment, dismissedAt: null, createdAt: now, updatedAt: now });
      notify(d, r.userId, 'LEARNING_RECOMMENDED', `${emp.fullName} sizga "${m.title}" materialini tavsiya qildi`, 'LearningMaterial', m.id);
    }
    return { recommendedCount: recipients.length };
  },
  { status: 201 },
);

route('GET', '/learning/my/recommendations', (ctx) => {
  const d = ctx.db;
  const emp = selfEmployee(ctx);
  const recs = sortBy(
    d.recommendations.filter((r) => r.toEmployeeId === emp.id && !r.dismissedAt),
    (r) => r.updatedAt,
    'desc',
  );
  const byMaterial = new Map<string, { material: any; recommendedBy: any[] }>();
  for (const r of recs) {
    const m = byId(d.materials, r.materialId);
    if (!m || !isVisible(d, m, emp)) continue;
    const entry = byMaterial.get(m.id) ?? { material: m, recommendedBy: [] };
    entry.recommendedBy.push({ fullName: byId(d.employees, r.fromEmployeeId)?.fullName ?? '—', comment: r.comment, createdAt: r.updatedAt });
    byMaterial.set(m.id, entry);
  }
  const entries = [...byMaterial.values()];
  return decorate(d, emp.id, entries.map((e) => e.material)).map((m, i) => ({ ...m, recommendedBy: entries[i].recommendedBy }));
});

route('DELETE', '/learning/my/recommendations/:materialId', (ctx) => {
  const emp = selfEmployee(ctx);
  let dismissed = 0;
  for (const r of ctx.db.recommendations) {
    if (r.toEmployeeId === emp.id && r.materialId === ctx.params.materialId && !r.dismissedAt) {
      r.dismissedAt = nowIso();
      dismissed += 1;
    }
  }
  return { dismissed };
});

// --- Tadbirlar --------------------------------------------------------------------

route('GET', '/learning/events', (ctx) => {
  const d = ctx.db;
  const emp = selfEmployee(ctx);
  const scope = ctx.query.scope ?? 'upcoming';
  const now = Date.now();
  let list = d.events.filter((e) => e.status === 'PUBLISHED');
  if (scope === 'upcoming') list = list.filter((e) => new Date(e.endsAt).getTime() >= now);
  if (scope === 'past') list = list.filter((e) => new Date(e.endsAt).getTime() < now);
  if (scope === 'mine') list = list.filter((e) => d.registrations.some((r) => r.eventId === e.id && r.employeeId === emp.id && ['REGISTERED', 'ATTENDED'].includes(r.status)));
  list = sortBy(list, (e) => e.startsAt, scope === 'upcoming' ? 'asc' : 'desc');
  return list.map((e) => {
    const regs = d.registrations.filter((r) => r.eventId === e.id && ['REGISTERED', 'ATTENDED'].includes(r.status));
    const mine = regs.find((r) => r.employeeId === emp.id);
    const req = d.requests.find((r) => r.eventId === e.id && r.employeeId === emp.id && ['PENDING', 'APPROVED'].includes(r.status));
    return { ...e, registeredCount: regs.length, myRegistration: mine ? { status: mine.status } : null, myRequest: req ? { id: req.id, status: req.status } : null };
  });
});

route(
  'POST',
  '/learning/events/:id/register',
  (ctx) => {
    const d = ctx.db;
    const emp = selfEmployee(ctx);
    const ev = d.events.find((e) => e.id === ctx.params.id && e.status === 'PUBLISHED');
    if (!ev) throw notFound('Tadbir topilmadi');
    if (new Date(ev.endsAt).getTime() < Date.now()) throw badRequest("Tadbir allaqachon o'tib ketgan");
    if (ev.requiresApproval && !d.requests.some((r) => r.employeeId === emp.id && r.eventId === ev.id && r.status === 'APPROVED')) {
      throw forbidden("Bu tadbir uchun avval rahbar tasdig'i kerak — so'rov yuboring");
    }
    if (ev.capacity !== null) {
      const taken = d.registrations.filter((r) => r.eventId === ev.id && r.employeeId !== emp.id && ['REGISTERED', 'ATTENDED'].includes(r.status)).length;
      if (taken >= ev.capacity) throw badRequest("Bo'sh o'rin qolmagan");
    }
    let reg = d.registrations.find((r) => r.eventId === ev.id && r.employeeId === emp.id);
    if (reg) reg.status = 'REGISTERED';
    else {
      reg = { id: newId(), organizationId: d.organization.id, eventId: ev.id, employeeId: emp.id, status: 'REGISTERED', createdAt: nowIso() };
      d.registrations.push(reg);
    }
    return reg;
  },
  { status: 201 },
);

route('DELETE', '/learning/events/:id/register', (ctx) => {
  const emp = selfEmployee(ctx);
  const reg = ctx.db.registrations.find((r) => r.eventId === ctx.params.id && r.employeeId === emp.id);
  if (!reg) throw notFound('Siz bu tadbirga yozilmagansiz');
  reg.status = 'CANCELLED';
  return reg;
});

// --- So'rovlar --------------------------------------------------------------------

route('GET', '/learning/my/requests', (ctx) => {
  const d = ctx.db;
  const emp = selfEmployee(ctx);
  return sortBy(
    d.requests.filter((r) => r.employeeId === emp.id),
    (r) => r.createdAt,
    'desc',
  ).map((r) => {
    const m = byId(d.materials, r.materialId);
    const e = byId(d.events, r.eventId);
    return { ...r, material: m ? { id: m.id, title: m.title, type: m.type } : null, event: e ? { id: e.id, title: e.title, startsAt: e.startsAt } : null };
  });
});

route(
  'POST',
  '/learning/requests',
  (ctx) => {
    const d = ctx.db;
    const emp = selfEmployee(ctx);
    const b = ctx.body ?? {};
    let title = String(b.title ?? '').trim();
    if (b.materialId) {
      const m = d.materials.find((x) => x.id === b.materialId && x.status === 'PUBLISHED');
      if (!m) throw notFound('Material topilmadi');
      title = m.title;
    } else if (b.eventId) {
      const e = d.events.find((x) => x.id === b.eventId && x.status === 'PUBLISHED');
      if (!e) throw notFound('Tadbir topilmadi');
      title = e.title;
    } else if (!title) throw badRequest("So'rov nomini kiriting");
    if (b.externalUrl && !/^https?:\/\/\S+$/.test(String(b.externalUrl).trim())) throw badRequest("Havola noto'g'ri");
    if (
      (b.materialId || b.eventId) &&
      d.requests.some(
        (r) => r.employeeId === emp.id && (b.materialId ? r.materialId === b.materialId : r.eventId === b.eventId) && ['PENDING', 'APPROVED'].includes(r.status),
      )
    ) {
      throw badRequest("Bu bo'yicha so'rov allaqachon yuborilgan");
    }
    const row = {
      id: newId(),
      organizationId: d.organization.id,
      employeeId: emp.id,
      materialId: b.materialId ?? null,
      eventId: b.eventId ?? null,
      title,
      externalUrl: String(b.externalUrl ?? '').trim() || null,
      comment: String(b.comment ?? '').trim() || null,
      status: 'PENDING',
      decisionComment: null,
      decidedAt: null,
      createdAt: nowIso(),
    };
    d.requests.push(row);
    return row;
  },
  { status: 201 },
);

route('POST', '/learning/requests/:id/cancel', (ctx) => {
  const emp = selfEmployee(ctx);
  const r = ctx.db.requests.find((x) => x.id === ctx.params.id && x.employeeId === emp.id);
  if (!r) throw notFound("So'rov topilmadi");
  if (r.status !== 'PENDING') throw badRequest("Faqat ko'rib chiqilmagan so'rovni bekor qilish mumkin");
  r.status = 'CANCELLED';
  return r;
});

// --- Rivojlanish maqsadlari -------------------------------------------------------

function publishedIds(d: DemoDb, ids: string[] = []) {
  return ids.filter((id) => d.materials.some((m) => m.id === id && m.status === 'PUBLISHED'));
}
const dateOnly = (v: any) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00.000Z`).toISOString() : null);

route('GET', '/learning/my/goals', (ctx) => {
  const d = ctx.db;
  const emp = selfEmployee(ctx);
  const order: Record<string, number> = { ACTIVE: 0, COMPLETED: 1 };
  const goals = d.goals
    .filter((g) => g.employeeId === emp.id && g.status !== 'CANCELLED')
    .sort((a, b) => order[a.status] - order[b.status] || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || b.createdAt.localeCompare(a.createdAt));
  return goals.map(({ materialIds, ...g }) => {
    const materials = (materialIds as string[])
      .map((id) => byId(d.materials, id))
      .filter(Boolean)
      .map((m: any) => ({ ...pickList(m), isCompleted: d.progress.some((p) => p.employeeId === emp.id && p.materialId === m.id && p.status === 'COMPLETED') }));
    return { ...g, materials, completedCount: materials.filter((m) => m.isCompleted).length };
  });
});

route(
  'POST',
  '/learning/goals',
  (ctx) => {
    const d = ctx.db;
    const emp = selfEmployee(ctx);
    const b = ctx.body ?? {};
    if (!String(b.title ?? '').trim()) throw badRequest('Maqsad nomini kiriting');
    const row = {
      id: newId(),
      organizationId: d.organization.id,
      employeeId: emp.id,
      title: String(b.title).trim(),
      description: String(b.description ?? '').trim() || null,
      dueDate: dateOnly(b.dueDate),
      status: 'ACTIVE',
      createdAt: nowIso(),
      materialIds: publishedIds(d, b.materialIds),
    };
    d.goals.push(row);
    return row;
  },
  { status: 201 },
);

route('PATCH', '/learning/goals/:id', (ctx) => {
  const d = ctx.db;
  const emp = selfEmployee(ctx);
  const g = d.goals.find((x) => x.id === ctx.params.id && x.employeeId === emp.id);
  if (!g) throw notFound('Maqsad topilmadi');
  const { materialIds, dueDate, ...rest } = ctx.body ?? {};
  Object.assign(g, rest);
  if (dueDate !== undefined) g.dueDate = dateOnly(dueDate);
  if (materialIds) g.materialIds = publishedIds(d, materialIds);
  return g;
});
