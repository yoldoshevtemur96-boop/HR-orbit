// Demo API: davomat va tabellar (/attendance/*).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { badRequest, byId, forbidden, notFound, requireRole, route, selfEmployee, sortBy, toDateOnlyIso, type Ctx } from '../core';
import { newId, nowIso, type DemoDb } from '../store';
import { buildXlsx } from '../xlsx';

const canManage = (role: string) => role === 'SUPER_ADMIN' || role === 'HR_MANAGER' || role === 'TIMEKEEPER';
const canViewDept = (role: string) => canManage(role) || role === 'DEPARTMENT_HEAD';

function requireManage(ctx: Ctx) {
  if (!canManage(ctx.auth!.role)) throw forbidden();
}

/** Davomat ko'rinishidagi faol xodimlar (backend: listActiveEmployeesForScope) */
function activeForScope(ctx: Ctx, filters: { departmentId?: string; branchId?: string }) {
  const d = ctx.db;
  const { role, userId } = ctx.auth!;
  let list = d.employees.filter(
    (e) => e.status === 'ACTIVE' && (!filters.departmentId || e.departmentId === filters.departmentId) && (!filters.branchId || e.branchId === filters.branchId),
  );
  if (role !== 'TIMEKEEPER' && role !== 'SUPER_ADMIN' && role !== 'HR_MANAGER' && role !== 'HR_SPECIALIST') {
    const self = d.employees.find((e) => e.userId === userId);
    if (!self) return [];
    if (role === 'EMPLOYEE') list = list.filter((e) => e.id === self.id);
    else if (role === 'DEPARTMENT_HEAD') list = list.filter((e) => e.id === self.id || e.departmentId === self.departmentId || e.managerId === self.id);
    else list = [];
  }
  return sortBy(list, (e) => e.fullName).map((e) => ({
    id: e.id,
    fullName: e.fullName,
    employeeCode: e.employeeCode,
    departmentId: e.departmentId,
    branchId: e.branchId,
    managerId: e.managerId,
  }));
}

function scopedDepartmentId(ctx: Ctx, requested?: string) {
  if (ctx.auth!.role === 'DEPARTMENT_HEAD') {
    return ctx.db.employees.find((e) => e.userId === ctx.auth!.userId)?.departmentId ?? '__none__';
  }
  return requested || undefined;
}

// --- Sozlamalar ---------------------------------------------------------------------

route('GET', '/attendance/settings', (ctx) => {
  if (!canViewDept(ctx.auth!.role)) throw forbidden();
  return ctx.db.attendanceSettings;
});

route('PATCH', '/attendance/settings', (ctx) => {
  requireManage(ctx);
  const b = ctx.body ?? {};
  const s = ctx.db.attendanceSettings;
  for (const k of ['standardStartTime', 'standardEndTime']) {
    if (b[k] !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(b[k])) throw badRequest("Kiritilgan ma'lumotlar noto'g'ri");
      s[k] = b[k];
    }
  }
  for (const k of ['standardWorkMinutes', 'lateThresholdMinutes']) if (b[k] !== undefined) s[k] = Number(b[k]);
  s.updatedAt = nowIso();
  return s;
});

// --- Kunlik davomat -------------------------------------------------------------------

