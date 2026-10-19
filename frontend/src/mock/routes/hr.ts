// Demo API: auth, Core HR, bildirishnomalar, fayl yuklash.
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ACTIVE_STATUSES,
  badRequest,
  byId,
  conflict,
  contains,
  employeeWithRefs,
  forbidden,
  notFound,
  requireRole,
  route,
  sanitizeEmployee,
  sortBy,
  unauthorized,
  userEmail,
  type Ctx,
} from '../core';
import { newId, nowIso } from '../store';
import { syncRulesForEmployee } from '../learningEngine';
import { putFile } from '../files';

export const DEMO_PASSWORD = 'Password123!';

function b64url(obj: unknown) {
  return btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function issueToken(user: any) {
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({ userId: user.id, organizationId: user.organizationId, role: user.role, iat: Math.floor(Date.now() / 1000) });
  return { accessToken: `${header}.${payload}.demo`, refreshToken: `${header}.${b64url({ userId: user.id })}.demo` };
}

// --- Auth ---------------------------------------------------------------------

route(
  'POST',
  '/auth/login',
  (ctx) => {
    const { organizationSlug, email, password } = ctx.body ?? {};
    if (organizationSlug !== ctx.db.organization.slug) throw unauthorized('Tashkilot topilmadi');
    const user = ctx.db.users.find((u) => u.email.toLowerCase() === String(email ?? '').trim().toLowerCase());
    if (!user || !user.isActive || password !== DEMO_PASSWORD) throw unauthorized("Email yoki parol noto'g'ri");
    return issueToken(user);
  },
  { public: true },
);

route('POST', '/auth/refresh', () => {
  throw unauthorized();
}, { public: true });

// --- Rol tekshiruvlari ---------------------------------------------------------

const canManageCoreHr = (role: string) => role === 'SUPER_ADMIN' || role === 'HR_MANAGER';
const canEditLimited = (role: string) => canManageCoreHr(role) || role === 'HR_SPECIALIST';

function scopedEmployees(ctx: Ctx) {
  const { role, userId } = ctx.auth!;
  const all = ctx.db.employees;
  if (role === 'SUPER_ADMIN' || role === 'HR_MANAGER' || role === 'HR_SPECIALIST') return all;
  const self = all.find((e) => e.userId === userId);
  if (!self) return [];
  if (role === 'EMPLOYEE') return [self];
  if (role === 'DEPARTMENT_HEAD') return all.filter((e) => e.id === self.id || e.departmentId === self.departmentId || e.managerId === self.id);
  return [];
}

function assertCanView(ctx: Ctx, emp: any) {
  if (!scopedEmployees(ctx).some((e) => e.id === emp.id)) throw forbidden();
}

function getEmployee(ctx: Ctx, id: string) {
  const emp = byId(ctx.db.employees, id);
  if (!emp) throw notFound('Xodim topilmadi');
  return emp;
}

// --- Dashboard -------------------------------------------------------------------

route('GET', '/hr/dashboard/summary', (ctx) => {
  const { employees, positions, departments, branches } = ctx.db;
  const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
  const active = employees.filter((e) => ACTIVE_STATUSES.includes(e.status));
  const occupied = new Map<string, number>();
  for (const e of active) if (e.positionId) occupied.set(e.positionId, (occupied.get(e.positionId) ?? 0) + 1);
  const group = (key: string) => {
    const m = new Map<string | null, number>();
    for (const e of active) m.set(e[key] ?? null, (m.get(e[key] ?? null) ?? 0) + 1);
    return [...m.entries()];
  };
  const statusCounts = new Map<string, number>();
  for (const e of employees) statusCounts.set(e.status, (statusCounts.get(e.status) ?? 0) + 1);

  return {
    kpi: {
      totalEmployees: employees.length,
      activeEmployees: employees.filter((e) => e.status === 'ACTIVE').length,
      onLeaveEmployees: employees.filter((e) => e.status === 'ON_LEAVE').length,
      newEmployees: employees.filter((e) => new Date(e.hiredAt).getTime() >= monthAgo).length,
      terminatedEmployees: employees.filter((e) => e.status === 'TERMINATED').length,
      vacantPositions: positions
        .filter((p) => p.status === 'ACTIVE')
        .reduce((s, p) => s + Math.max(p.approvedHeadcount - (occupied.get(p.id) ?? 0), 0), 0),
    },
    byDepartment: group('departmentId').map(([id, count]) => ({
      departmentId: id,
      departmentName: id ? byId(departments, id)?.name ?? "Noma'lum" : "Bo'limsiz",
      count,
    })),
    byBranch: group('branchId').map(([id, count]) => ({
      branchId: id,
      branchName: id ? byId(branches, id)?.name ?? "Noma'lum" : 'Filialsiz',
      count,
    })),
    byStatus: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
  };
});

// --- Xodimlar ------------------------------------------------------------------

function buildFullName(firstName: string, lastName: string, middleName?: string | null) {
  return [lastName, firstName, middleName].filter(Boolean).join(' ');
}

route(
  'POST',
  '/hr/employees',
  (ctx) => {
    requireRole(ctx, 'SUPER_ADMIN', 'HR_MANAGER');
    const b = ctx.body ?? {};
    if (!b.employeeCode || !b.firstName || !b.lastName) throw badRequest("Kiritilgan ma'lumotlar noto'g'ri");
    const { employees } = ctx.db;
    if (employees.some((e) => e.employeeCode === b.employeeCode)) throw conflict('Bu Employee ID band');
    if (b.pinfl && employees.some((e) => e.pinfl === b.pinfl)) throw conflict('Bu PINFL band');
    if (b.workEmail && employees.some((e) => e.workEmail === b.workEmail)) throw conflict('Bu ish email band');
    if (b.departmentId && !byId(ctx.db.departments, b.departmentId)) throw badRequest("Ko'rsatilgan bo'lim topilmadi");
    if (b.positionId && !byId(ctx.db.positions, b.positionId)) throw badRequest("Ko'rsatilgan lavozim topilmadi");

    const now = nowIso();
    const hiredAt = b.hiredAt ? new Date(b.hiredAt).toISOString() : now;
    const opt = (v: any) => (v === undefined || v === '' ? null : v);
    const emp = {
      id: newId(),
      organizationId: ctx.db.organization.id,
      userId: null,
      employeeCode: b.employeeCode,
      firstName: b.firstName,
      lastName: b.lastName,
      middleName: opt(b.middleName),
      fullName: buildFullName(b.firstName, b.lastName, b.middleName),
      dateOfBirth: b.dateOfBirth ? new Date(b.dateOfBirth).toISOString() : null,
      gender: opt(b.gender),
      pinfl: opt(b.pinfl),
      passportNumber: opt(b.passportNumber),
      personalPhone: opt(b.personalPhone),
      workPhone: opt(b.workPhone),
      personalEmail: opt(b.personalEmail),
      workEmail: opt(b.workEmail),
      address: opt(b.address),
      emergencyContactName: opt(b.emergencyContactName),
      emergencyContactPhone: opt(b.emergencyContactPhone),
      departmentId: opt(b.departmentId),
      branchId: opt(b.branchId),
      positionId: opt(b.positionId),
      managerId: opt(b.managerId),
      status: b.status ?? 'ACTIVE',
      employmentType: opt(b.employmentType),
      contractNumber: opt(b.contractNumber),
      contractStartDate: b.contractStartDate ? new Date(b.contractStartDate).toISOString() : null,
      contractEndDate: b.contractEndDate ? new Date(b.contractEndDate).toISOString() : null,
      workSchedule: opt(b.workSchedule),
      workLocation: opt(b.workLocation),
      hiredAt,
      createdAt: now,
      updatedAt: now,
    };
    employees.push(emp);
    ctx.db.employmentRecords.push({
      id: newId(),
      organizationId: emp.organizationId,
      employeeId: emp.id,
      positionId: emp.positionId,
      departmentId: emp.departmentId,
      branchId: emp.branchId,
      managerId: emp.managerId,
      startDate: hiredAt,
      endDate: null,
      reason: 'Ishga qabul qilindi',
      changedByUserId: ctx.auth!.userId,
    });
    syncRulesForEmployee(ctx.db, emp.id);
    return employeeWithRefs(ctx.db, emp);
  },
  { status: 201 },
);

route('GET', '/hr/employees', (ctx) => {
  const q = ctx.query;
  const page = Number(q.page ?? 1) || 1;
  const pageSize = Math.min(Number(q.pageSize ?? 25) || 25, 100);
  let list = scopedEmployees(ctx);
  for (const key of ['departmentId', 'branchId', 'positionId', 'managerId', 'status', 'employmentType']) {
    if (q[key]) list = list.filter((e) => e[key] === q[key]);
  }
  if (q.search) {
    const s = String(q.search);
    list = list.filter((e) => contains(e.fullName, s) || contains(e.employeeCode, s) || contains(e.workEmail, s) || contains(e.personalPhone, s));
  }
  const sortKey = q.sortBy ?? 'fullName';
  list = sortBy(list, (e) => e[sortKey], q.sortDir === 'desc' ? 'desc' : 'asc');
  const items = list
    .slice((page - 1) * pageSize, page * pageSize)
    .map((e) => sanitizeEmployee(employeeWithRefs(ctx.db, e), ctx.auth!.role, e.userId === ctx.auth!.userId));
  return { items, total: list.length, page, pageSize };
});

route('GET', '/hr/employees/me', (ctx) => {
  const emp = ctx.db.employees.find((e) => e.userId === ctx.auth!.userId);
  if (!emp) throw notFound("Sizga bog'langan xodim profili topilmadi");
  return employeeWithRefs(ctx.db, emp);
});

route('GET', '/hr/employees/:id', (ctx) => {
  const emp = getEmployee(ctx, ctx.params.id);
  assertCanView(ctx, emp);
  const directReports = ctx.db.employees
    .filter((e) => e.managerId === emp.id)
    .map((e) => ({ id: e.id, fullName: e.fullName, employeeCode: e.employeeCode }));
  return sanitizeEmployee({ ...employeeWithRefs(ctx.db, emp), directReports }, ctx.auth!.role, emp.userId === ctx.auth!.userId);
});

route('PATCH', '/hr/employees/:id', (ctx) => {
  if (!canEditLimited(ctx.auth!.role)) throw forbidden();
  const emp = getEmployee(ctx, ctx.params.id);
  Object.assign(emp, ctx.body ?? {});
  emp.fullName = buildFullName(emp.firstName, emp.lastName, emp.middleName);
  emp.updatedAt = nowIso();
  return employeeWithRefs(ctx.db, emp);
});

route('PATCH', '/hr/employees/:id/employment', (ctx) => {
  requireRole(ctx, 'SUPER_ADMIN', 'HR_MANAGER');
  const emp = getEmployee(ctx, ctx.params.id);
  const { reason, ...changes } = ctx.body ?? {};
  if (!reason) throw badRequest("Kiritilgan ma'lumotlar noto'g'ri");
  const now = nowIso();
  const open = ctx.db.employmentRecords.find((r) => r.employeeId === emp.id && r.endDate === null);
  if (open) open.endDate = now;
  const pick = (k: string) => (changes[k] !== undefined ? changes[k] : emp[k]);
  const next = { positionId: pick('positionId'), departmentId: pick('departmentId'), branchId: pick('branchId'), managerId: pick('managerId') };
  ctx.db.employmentRecords.push({
    id: newId(),
    organizationId: emp.organizationId,
    employeeId: emp.id,
    ...next,
    startDate: now,
    endDate: null,
    reason,
    changedByUserId: ctx.auth!.userId,
  });
  Object.assign(emp, next, { status: changes.status ?? emp.status, updatedAt: now });
  syncRulesForEmployee(ctx.db, emp.id);
  return emp;
});

route('GET', '/hr/employees/:id/history', (ctx) => {
  getEmployee(ctx, ctx.params.id);
  const d = ctx.db;
  return sortBy(
    d.employmentRecords.filter((r) => r.employeeId === ctx.params.id),
    (r) => r.startDate,
    'desc',
  ).map((r) => {
    const manager = byId(d.employees, r.managerId);
    return {
      ...r,
      position: byId(d.positions, r.positionId) ? { id: r.positionId, name: byId(d.positions, r.positionId)!.name } : null,
      department: byId(d.departments, r.departmentId) ? { id: r.departmentId, name: byId(d.departments, r.departmentId)!.name } : null,
      branch: byId(d.branches, r.branchId) ? { id: r.branchId, name: byId(d.branches, r.branchId)!.name } : null,
      manager: manager ? { id: manager.id, fullName: manager.fullName } : null,
      changedByUser: userEmail(d, r.changedByUserId),
    };
  });
});

route(
  'POST',
  '/hr/employees/:id/education',
  (ctx) => {
    if (!canEditLimited(ctx.auth!.role)) throw forbidden();
    getEmployee(ctx, ctx.params.id);
    const b = ctx.body ?? {};
    if (!b.level || !b.institution) throw badRequest("Kiritilgan ma'lumotlar noto'g'ri");
    const row = {
      id: newId(),
      organizationId: ctx.db.organization.id,
      employeeId: ctx.params.id,
      level: b.level,
      institution: b.institution,
      specialty: b.specialty || null,
      graduationYear: b.graduationYear ? Number(b.graduationYear) : null,
      createdAt: nowIso(),
    };
    ctx.db.educations.push(row);
    return row;
  },
  { status: 201 },
);

route('GET', '/hr/employees/:id/education', (ctx) =>
  sortBy(
    ctx.db.educations.filter((e) => e.employeeId === ctx.params.id),
    (e) => e.graduationYear,
    'desc',
  ),
);

route('GET', '/hr/employees/:id/documents', (ctx) => {
  if (!canEditLimited(ctx.auth!.role)) {
    const self = ctx.db.employees.find((e) => e.userId === ctx.auth!.userId);
    if (!self || self.id !== ctx.params.id) throw forbidden();
  }
  return sortBy(
    ctx.db.documents.filter((d) => d.employeeId === ctx.params.id),
    (d) => d.createdAt,
    'desc',
  ).map((doc) => ({ ...doc, uploadedByUser: userEmail(ctx.db, doc.uploadedByUserId) }));
});

route(
  'POST',
  '/hr/employees/:id/documents',
  (ctx) => {
    if (!canEditLimited(ctx.auth!.role)) throw forbidden();
    const row = { id: newId(), organizationId: ctx.db.organization.id, employeeId: ctx.params.id, name: ctx.body?.name, fileUrl: ctx.body?.fileUrl, uploadedByUserId: ctx.auth!.userId, createdAt: nowIso() };
    ctx.db.documents.push(row);
    return row;
  },
  { status: 201 },
);

// --- Bo'limlar -------------------------------------------------------------------

route(
  'POST',
  '/hr/departments',
  (ctx) => {
    requireRole(ctx, 'SUPER_ADMIN', 'HR_MANAGER');
    const { name, code, parentId } = ctx.body ?? {};
    if (!name || String(name).length < 2 || !code) throw badRequest("Kiritilgan ma'lumotlar noto'g'ri");
    if (ctx.db.departments.some((d) => d.code === code)) throw conflict("Bu bo'lim kodi band");
    const row = { id: newId(), organizationId: ctx.db.organization.id, name, code, parentId: parentId || null, headEmployeeId: null, status: 'ACTIVE', archivedAt: null, createdAt: nowIso() };
    ctx.db.departments.push(row);
    return row;
  },
  { status: 201 },
);

route('GET', '/hr/departments', (ctx) => {
  const d = ctx.db;
  return sortBy(d.departments, (x) => x.name).map((dept) => {
    const head = byId(d.employees, dept.headEmployeeId);
    const employeeCount = d.employees.filter((e) => e.departmentId === dept.id).length;
    const positions = d.positions.filter((p) => p.departmentId === dept.id);
    const approved = positions.reduce((s, p) => s + p.approvedHeadcount, 0);
    return {
      ...dept,
      headEmployee: head ? { id: head.id, fullName: head.fullName } : null,
      positionCount: positions.length,
      employeeCount,
      vacantPositionCount: Math.max(approved - employeeCount, 0),
    };
  });
});

route('PATCH', '/hr/departments/:id/archive', (ctx) => {
  requireRole(ctx, 'SUPER_ADMIN', 'HR_MANAGER');
  const dept = byId(ctx.db.departments, ctx.params.id);
  if (!dept) throw notFound("Bo'lim topilmadi");
  const active = ctx.db.employees.filter((e) => e.departmentId === dept.id && ACTIVE_STATUSES.includes(e.status)).length;
  if (active > 0) throw conflict(`Bo'limda ${active} ta faol xodim bor — avval ularni boshqa bo'limga o'tkazing`);
  dept.status = 'ARCHIVED';
  dept.archivedAt = nowIso();
  return dept;
});

// --- Filiallar -------------------------------------------------------------------

route(
  'POST',
  '/hr/branches',
  (ctx) => {
    requireRole(ctx, 'SUPER_ADMIN', 'HR_MANAGER');
    const { name, code, region, address } = ctx.body ?? {};
    if (!name || String(name).length < 2 || !code) throw badRequest("Kiritilgan ma'lumotlar noto'g'ri");
    if (ctx.db.branches.some((b) => b.code === code)) throw conflict('Bu filial kodi band');
    const row = { id: newId(), organizationId: ctx.db.organization.id, name, code, region: region || null, address: address || null, managerId: null, status: 'ACTIVE', archivedAt: null, createdAt: nowIso() };
    ctx.db.branches.push(row);
    return row;
  },
  { status: 201 },
);

route('GET', '/hr/branches', (ctx) => {
  const d = ctx.db;
  return sortBy(d.branches, (x) => x.name).map((b) => {
    const manager = byId(d.employees, b.managerId);
    return {
      ...b,
      manager: manager ? { id: manager.id, fullName: manager.fullName } : null,
      employeeCount: d.employees.filter((e) => e.branchId === b.id).length,
      positionCount: d.positions.filter((p) => p.branchId === b.id).length,
    };
  });
});

route('PATCH', '/hr/branches/:id/archive', (ctx) => {
  requireRole(ctx, 'SUPER_ADMIN', 'HR_MANAGER');
  const b = byId(ctx.db.branches, ctx.params.id);
  if (!b) throw notFound('Filial topilmadi');
  const active = ctx.db.employees.filter((e) => e.branchId === b.id && ACTIVE_STATUSES.includes(e.status)).length;
  if (active > 0) throw conflict(`Filialda ${active} ta faol xodim bor — avval ularni boshqa filialga o'tkazing`);
  b.status = 'ARCHIVED';
  b.archivedAt = nowIso();
  return b;
});

// --- Lavozimlar ------------------------------------------------------------------

route(
  'POST',
  '/hr/positions',
  (ctx) => {
    requireRole(ctx, 'SUPER_ADMIN', 'HR_MANAGER');
    const { name, code, departmentId, branchId, grade, approvedHeadcount } = ctx.body ?? {};
    if (!name || String(name).length < 2 || !code || !departmentId) throw badRequest("Kiritilgan ma'lumotlar noto'g'ri");
    if (ctx.db.positions.some((p) => p.code === code)) throw conflict('Bu lavozim kodi band');
    if (!byId(ctx.db.departments, departmentId)) throw badRequest("Ko'rsatilgan bo'lim topilmadi");
    const row = {
      id: newId(),
      organizationId: ctx.db.organization.id,
      name,
      code,
      departmentId,
      branchId: branchId || null,
      grade: grade || null,
      approvedHeadcount: Number(approvedHeadcount) || 1,
      status: 'ACTIVE',
      archivedAt: null,
      createdAt: nowIso(),
    };
    ctx.db.positions.push(row);
    return row;
  },
  { status: 201 },
);

route('GET', '/hr/positions', (ctx) => {
  const d = ctx.db;
  const occupied = new Map<string, number>();
  for (const e of d.employees) if (e.positionId && ACTIVE_STATUSES.includes(e.status)) occupied.set(e.positionId, (occupied.get(e.positionId) ?? 0) + 1);
  return sortBy(d.positions, (p) => p.name).map((p) => {
    const occupiedHeadcount = occupied.get(p.id) ?? 0;
    const dept = byId(d.departments, p.departmentId);
    const branch = byId(d.branches, p.branchId);
    return {
      ...p,
      department: dept ? { id: dept.id, name: dept.name } : null,
      branch: branch ? { id: branch.id, name: branch.name } : null,
      occupiedHeadcount,
      vacantHeadcount: Math.max(p.approvedHeadcount - occupiedHeadcount, 0),
    };
  });
});

route('PATCH', '/hr/positions/:id/archive', (ctx) => {
  requireRole(ctx, 'SUPER_ADMIN', 'HR_MANAGER');
  const p = byId(ctx.db.positions, ctx.params.id);
  if (!p) throw notFound('Lavozim topilmadi');
  const active = ctx.db.employees.filter((e) => e.positionId === p.id && ACTIVE_STATUSES.includes(e.status)).length;
  if (active > 0) throw conflict(`Bu lavozimda ${active} ta faol xodim bor — avval ularni boshqa lavozimga o'tkazing`);
  p.status = 'ARCHIVED';
  p.archivedAt = nowIso();
  return p;
});

// --- Bildirishnomalar --------------------------------------------------------------

route('GET', '/notifications', (ctx) =>
  sortBy(
    ctx.db.notifications.filter((n) => n.userId === ctx.auth!.userId),
    (n) => n.createdAt,
    'desc',
  ).slice(0, 50),
);

route('PATCH', '/notifications/read-all', (ctx) => {
  for (const n of ctx.db.notifications) if (n.userId === ctx.auth!.userId) n.isRead = true;
  return null;
});

route('PATCH', '/notifications/:id/read', (ctx) => {
  const n = ctx.db.notifications.find((x) => x.id === ctx.params.id && x.userId === ctx.auth!.userId);
  if (n) n.isRead = true;
  return null;
});

// --- Fayl yuklash (brauzer xotirasida) -----------------------------------------------

const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

route('GET', '/uploads/limits', (ctx) => {
  requireRole(ctx, 'SUPER_ADMIN', 'HR_MANAGER');
  return { maxBytes: MAX_BYTES, storage: 'DB' };
});

route(
  'POST',
  '/uploads',
  async (ctx) => {
    requireRole(ctx, 'SUPER_ADMIN', 'HR_MANAGER');
    const purpose = ctx.query.purpose;
    const file: File | null = ctx.body instanceof FormData ? (ctx.body.get('file') as File | null) : null;
    if (!file) throw badRequest('Fayl tanlanmagan');
    if (purpose === 'cover' && !COVER_TYPES.includes(file.type)) throw badRequest('Muqova uchun JPG, PNG yoki WebP rasm yuklang');
    if (purpose === 'cover' && file.size > 5 * 1024 * 1024) throw badRequest('Muqova rasmi 5 MB dan oshmasin');
    if (file.size > MAX_BYTES) throw badRequest('Fayl juda katta');
    const saved = await putFile(ctx.db, file, purpose === 'cover');
    return { ...saved, url: `/files/${saved.id}` };
  },
  { status: 201 },
);
