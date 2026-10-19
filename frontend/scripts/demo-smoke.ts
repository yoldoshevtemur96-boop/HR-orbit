// Demo API uchun tezkor tekshiruv: asosiy yozish oqimlarini ketma-ket bajaradi.
// Ishga tushirish: npx tsx scripts/demo-smoke.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
const mem = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  },
};

async function main() {
  const { demoAdapter } = await import('../src/mock/adapter');
  let token = '';
  const call = async (method: string, url: string, data?: any, params?: any) => {
    try {
      const res: any = await demoAdapter({
        method,
        url,
        baseURL: 'http://localhost:4000/api',
        data: data === undefined ? undefined : JSON.stringify(data),
        params,
        headers: { Authorization: token ? `Bearer ${token}` : undefined },
      } as any);
      return res.data;
    } catch (e: any) {
      throw new Error(`${method} ${url} → ${e.response?.status} ${e.response?.data?.error?.message}`);
    }
  };
  const login = async (email: string) => {
    token = (await call('POST', '/auth/login', { organizationSlug: 'demo', email, password: 'Password123!' })).accessToken;
  };
  const ok = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`✓ ${msg}`);
  };

  // Noto'g'ri parol
  await call('POST', '/auth/login', { organizationSlug: 'demo', email: 'hr@demo.uz', password: 'x' }).then(
    () => ok(false, 'wrong password rejected'),
    (e) => ok(String(e.message).includes('401'), 'wrong password rejected'),
  );

  // --- Workflow: xodim ariza beradi → boshliq → HR tasdiqlaydi
  await login('xodim@demo.uz');
  const me = await call('GET', '/hr/employees/me');
  const templates = await call('GET', '/workflow/templates');
  const annual = templates.find((t: any) => t.name === "Yillik mehnat ta'tili");
  const inst = await call('POST', '/workflow/instances', {
    templateId: annual.id,
    employeeId: me.id,
    formData: { startDate: '2026-11-01', endDate: '2026-11-10', daysCount: 10, employeeName: me.fullName },
  });
  ok(inst.timeline.length === 2 && inst.status === 'IN_PROGRESS', 'request created with 2-step timeline');
  await login('boshliq@demo.uz');
  const pending = await call('GET', '/workflow/instances/pending-for-me');
  ok(pending.some((p: any) => p.instance.id === inst.id), 'manager sees it in pending');
  await call('POST', `/workflow/instances/${inst.id}/decide`, { decision: 'APPROVED', comment: 'OK' });
  await login('hr@demo.uz');
  const done = await call('POST', `/workflow/instances/${inst.id}/decide`, { decision: 'APPROVED' });
  ok(done.status === 'APPROVED', 'HR final approval completes request');
  await login('xodim@demo.uz');
  const notes = await call('GET', '/notifications');
  ok(notes.some((n: any) => n.type === 'REQUEST_APPROVED'), 'employee notified of approval');

  // --- Core HR: yangi xodim, lavozim o'zgarishi
  await login('hr@demo.uz');
  const positions = await call('GET', '/hr/positions');
  const deps = await call('GET', '/hr/departments');
  const created = await call('POST', '/hr/employees', {
    employeeCode: 'EMP-09999',
    firstName: 'Test',
    lastName: 'Xodimov',
    departmentId: deps[0].id,
    positionId: positions[0].id,
  });
  ok(created.fullName === 'Xodimov Test' && created.department, 'employee created with refs');
  const list = await call('GET', '/hr/employees', undefined, { search: 'Xodimov' });
  ok(list.total === 1, 'employee search works');
  await call('PATCH', `/hr/employees/${created.id}/employment`, { positionId: positions[1].id, reason: "Lavozim o'zgardi" });
  const history = await call('GET', `/hr/employees/${created.id}/history`);
  ok(history.length === 2 && history[1].endDate, 'employment history recorded');
  const summary = await call('GET', '/hr/dashboard/summary');
  ok(summary.kpi.totalEmployees === 29 && summary.kpi.newEmployees === 1, `dashboard KPIs (${summary.kpi.totalEmployees} jami)`);

  // --- Davomat: boshliq tabel → HR tasdiq → tashkilot tabeli → CEO tasdiq
  await login('boshliq@demo.uz');
  const myEmp = await call('GET', '/hr/employees/me');
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const ym = { year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 };
  const ts = await call('POST', '/attendance/timesheets/department/generate', { departmentId: myEmp.departmentId, ...ym });
  ok(ts.summaryData.length > 0 && ts.summaryData[0].days.length >= 28, `dept timesheet generated (${ts.summaryData.length} xodim)`);
  const cell = ts.summaryData[0].days.find((d: any) => d.code === '');
  if (cell) {
    const date = `${ym.year}-${String(ym.month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
    const edited = await call('PUT', '/attendance/timesheets/cells', { employeeId: ts.summaryData[0].employeeId, date, hours: 8, comment: 'Turniket ishlamadi' });
    ok(edited.summaryData[0].days.find((d: any) => d.day === cell.day).edited, 'timesheet cell edit applied');
  }
  await call('POST', `/attendance/timesheets/department/${ts.id}/submit`);
  await login('tabelchi@demo.uz');
  await call('POST', `/attendance/timesheets/department/${ts.id}/decide`, { decision: 'APPROVED' });
  const others = deps.filter((d: any) => d.id !== myEmp.departmentId);
  await call('POST', '/attendance/timesheets/department/hr-approve', { departmentId: others[0].id, ...ym, reason: "Rahbar ta'tilda" });
  const org = await call('POST', '/attendance/timesheets/organization/consolidate', ym);
  ok(org.lines.length === 2, 'org timesheet consolidated from 2 departments');
  await call('POST', `/attendance/timesheets/organization/${org.id}/submit`);
  await login('ceo@demo.uz');
  const approved = await call('POST', `/attendance/timesheets/organization/${org.id}/decide`, { decision: 'APPROVED' });
  ok(approved.status === 'APPROVED', 'CEO approved org timesheet');
  const daily = await call('GET', '/attendance/records/daily', undefined, { date: new Date().toISOString().slice(0, 10) });
  ok(daily.length > 0, `daily attendance rows (${daily.length})`);
  const xlsx = await call('GET', '/attendance/records/daily/export', undefined, { date: new Date().toISOString().slice(0, 10) });
  ok(xlsx instanceof Blob && xlsx.size > 500, `excel export blob (${xlsx.size} bayt)`);

  // --- L&D: material, tayinlash, qoida, xodim progressi
  await login('hr@demo.uz');
  const mat = await call('POST', '/learning-admin/catalog', {
    title: 'Demo kurs',
    type: 'COURSE',
    contentUrl: 'https://example.com/kurs',
    status: 'PUBLISHED',
    assignment: { mode: 'ONE_TIME', sameAsVisibility: false, departmentIds: [myEmp.departmentId], reason: 'DEVELOPMENT', dueInDays: 7 },
  });
  ok(mat.assignmentResult?.ok, `material published + assigned: ${mat.assignmentResult?.message}`);
  const batches = await call('GET', '/learning-admin/batches', undefined, { materialId: mat.id });
  ok(batches.rows.length === 1 && batches.rows[0].total > 0, 'batch listed with assignees');
  const rule = await call('POST', '/learning-admin/rules?activate=1', {
    name: 'Moliya uchun Excel',
    type: 'PERMANENT',
    departmentIds: [others[0].id],
    reason: 'POSITION',
    dueInDays: 14,
  });
  ok(rule.rule.status === 'ACTIVE', 'global rule created');
  const attach = await call('POST', `/learning-admin/catalog/${mat.id}/rules/${rule.rule.id}`);
  ok(attach.assigned > 0, `rule attached and assigned ${attach.assigned}`);
  const rules = await call('GET', '/learning-admin/rules');
  ok(rules.length === 2, 'rules list');
  await login('xodim@demo.uz');
  const mine = await call('GET', '/learning/my/assignments');
  ok(mine.some((m: any) => m.id === mat.id), 'employee sees new assignment');
  await call('POST', `/learning/materials/${mat.id}/start`);
  await call('PUT', `/learning/materials/${mat.id}/progress`, { progress: 100 });
  const completed = await call('GET', '/learning/my/progress', undefined, { status: 'COMPLETED' });
  ok(completed.some((m: any) => m.id === mat.id), 'completion recorded');
  const neg = (await call('GET', '/learning/materials')).find((m: any) => m.title === 'Samarali muzokara olib borish');
  const detail = await call('GET', `/learning/materials/${neg.id}`);
  ok(detail.hasAccess === false && detail.contentUrl === null, 'approval-gated material hides content');
  await call('POST', '/learning/requests', { materialId: neg.id, comment: 'Iltimos' });
  const goal = await call('POST', '/learning/goals', { title: 'Yangi maqsad', materialIds: [mat.id] });
  const goals = await call('GET', '/learning/my/goals');
  ok(goals.find((g: any) => g.id === goal.id)?.completedCount === 1, 'goal tracks completed material');
  const events = await call('GET', '/learning/events');
  const open = events.find((e: any) => !e.requiresApproval);
  await call('POST', `/learning/events/${open.id}/register`);
  ok((await call('GET', '/learning/events', undefined, { scope: 'mine' })).length === 1, 'event registration');

  // Ruxsat tekshiruvi
  await call('GET', '/learning-admin/catalog').then(
    () => ok(false, 'employee blocked from admin'),
    (e) => ok(String(e.message).includes('403'), 'employee blocked from admin'),
  );
  console.log('\nHammasi joyida.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