function computeFields(checkIn: string | null, checkOut: string | null, s: any, explicit?: string) {
  if (explicit && !['PRESENT', 'LATE', 'EARLY_LEAVE'].includes(explicit)) {
    return { status: explicit, lateMinutes: 0, earlyLeaveMinutes: 0, workedMinutes: 0, overtimeMinutes: 0 };
  }
  if (!checkIn) return { status: 'ABSENT', lateMinutes: 0, earlyLeaveMinutes: 0, workedMinutes: 0, overtimeMinutes: 0 };
  const toMin = (v: string) => {
    const [h, m] = v.split(':').map(Number);
    return h * 60 + m;
  };
  const dtMin = (iso: string) => {
    const dt = new Date(iso);
    return dt.getHours() * 60 + dt.getMinutes();
  };
  const inM = dtMin(checkIn);
  const after = inM - toMin(s.standardStartTime);
  const lateMinutes = after > s.lateThresholdMinutes ? after : 0;
  let earlyLeaveMinutes = 0;
  let workedMinutes = 0;
  let overtimeMinutes = 0;
  if (checkOut) {
    const outM = dtMin(checkOut);
    workedMinutes = Math.max(0, outM - inM);
    earlyLeaveMinutes = Math.max(0, toMin(s.standardEndTime) - outM);
    overtimeMinutes = Math.max(0, workedMinutes - s.standardWorkMinutes);
  }
  const status = lateMinutes > 0 ? 'LATE' : earlyLeaveMinutes > 0 ? 'EARLY_LEAVE' : 'PRESENT';
  return { status, lateMinutes, earlyLeaveMinutes, workedMinutes, overtimeMinutes };
}

route(
  'POST',
  '/attendance/records',
  (ctx) => {
    requireManage(ctx);
    const d = ctx.db;
    const b = ctx.body ?? {};
    if (!b.employeeId || !b.date) throw badRequest("Kiritilgan ma'lumotlar noto'g'ri");
    const date = toDateOnlyIso(b.date);
    const checkInTime = b.checkInTime ? new Date(b.checkInTime).toISOString() : null;
    const checkOutTime = b.checkOutTime ? new Date(b.checkOutTime).toISOString() : null;
    const computed = computeFields(checkInTime, checkOutTime, d.attendanceSettings, b.status);
    let rec = d.attendanceRecords.find((r) => r.employeeId === b.employeeId && r.date === date);
    const data = { checkInTime, checkOutTime, note: b.note ?? null, editedByUserId: ctx.auth!.userId, source: 'MANUAL', ...computed };
    if (rec) Object.assign(rec, data);
    else {
      rec = { id: newId(), organizationId: d.organization.id, employeeId: b.employeeId, date, ...data };
      d.attendanceRecords.push(rec);
    }
    return rec;
  },
  { status: 201 },
);

function dailyRows(ctx: Ctx) {
  if (!canViewDept(ctx.auth!.role)) throw forbidden();
  const q = ctx.query;
  if (!q.date) throw badRequest("Kiritilgan ma'lumotlar noto'g'ri");
  const date = toDateOnlyIso(String(q.date));
  const employees = activeForScope(ctx, { departmentId: scopedDepartmentId(ctx, q.departmentId), branchId: q.branchId });
  const byEmp = new Map(ctx.db.attendanceRecords.filter((r) => r.date === date).map((r) => [r.employeeId, r]));
  return employees.map((employee) => ({ employee, record: byEmp.get(employee.id) ?? null }));
}

route('GET', '/attendance/records/daily', (ctx) => {
  const rows = dailyRows(ctx);
  const status = ctx.query.status;
  if (!status || status === 'ALL') return rows;
  if (status === 'LATE') return rows.filter((r) => r.record?.status === 'LATE');
  return rows.filter((r) => (r.record?.status ?? 'ABSENT') === 'ABSENT');
});

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Keldi',
  LATE: 'Kechikdi',
  EARLY_LEAVE: 'Erta ketdi',
  ABSENT: 'Kelmadi',
  ON_LEAVE: "Ta'tilda",
  BUSINESS_TRIP: 'Safarda',
  REMOTE: 'Masofaviy',
  SICK: 'Bemor',
};

route('GET', '/attendance/records/daily/export', (ctx) => {
  const rows = dailyRows(ctx);
  const d = ctx.db;
  const time = (iso: string | null) => {
    if (!iso) return '—';
    const dt = new Date(iso);
    return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  };
  const table: (string | number | null)[][] = [
    ['№', 'F.I.Sh.', 'Lavozimi', "Bo'lim", 'Kirish', 'Chiqish', 'Holat', 'Kechikish (daq)', 'Erta ketish (daq)'],
    ...rows.map((r, i) => {
      const emp = byId(d.employees, r.employee.id);
      return [
        i + 1,
        r.employee.fullName,
        byId(d.positions, emp?.positionId)?.name ?? '—',
        byId(d.departments, emp?.departmentId)?.name ?? '—',
        time(r.record?.checkInTime ?? null),
        time(r.record?.checkOutTime ?? null),
        STATUS_LABEL[r.record?.status ?? 'ABSENT'],
        r.record?.lateMinutes ?? 0,
        r.record?.earlyLeaveMinutes ?? 0,
      ];
    }),
  ];
  return buildXlsx('Davomat', table);
});

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, month, 1)).toISOString();
  return { start, end };
}

route('GET', '/attendance/records/statistics', (ctx) => {
  if (!canViewDept(ctx.auth!.role)) throw forbidden();
  const q = ctx.query;
  const { start, end } = monthRange(Number(q.year), Number(q.month));
  const employees = activeForScope(ctx, { departmentId: scopedDepartmentId(ctx, q.departmentId), branchId: q.branchId });
  return employees.map((e) => {
    const recs = ctx.db.attendanceRecords.filter((r) => r.employeeId === e.id && r.date >= start && r.date < end);
    const worked = recs.reduce((s, r) => s + r.workedMinutes, 0);
    return {
      employeeId: e.id,
      employeeCode: e.employeeCode,
      fullName: e.fullName,
      presentCount: recs.filter((r) => ['PRESENT', 'LATE', 'EARLY_LEAVE'].includes(r.status)).length,
      lateCount: recs.filter((r) => r.status === 'LATE').length,
      absentCount: recs.filter((r) => r.status === 'ABSENT').length,
      totalWorkedHours: Math.round((worked / 60) * 100) / 100,
    };
  });
});

route('GET', '/attendance/records/me/today', (ctx) => {
  const emp = selfEmployee(ctx);
  const t = new Date();
  const date = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())).toISOString();
  return ctx.db.attendanceRecords.find((r) => r.employeeId === emp.id && r.date === date) ?? null;
});

route('GET', '/attendance/records/me/calendar', (ctx) => {
  const emp = selfEmployee(ctx);
  const { start, end } = monthRange(Number(ctx.query.year), Number(ctx.query.month));
  return sortBy(
    ctx.db.attendanceRecords.filter((r) => r.employeeId === emp.id && r.date >= start && r.date < end),
    (r) => r.date,
  );
});

route('GET', '/attendance/records/employee/:employeeId', (ctx) => {
  const { start, end } = monthRange(Number(ctx.query.year), Number(ctx.query.month));
  return sortBy(
    ctx.db.attendanceRecords.filter((r) => r.employeeId === ctx.params.employeeId && r.date >= start && r.date < end),
    (r) => r.date,
  );
});

// --- Tabellar ---------------------------------------------------------------------

function dayCell(day: number, dateIso: string, rec: any) {
  const base = { hasCorrection: false, correctionComment: null };
  if (!rec) {
    const dow = new Date(dateIso).getUTCDay();
    return { day, code: dow === 0 || dow === 6 ? 'В' : '', hours: null, ...base };
  }
  switch (rec.status) {
    case 'PRESENT':
    case 'LATE':
    case 'EARLY_LEAVE': {
      const hours = Math.round((rec.workedMinutes / 60) * 10) / 10;
      return { day, code: hours > 0 ? String(hours) : '8', hours, ...base };
    }
    case 'ON_LEAVE':
      return { day, code: 'Д', hours: null, ...base };
    case 'SICK':
      return { day, code: 'К', hours: null, ...base };
    case 'BUSINESS_TRIP':
      return { day, code: 'С', hours: null, ...base };
    case 'REMOTE':
      return { day, code: 'М', hours: null, ...base };
    default:
      return { day, code: '', hours: null, ...base };
  }
}

const isWorkedCode = (code: string) => code !== '' && !Number.isNaN(Number(code));

function applyCellEdit(line: any, day: number, hours: number, comment: string) {
  const cell = line.days.find((c: any) => c.day === day);
  if (!cell) return;
  if (!isWorkedCode(cell.code)) {
    line.presentDays += 1;
    if (cell.code === '' && line.absentDays > 0) line.absentDays -= 1;
  }
  line.workedHours = Math.round((line.workedHours - (cell.hours ?? 0) + hours) * 100) / 100;
  if (!cell.edited) cell.originalCode = cell.code;
  Object.assign(cell, { code: String(hours), hours, edited: true, editComment: comment });
}

function buildDepartmentSummary(d: DemoDb, departmentId: string, year: number, month: number) {
  const employees = d.employees.filter((e) => e.departmentId === departmentId && e.status === 'ACTIVE');
  const { start, end } = monthRange(year, month);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return employees.map((e) => {
    const recs = d.attendanceRecords.filter((r) => r.employeeId === e.id && r.date >= start && r.date < end);
    const byDay = new Map(recs.map((r) => [new Date(r.date).getUTCDate(), r]));
    const line: any = {
      employeeId: e.id,
      employeeCode: e.employeeCode,
      fullName: e.fullName,
      positionName: byId(d.positions, e.positionId)?.name ?? null,
      presentDays: 0,
      lateDays: 0,
      earlyLeaveDays: 0,
      absentDays: Math.max(0, daysInMonth - recs.length),
      onLeaveDays: 0,
      businessTripDays: 0,
      remoteDays: 0,
      sickDays: 0,
      workedHours: 0,
      overtimeHours: 0,
      days: [],
    };
    for (const r of recs) {
      if (r.status === 'PRESENT') line.presentDays += 1;
      else if (r.status === 'LATE') (line.presentDays += 1), (line.lateDays += 1);
      else if (r.status === 'EARLY_LEAVE') (line.presentDays += 1), (line.earlyLeaveDays += 1);
      else if (r.status === 'ABSENT') line.absentDays += 1;
      else if (r.status === 'ON_LEAVE') line.onLeaveDays += 1;
      else if (r.status === 'BUSINESS_TRIP') line.businessTripDays += 1;
      else if (r.status === 'REMOTE') line.remoteDays += 1;
      else if (r.status === 'SICK') line.sickDays += 1;
      line.workedHours += r.workedMinutes / 60;
      line.overtimeHours += r.overtimeMinutes / 60;
    }
    line.workedHours = Math.round(line.workedHours * 100) / 100;
    line.overtimeHours = Math.round(line.overtimeHours * 100) / 100;
    for (let day = 1; day <= daysInMonth; day++) {
      line.days.push(dayCell(day, new Date(Date.UTC(year, month - 1, day)).toISOString(), byDay.get(day)));
    }
    for (const edit of d.cellEdits.filter((x) => x.employeeId === e.id && x.date >= start && x.date < end)) {
      applyCellEdit(line, new Date(edit.date).getUTCDate(), edit.hours, edit.comment);
    }
    return line;
  });
}

function assertCanManageDept(ctx: Ctx, departmentId: string) {
  if (canManage(ctx.auth!.role)) return;
  if (ctx.auth!.role === 'DEPARTMENT_HEAD' && selfEmployee(ctx).departmentId === departmentId) return;
  throw forbidden();
}

function deptTimesheet(ctx: Ctx, id: string) {
  const t = byId(ctx.db.departmentTimesheets, id);
  if (!t) throw notFound('Tabel topilmadi');
  return t;
}

const findDeptTs = (d: DemoDb, departmentId: string, year: number, month: number) =>
  d.departmentTimesheets.find((t) => t.departmentId === departmentId && t.year === year && t.month === month);

route(
  'POST',
  '/attendance/timesheets/department/generate',
  (ctx) => {
    const d = ctx.db;
    const departmentId = ctx.body?.departmentId;
    const year = Number(ctx.body?.year);
    const month = Number(ctx.body?.month);
    if (!departmentId || !year || !month) throw badRequest("Kiritilgan ma'lumotlar noto'g'ri");
    assertCanManageDept(ctx, departmentId);
    const existing = findDeptTs(d, departmentId, year, month);
    if (existing && existing.status !== 'DRAFT' && existing.status !== 'DEPT_REJECTED') {
      throw badRequest("Bu tabel allaqachon yuborilgan — qayta generatsiya qilib bo'lmaydi");
    }
    const summaryData = buildDepartmentSummary(d, departmentId, year, month);
    if (existing) {
      Object.assign(existing, { status: 'DRAFT', summaryData, generatedByUserId: ctx.auth!.userId, rejectionComment: null });
      return existing;
    }
    const row = {
      id: newId(),
      organizationId: d.organization.id,
      departmentId,
      month,
      year,
      status: 'DRAFT',
      summaryData,
      submittedAt: null,
      deptApprovedByUserId: null,
      deptApprovedAt: null,
      rejectionComment: null,
      generatedByUserId: ctx.auth!.userId,
      hrOverride: false,
      hrOverrideReason: null,
      createdAt: nowIso(),
    };
    d.departmentTimesheets.push(row);
    return row;
  },
  { status: 201 },
);

route('POST', '/attendance/timesheets/department/:id/submit', (ctx) => {
  const t = deptTimesheet(ctx, ctx.params.id);
  assertCanManageDept(ctx, t.departmentId);
  if (t.status !== 'DRAFT') throw badRequest('Faqat qoralama holatidagi tabel yuborilishi mumkin');
  Object.assign(t, { status: 'DEPT_SUBMITTED', submittedAt: nowIso() });
  return t;
});

route('POST', '/attendance/timesheets/department/:id/decide', (ctx) => {
  requireRole(ctx, 'SUPER_ADMIN', 'HR_MANAGER', 'TIMEKEEPER');
  const t = deptTimesheet(ctx, ctx.params.id);
  if (t.status !== 'DEPT_SUBMITTED') throw badRequest('Bu tabel hozir tasdiqlash kutilayotgan holatda emas');
  if (ctx.body?.decision === 'REJECTED') Object.assign(t, { status: 'DEPT_REJECTED', rejectionComment: ctx.body?.rejectionComment ?? null });
  else Object.assign(t, { status: 'DEPT_APPROVED', deptApprovedByUserId: ctx.auth!.userId, deptApprovedAt: nowIso(), rejectionComment: null });
  return t;
});

route('POST', '/attendance/timesheets/department/hr-approve', (ctx) => {
  requireRole(ctx, 'SUPER_ADMIN', 'HR_MANAGER', 'TIMEKEEPER');
  const d = ctx.db;
  const { departmentId, reason } = ctx.body ?? {};
  const year = Number(ctx.body?.year);
  const month = Number(ctx.body?.month);
  if (!String(reason ?? '').trim()) throw badRequest('Sabab majburiy');
  if (!byId(d.departments, departmentId)) throw notFound("Bo'lim topilmadi");
  const existing = findDeptTs(d, departmentId, year, month);
  if (existing && existing.status !== 'DRAFT' && existing.status !== 'DEPT_REJECTED') {
    throw badRequest(existing.status === 'DEPT_SUBMITTED' ? 'Rahbar bu tabelni yuborgan — uni oddiy tartibda tasdiqlang' : 'Bu tabel allaqachon tasdiqlangan');
  }
  const now = nowIso();
  const data = {
    status: 'DEPT_APPROVED',
    summaryData: buildDepartmentSummary(d, departmentId, year, month),
    generatedByUserId: ctx.auth!.userId,
    deptApprovedByUserId: ctx.auth!.userId,
    deptApprovedAt: now,
    rejectionComment: null,
    hrOverride: true,
    hrOverrideReason: String(reason).trim(),
  };
  if (existing) return Object.assign(existing, data);
  const row = { id: newId(), organizationId: d.organization.id, departmentId, year, month, submittedAt: null, createdAt: now, ...data };
  d.departmentTimesheets.push(row);
  return row;
});

route('GET', '/attendance/timesheets/department/preview', (ctx) => {
  requireManage(ctx);
  const { departmentId } = ctx.query;
  if (!byId(ctx.db.departments, departmentId)) throw notFound("Bo'lim topilmadi");
  return buildDepartmentSummary(ctx.db, departmentId, Number(ctx.query.year), Number(ctx.query.month));
});

route('PUT', '/attendance/timesheets/cells', (ctx) => {
  if (!canViewDept(ctx.auth!.role)) throw forbidden();
  const d = ctx.db;
  const { employeeId, date, comment } = ctx.body ?? {};
  const hours = Number(ctx.body?.hours);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !(hours >= 1 && hours <= 8)) throw badRequest("Kiritilgan ma'lumotlar noto'g'ri");
  if (!String(comment ?? '').trim()) throw badRequest('Izoh majburiy');
  const emp = byId(d.employees, employeeId);
  if (!emp?.departmentId) throw notFound('Xodim topilmadi');
  const dateIso = new Date(`${date}T00:00:00.000Z`).toISOString();
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const ts = findDeptTs(d, emp.departmentId, year, month);
  if (ctx.auth!.role === 'DEPARTMENT_HEAD') {
    if (!ts) throw notFound("Bu oy uchun bo'lim tabeli topilmadi");
    if (selfEmployee(ctx).departmentId !== emp.departmentId) throw forbidden();
  }
  if (ts?.status === 'CONSOLIDATED') throw badRequest("Tabel rahbariyatga yuborilgan — endi o'zgartirib bo'lmaydi");

  const existingEdit = d.cellEdits.find((x) => x.employeeId === employeeId && x.date === dateIso);
  const editData = { hours, comment: String(comment).trim(), editedByUserId: ctx.auth!.userId, editedByRole: ctx.auth!.role };
  if (existingEdit) Object.assign(existingEdit, editData);
  else d.cellEdits.push({ id: newId(), organizationId: d.organization.id, employeeId, date: dateIso, ...editData });

  if (!ts) return null;
  const line = ts.summaryData.find((l: any) => l.employeeId === employeeId);
  if (!line) return ts;
  applyCellEdit(line, Number(date.slice(8, 10)), hours, String(comment).trim());
  if (ctx.auth!.role === 'DEPARTMENT_HEAD' && (ts.status === 'DEPT_SUBMITTED' || ts.status === 'DEPT_APPROVED')) {
    Object.assign(ts, { status: 'DRAFT', submittedAt: null, deptApprovedByUserId: null, deptApprovedAt: null, hrOverride: false, hrOverrideReason: null });
  }
  return ts;
});

route('GET', '/attendance/timesheets/department', (ctx) => {
  if (!canViewDept(ctx.auth!.role)) throw forbidden();
  const year = ctx.query.year ? Number(ctx.query.year) : undefined;
  let list = ctx.db.departmentTimesheets.filter((t) => !year || t.year === year);
  if (ctx.auth!.role === 'DEPARTMENT_HEAD') {
    const dep = selfEmployee(ctx).departmentId;
    list = list.filter((t) => t.departmentId === dep);
  }
  return [...list].sort((a, b) => b.year - a.year || b.month - a.month);
});

route('GET', '/attendance/timesheets/department/:id', (ctx) => {
  if (!canViewDept(ctx.auth!.role)) throw forbidden();
  const t = deptTimesheet(ctx, ctx.params.id);
  if (ctx.auth!.role === 'DEPARTMENT_HEAD' && selfEmployee(ctx).departmentId !== t.departmentId) throw forbidden();
  return t;
});

// --- Tashkilot tabeli ------------------------------------------------------------

const canApproveOrg = (role: string) => role === 'SUPER_ADMIN';

function orgDetail(d: DemoDb, t: any) {
  return { ...t, lines: (t.departmentTimesheetIds as string[]).map((id) => ({ departmentTimesheet: byId(d.departmentTimesheets, id) })).filter((l) => l.departmentTimesheet) };
}

function orgTimesheet(ctx: Ctx, id: string) {
  const t = byId(ctx.db.organizationTimesheets, id);
  if (!t) throw notFound('Tabel topilmadi');
  return t;
}

const publicOrg = (t: any) => {
  const { departmentTimesheetIds: _ids, ...rest } = t;
  return rest;
};

route(
  'POST',
  '/attendance/timesheets/organization/consolidate',
  (ctx) => {
    requireManage(ctx);
    const d = ctx.db;
    const year = Number(ctx.body?.year);
    const month = Number(ctx.body?.month);
    const approved = d.departmentTimesheets.filter((t) => t.year === year && t.month === month && t.status === 'DEPT_APPROVED');
    if (approved.length === 0) throw badRequest("Tasdiqlangan departament tabeli topilmadi — avval bo'limlar tabelini tasdiqlashi kerak");
    let org = d.organizationTimesheets.find((t) => t.year === year && t.month === month);
    if (org && (org.status === 'SUBMITTED' || org.status === 'APPROVED')) throw badRequest('Bu oy tabeli allaqachon rahbariyatga yuborilgan');
    if (org) Object.assign(org, { status: 'DRAFT', consolidatedByUserId: ctx.auth!.userId, rejectionComment: null });
    else {
      org = {
        id: newId(),
        organizationId: d.organization.id,
        month,
        year,
        status: 'DRAFT',
        consolidatedByUserId: ctx.auth!.userId,
        submittedAt: null,
        approvedByUserId: null,
        approvedAt: null,
        rejectionComment: null,
        createdAt: nowIso(),
      };
      d.organizationTimesheets.push(org);
    }
    org.departmentTimesheetIds = approved.map((t) => t.id);
    return publicOrg(orgDetail(d, org));
  },
  { status: 201 },
);

route('POST', '/attendance/timesheets/organization/:id/submit', (ctx) => {
  requireManage(ctx);
  const d = ctx.db;
  const t = orgTimesheet(ctx, ctx.params.id);
  if (t.status !== 'DRAFT') throw badRequest('Faqat qoralama holatidagi tabel yuborilishi mumkin');
  const depts = (t.departmentTimesheetIds as string[]).map((id) => byId(d.departmentTimesheets, id)).filter(Boolean) as any[];
  if (depts.some((x) => x.status !== 'DEPT_APPROVED')) throw badRequest("Bo'lim tabellari o'zgargan — tabelni qayta yig'ib yuboring");
  Object.assign(t, { status: 'SUBMITTED', submittedAt: nowIso() });
  for (const x of depts) x.status = 'CONSOLIDATED';
  return publicOrg(t);
});

route('POST', '/attendance/timesheets/organization/:id/decide', (ctx) => {
  if (!canApproveOrg(ctx.auth!.role)) throw forbidden('Yakuniy tabelni faqat yuqori rahbar tasdiqlaydi');
  const d = ctx.db;
  const t = orgTimesheet(ctx, ctx.params.id);
  if (t.status !== 'SUBMITTED') throw badRequest('Bu tabel hozir tasdiqlash kutilayotgan holatda emas');
  if (ctx.body?.decision === 'REJECTED') {
    Object.assign(t, { status: 'REJECTED', rejectionComment: ctx.body?.rejectionComment ?? null });
    for (const id of t.departmentTimesheetIds) {
      const x = byId(d.departmentTimesheets, id);
      if (x?.status === 'CONSOLIDATED') x.status = 'DEPT_APPROVED';
    }
  } else Object.assign(t, { status: 'APPROVED', approvedByUserId: ctx.auth!.userId, approvedAt: nowIso(), rejectionComment: null });
  return publicOrg(t);
});

route('GET', '/attendance/timesheets/organization', (ctx) => {
  if (!canManage(ctx.auth!.role) && !canApproveOrg(ctx.auth!.role)) throw forbidden();
  const year = ctx.query.year ? Number(ctx.query.year) : undefined;
  return ctx.db.organizationTimesheets
    .filter((t) => !year || t.year === year)
    .sort((a, b) => b.year - a.year || b.month - a.month)
    .map(publicOrg);
});

route('GET', '/attendance/timesheets/organization/:id', (ctx) => {
  if (!canManage(ctx.auth!.role) && !canApproveOrg(ctx.auth!.role)) throw forbidden();
  return publicOrg(orgDetail(ctx.db, orgTimesheet(ctx, ctx.params.id)));
});
