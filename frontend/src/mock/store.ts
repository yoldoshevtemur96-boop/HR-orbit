// Demo rejim uchun brauzer ichidagi "ma'lumotlar bazasi".
// Backend (Supabase/Postgres) ulanmagan holatda UI to'liq ishlashi uchun
// backend/prisma/seed.ts dagi ma'lumotlarga mos boshlang'ich ma'lumotlar
// yaratiladi va localStorage'da saqlanadi.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Row = Record<string, any>;

export interface DemoDb {
  version: number;
  seededAt: string;
  organization: Row;
  users: Row[];
  employees: Row[];
  departments: Row[];
  branches: Row[];
  positions: Row[];
  employmentRecords: Row[];
  educations: Row[];
  documents: Row[];
  attendanceSettings: Row;
  attendanceRecords: Row[];
  cellEdits: Row[];
  departmentTimesheets: Row[];
  organizationTimesheets: Row[];
  workflowTemplates: Row[];
  workflowInstances: Row[];
  workflowStepActions: Row[];
  notifications: Row[];
  materials: Row[];
  progress: Row[];
  favorites: Row[];
  assignments: Row[];
  batches: Row[];
  rules: Row[];
  ruleMaterials: Row[];
  events: Row[];
  registrations: Row[];
  requests: Row[];
  goals: Row[];
  recommendations: Row[];
  files: Row[];
}

const STORAGE_KEY = 'hr-orbit-demo-db';
const DB_VERSION = 1;

let counter = 0;
export function newId(): string {
  counter += 1;
  return `c${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const nowIso = () => new Date().toISOString();

/** Sana (kun) — UTC yarim tun, backenddagi `date` ustunlari kabi */
export function dayIso(y: number, m0: number, d: number) {
  return new Date(Date.UTC(y, m0, d)).toISOString();
}

function daysFromNow(days: number, hour = 10) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour - 5, 0, 0, 0); // Toshkent vaqti (UTC+5)
  return d.toISOString();
}

function hashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  return hash;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

function seed(): DemoDb {
  const orgId = 'org_demo';
  const now = nowIso();
  const hired = new Date();
  hired.setUTCMonth(hired.getUTCMonth() - 6);
  const hiredAt = hired.toISOString();

  const db: DemoDb = {
    version: DB_VERSION,
    seededAt: now,
    organization: { id: orgId, name: 'Demo Kompaniya', slug: 'demo', plan: 'trial' },
    users: [],
    employees: [],
    departments: [],
    branches: [],
    positions: [],
    employmentRecords: [],
    educations: [],
    documents: [],
    attendanceSettings: {
      id: newId(),
      organizationId: orgId,
      standardStartTime: '09:00',
      standardEndTime: '18:00',
      standardWorkMinutes: 480,
      lateThresholdMinutes: 10,
      updatedAt: now,
    },
    attendanceRecords: [],
    cellEdits: [],
    departmentTimesheets: [],
    organizationTimesheets: [],
    workflowTemplates: [],
    workflowInstances: [],
    workflowStepActions: [],
    notifications: [],
    materials: [],
    progress: [],
    favorites: [],
    assignments: [],
    batches: [],
    rules: [],
    ruleMaterials: [],
    events: [],
    registrations: [],
    requests: [],
    goals: [],
    recommendations: [],
    files: [],
  };

  const mkDept = (name: string, code: string) => {
    const d: Row = { id: newId(), organizationId: orgId, name, code, parentId: null, headEmployeeId: null, status: 'ACTIVE', archivedAt: null, createdAt: now };
    db.departments.push(d);
    return d;
  };
  const mkBranch = (name: string, code: string, region: string, address: string) => {
    const b: Row = { id: newId(), organizationId: orgId, name, code, region, address, managerId: null, status: 'ACTIVE', archivedAt: null, createdAt: now };
    db.branches.push(b);
    return b;
  };
  const mkPos = (departmentId: string, branchId: string, name: string, code: string, grade: string, approvedHeadcount: number) => {
    const p = { id: newId(), organizationId: orgId, departmentId, branchId, name, code, grade, approvedHeadcount, status: 'ACTIVE', archivedAt: null, createdAt: now };
    db.positions.push(p);
    return p;
  };

  const it = mkDept("IT bo'limi", 'IT');
  const hq = mkBranch('Toshkent bosh ofis', 'TSH-HQ', 'Toshkent', "Toshkent sh., Amir Temur ko'chasi");
  mkBranch('Samarqand filiali', 'SMQ-01', 'Samarqand', "Samarqand sh., Registon ko'chasi, 12");

  const ceoPos = mkPos(it.id, hq.id, 'Bosh direktor', 'CEO', 'C-Level', 1);
  const hrHeadPos = mkPos(it.id, hq.id, "Kadrlar bo'limi boshlig'i", 'HR-HEAD', 'Boshliq', 1);
  const legalPos = mkPos(it.id, hq.id, 'Yurist', 'LEGAL-1', 'Mutaxassis', 1);
  const itHeadPos = mkPos(it.id, hq.id, "IT bo'limi boshlig'i", 'IT-HEAD', 'Boshliq', 1);
  const devPos = mkPos(it.id, hq.id, 'Backend dasturchi', 'BE-DEV', 'Grade 1', 3);
  const tkPos = mkPos(it.id, hq.id, 'Tabelchi', 'TIMEKEEPER-1', 'Mutaxassis', 1);

  let empCounter = 1;
  const femaleNames = new Set(['Malika', 'Nilufar', 'Dilnoza', 'Gulnora', 'Madina', 'Zarina', 'Kamola', 'Nigora', 'Aziza', 'Sevinch', 'Shoira', 'Nodira', 'Feruza']);

  const mkEmployee = (opts: {
    firstName: string;
    lastName: string;
    departmentId: string;
    positionId: string;
    managerId: string | null;
    email?: string;
    role?: string;
  }) => {
    const code = `EMP-${String(empCounter++).padStart(5, '0')}`;
    const h = hashCode(code);
    const id = newId();
    let userId: string | null = null;
    if (opts.email && opts.role) {
      userId = newId();
      db.users.push({ id: userId, organizationId: orgId, email: opts.email, role: opts.role, isActive: true, employeeId: id });
    }
    const birthYear = 1975 + (h % 25);
    const emp = {
      id,
      organizationId: orgId,
      userId,
      employeeCode: code,
      firstName: opts.firstName,
      lastName: opts.lastName,
      middleName: null,
      fullName: `${opts.firstName} ${opts.lastName}`,
      dateOfBirth: dayIso(birthYear, h % 12, 1 + (h % 27)),
      gender: femaleNames.has(opts.firstName) ? 'FEMALE' : 'MALE',
      pinfl: String(30000000000000 + (h % 9999999999)).slice(0, 14),
      passportNumber: `AD${String(1000000 + (h % 8999999))}`,
      personalPhone: `+998 9${h % 10} ${String(100 + (h % 899))}-${String(10 + (h % 89))}-${String(10 + ((h >> 3) % 89))}`,
      workPhone: null,
      personalEmail: null,
      workEmail: opts.email ?? null,
      address: 'Toshkent sh.',
      emergencyContactName: null,
      emergencyContactPhone: null,
      departmentId: opts.departmentId,
      branchId: hq.id,
      positionId: opts.positionId,
      managerId: opts.managerId,
      status: 'ACTIVE',
      employmentType: 'FULL_TIME',
      contractNumber: `MSH-${code.slice(4)}`,
      contractStartDate: hiredAt,
      contractEndDate: null,
      workSchedule: '5/2, 09:00–18:00',
      workLocation: 'Bosh ofis',
      hiredAt,
      createdAt: hiredAt,
      updatedAt: hiredAt,
    };
    db.employees.push(emp);
    db.employmentRecords.push({
      id: newId(),
      organizationId: orgId,
      employeeId: id,
      positionId: opts.positionId,
      departmentId: opts.departmentId,
      branchId: hq.id,
      managerId: opts.managerId,
      startDate: hiredAt,
      endDate: null,
      reason: "Boshlang'ich ma'lumot",
      changedByUserId: null,
    });
    return emp;
  };

  const ceo = mkEmployee({ firstName: 'Aziz', lastName: 'Rahbarov', departmentId: it.id, positionId: ceoPos.id, managerId: null, email: 'ceo@demo.uz', role: 'SUPER_ADMIN' });
  const hr = mkEmployee({ firstName: 'Malika', lastName: 'Kadrova', departmentId: it.id, positionId: hrHeadPos.id, managerId: ceo.id, email: 'hr@demo.uz', role: 'HR_MANAGER' });
  const legal = mkEmployee({ firstName: 'Jasur', lastName: 'Yuristov', departmentId: it.id, positionId: legalPos.id, managerId: ceo.id, email: 'legal@demo.uz', role: 'EMPLOYEE' });
  const head = mkEmployee({ firstName: 'Olim', lastName: 'Boshliqov', departmentId: it.id, positionId: itHeadPos.id, managerId: ceo.id, email: 'boshliq@demo.uz', role: 'DEPARTMENT_HEAD' });
  it.headEmployeeId = head.id;
  db.branches[0].managerId = ceo.id;
  const xodim = mkEmployee({ firstName: 'Bekzod', lastName: 'Dasturchi', departmentId: it.id, positionId: devPos.id, managerId: head.id, email: 'xodim@demo.uz', role: 'EMPLOYEE' });
  const tabelchi = mkEmployee({ firstName: 'Nilufar', lastName: 'Tabelova', departmentId: it.id, positionId: tkPos.id, managerId: hr.id, email: 'tabelchi@demo.uz', role: 'TIMEKEEPER' });

  const blueprints = [
    { name: "Moliya bo'limi", code: 'FIN', head: ['Dilnoza', 'Qosimova'], email: 'moliya.boshliq@demo.uz', headPos: ["Moliya bo'limi boshlig'i", 'FIN-HEAD'], staffPos: ['Moliyachi', 'FIN-STAFF'], staff: [['Shahzod', 'Umarov'], ['Gulnora', 'Tosheva'], ['Farrux', 'Yusupov'], ['Madina', 'Sodiqova']] },
    { name: "Marketing bo'limi", code: 'MKT', head: ['Javlon', 'Ergashev'], email: 'marketing.boshliq@demo.uz', headPos: ["Marketing bo'limi boshlig'i", 'MKT-HEAD'], staffPos: ['Marketing mutaxassisi', 'MKT-STAFF'], staff: [['Zarina', 'Nazarova'], ['Sardor', 'Aliqulov'], ['Kamola', 'Rustamova'], ['Otabek', 'Xolmatov'], ['Nigora', 'Saidova']] },
    { name: "Sotuv bo'limi", code: 'SLS', head: ['Bahodir', 'Nematov'], email: 'sotuv.boshliq@demo.uz', headPos: ["Sotuv bo'limi boshlig'i", 'SLS-HEAD'], staffPos: ['Sotuv menejeri', 'SLS-STAFF'], staff: [['Aziza', 'Qodirova'], ['Jasur', 'Mirzayev'], ['Dilshod', 'Ravshanov'], ['Sevinch', 'Bekova'], ["Ulug'bek", 'Tursunov'], ['Shoira', 'Ahmedova']] },
    { name: "Yuridik bo'lim", code: 'LGL', head: ['Nodira', 'Yoqubova'], email: 'yuridik.boshliq@demo.uz', headPos: ["Yuridik bo'lim boshlig'i", 'LGL-HEAD'], staffPos: ['Yurist', 'LGL-STAFF'], staff: [['Rustam', 'Davronov'], ['Feruza', 'Ismoilova'], ['Akmal', 'Sultonov']] },
  ];
  for (const bp of blueprints) {
    const dept = mkDept(bp.name, bp.code);
    const headPosition = mkPos(dept.id, hq.id, bp.headPos[0], bp.headPos[1], 'Boshliq', 1);
    const staffPosition = mkPos(dept.id, hq.id, bp.staffPos[0], bp.staffPos[1], 'Mutaxassis', bp.staff.length + 1);
    const deptHead = mkEmployee({ firstName: bp.head[0], lastName: bp.head[1], departmentId: dept.id, positionId: headPosition.id, managerId: ceo.id, email: bp.email, role: 'DEPARTMENT_HEAD' });
    dept.headEmployeeId = deptHead.id;
    for (const [firstName, lastName] of bp.staff) {
      mkEmployee({ firstName, lastName, departmentId: dept.id, positionId: staffPosition.id, managerId: deptHead.id });
    }
  }

  // Ta'lim va hujjatlar (bir nechta xodim uchun namunaviy)
  for (const emp of [xodim, head, hr, legal]) {
    db.educations.push({
      id: newId(),
      organizationId: orgId,
      employeeId: emp.id,
      level: 'Oliy (bakalavr)',
      institution: emp === legal ? "Toshkent davlat yuridik universiteti" : 'Toshkent axborot texnologiyalari universiteti',
      specialty: emp === legal ? 'Huquqshunoslik' : 'Dasturiy injiniring',
      graduationYear: 2012 + (hashCode(emp.id) % 10),
      createdAt: now,
    });
  }
  const hrUserId = hr.userId;
  for (const emp of db.employees) {
    db.documents.push(
      { id: newId(), organizationId: orgId, employeeId: emp.id, name: 'Mehnat shartnomasi', fileUrl: 'https://example.com/hujjatlar/mehnat-shartnomasi.pdf', uploadedByUserId: hrUserId, createdAt: hiredAt },
      { id: newId(), organizationId: orgId, employeeId: emp.id, name: 'Ishga qabul qilish buyrug‘i', fileUrl: 'https://example.com/hujjatlar/buyruq.pdf', uploadedByUserId: hrUserId, createdAt: hiredAt },
    );
  }

  // --- Davomat: o'tgan oy + joriy oy (bugungacha) -------------------------
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    const dateIso = dayIso(y, m, day);
    for (const emp of db.employees) {
      const roll = hashCode(`${emp.employeeCode}-${dateIso.slice(0, 10)}`) % 100;
      const base = { id: newId(), organizationId: orgId, employeeId: emp.id, date: dateIso, source: 'DEVICE', note: null, editedByUserId: null };
      if (roll < 3) {
        db.attendanceRecords.push({ ...base, checkInTime: null, checkOutTime: null, status: 'SICK', lateMinutes: 0, earlyLeaveMinutes: 0, workedMinutes: 0, overtimeMinutes: 0 });
        continue;
      }
      if (roll < 6) {
        db.attendanceRecords.push({ ...base, checkInTime: null, checkOutTime: null, status: 'ABSENT', lateMinutes: 0, earlyLeaveMinutes: 0, workedMinutes: 0, overtimeMinutes: 0 });
        continue;
      }
      const late = roll < 20 ? 5 + (roll % 25) : 0;
      const early = roll >= 90 ? 10 + (roll % 20) : 0;
      const isToday = y === today.getUTCFullYear() && m === today.getUTCMonth() && day === today.getUTCDate();
      const checkIn = new Date(y, m, day, 9, Math.min(late, 59));
      const checkOut = new Date(y, m, day, 18, 0);
      checkOut.setMinutes(checkOut.getMinutes() - early);
      const hasCheckout = !isToday || today.getHours() >= 18;
      const worked = hasCheckout ? Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60000)) : 0;
      let status = 'PRESENT';
      if (late > 10) status = 'LATE';
      else if (early > 0 && hasCheckout) status = 'EARLY_LEAVE';
      db.attendanceRecords.push({
        ...base,
        checkInTime: checkIn.toISOString(),
        checkOutTime: hasCheckout ? checkOut.toISOString() : null,
        status,
        lateMinutes: late > 10 ? late : 0,
        earlyLeaveMinutes: hasCheckout ? early : 0,
        workedMinutes: worked,
        overtimeMinutes: Math.max(0, worked - 480),
      });
    }
  }

  // --- Workflow shablonlari -------------------------------------------------
  const tpl = (name: string, description: string, formSchema: any[], documentBody: string, steps: any[]) => {
    const t = {
      id: newId(),
      organizationId: orgId,
      name,
      description,
      formSchema,
      documentBody,
      isActive: true,
      createdAt: now,
      steps: steps.map((s, i) => ({ id: newId(), order: i + 1, approverRole: null, approverUserId: null, actionType: 'APPROVE', ...s })),
    };
    db.workflowTemplates.push(t);
    return t;
  };
  const dates = [
    { key: 'startDate', label: 'Boshlanish sanasi', type: 'date', required: true },
    { key: 'endDate', label: 'Tugash sanasi', type: 'date', required: true },
  ];
  const mgr = { name: "Bevosita rahbar tasdig'i", approverType: 'DIRECT_MANAGER' };
  const hrStep = { name: "Kadrlar bo'limi tasdig'i", approverType: 'ROLE', approverRole: 'HR_MANAGER' };

  const vacationTpl = tpl(
    "Mehnat ta'tiliga chiqish arizasi",
    "Xodim ta'til sanalarini tanlaydi, ariza avtomatik shakllanadi va zanjir bo'yicha aylanadi.",
    [...dates, { key: 'daysCount', label: 'Kunlar soni', type: 'number', required: true }, { key: 'note', label: 'Izoh', type: 'textarea', required: false }],
    "{{employeeName}} mehnat ta'tiliga {{startDate}} sanasidan {{endDate}} sanasigacha ({{daysCount}} kun) chiqishini so'raydi.\nIzoh: {{note}}",
    [
      { name: "Bo'lim boshlig'i tasdig'i", approverType: 'DIRECT_MANAGER' },
      { name: "Kadrlar bo'limi tekshiruvi", approverType: 'ROLE', approverRole: 'HR_MANAGER' },
      { name: "Yurist tasdig'i", approverType: 'SPECIFIC_USER', approverUserId: legal.userId },
      { name: 'Rahbar imzosi', approverType: 'ROLE', approverRole: 'SUPER_ADMIN' },
    ],
  );
  const annualTpl = tpl(
    "Yillik mehnat ta'tili",
    "Yillik ta'til uchun standart ariza.",
    [...dates, { key: 'daysCount', label: 'Kunlar soni', type: 'number', required: true }, { key: 'note', label: 'Izoh', type: 'textarea', required: false }],
    "{{employeeName}} yillik mehnat ta'tiliga {{startDate}} dan {{endDate}} gacha ({{daysCount}} kun) chiqishini so'raydi.\nIzoh: {{note}}",
    [mgr, hrStep],
  );
  tpl(
    "Haq to'lanmaydigan ta'til",
    "Haq to'lanmaydigan ta'til uchun ariza.",
    [...dates, { key: 'reason', label: 'Sabab', type: 'textarea', required: true }],
    "{{employeeName}} haq to'lanmaydigan ta'tilga {{startDate}} dan {{endDate}} gacha chiqishini so'raydi.\nSabab: {{reason}}",
    [mgr, hrStep],
  );
  tpl(
    "O'qish ta'tili",
    "Ta'lim muassasasida o'qish bilan bog'liq ta'til.",
    [...dates, { key: 'institution', label: "Ta'lim muassasasi", type: 'text', required: true }, { key: 'note', label: 'Izoh', type: 'textarea', required: false }],
    "{{employeeName}} o'qish ta'tiliga {{startDate}} dan {{endDate}} gacha ({{institution}}) chiqishini so'raydi.",
    [mgr, hrStep],
  );
  tpl(
    "Homiladorlik va bola parvarishi ta'tili",
    "Homiladorlik yoki bola parvarishi bilan bog'liq ta'til.",
    [...dates, { key: 'note', label: 'Izoh', type: 'textarea', required: false }],
    "{{employeeName}} homiladorlik/bola parvarishi ta'tiliga {{startDate}} dan {{endDate}} gacha chiqishini so'raydi.",
    [hrStep],
  );
  tpl(
    "Shaxsiy ma'lumotni o'zgartirish",
    "Kontakt ma'lumotlarini o'zgartirish so'rovi — HR tasdiqlagach qo'lda qo'llaniladi.",
    [
      { key: 'field', label: 'Qaysi maydon', type: 'select', required: true, options: ['personalPhone', 'personalEmail', 'address', 'emergencyContactName', 'emergencyContactPhone'] },
      { key: 'oldValue', label: 'Joriy qiymat', type: 'text', required: false },
      { key: 'newValue', label: 'Yangi qiymat', type: 'text', required: true },
      { key: 'reason', label: 'Sabab', type: 'textarea', required: true },
    ],
    '{{employeeName}} "{{field}}" maydonini "{{oldValue}}" dan "{{newValue}}" ga o\'zgartirishni so\'raydi.\nSabab: {{reason}}',
    [hrStep],
  );
  tpl(
    "Bank rekvizitlarini o'zgartirish",
    "Ish haqi o'tkaziladigan bank ma'lumotlarini yangilash so'rovi.",
    [
      { key: 'bankName', label: 'Bank nomi', type: 'text', required: true },
      { key: 'accountNumber', label: 'Hisob raqami', type: 'text', required: true },
      { key: 'reason', label: 'Sabab', type: 'textarea', required: true },
    ],
    "{{employeeName}} bank rekvizitlarini o'zgartirishni so'raydi: {{bankName}}, hisob raqami {{accountNumber}}.\nSabab: {{reason}}",
    [hrStep],
  );
  const otherTpl = tpl(
    "Boshqa HR so'rovi",
    "Ma'lumotnoma, shartnoma nusxasi va boshqa hujjat/so'rovlar uchun (HR Services).",
    [
      { key: 'requestType', label: "So'rov turi", type: 'select', required: true, options: ["Ma'lumotnoma", 'Mehnat shartnomasi nusxasi', "Boshqa hujjat/so'rov"] },
      { key: 'details', label: 'Tafsilotlar', type: 'textarea', required: true },
    ],
    "{{employeeName}} quyidagi so'rovni yubordi: {{requestType}}.\nTafsilotlar: {{details}}",
    [hrStep],
  );

  // Namunaviy arizalar: biri jarayonda (boshliqda), biri tasdiqlangan, biri HR'da
  const mkInstance = (template: any, emp: any, formData: any, decided: number, status: string, createdDaysAgo: number) => {
    const instanceId = newId();
    const createdAt = daysFromNow(-createdDaysAgo, 11);
    const body = String(template.documentBody).replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String({ ...formData, employeeName: emp.fullName }[k] ?? ''));
    db.workflowInstances.push({
      id: instanceId,
      organizationId: orgId,
      templateId: template.id,
      initiatorUserId: emp.userId,
      employeeId: emp.id,
      formData: { ...formData, employeeName: emp.fullName },
      generatedDocument: body,
      currentStepOrder: Math.min(decided + 1, template.steps.length),
      status,
      createdAt,
      updatedAt: createdAt,
    });
    for (const step of template.steps) {
      const assigned = resolveApproverSeed(db, emp, step);
      const done = step.order <= decided;
      db.workflowStepActions.push({
        id: newId(),
        instanceId,
        stepId: step.id,
        assignedUserId: assigned,
        status: done ? 'APPROVED' : 'PENDING',
        comment: done ? 'Tasdiqlandi' : null,
        actedAt: done ? daysFromNow(-createdDaysAgo + step.order, 15) : null,
        createdAt,
      });
    }
    return instanceId;
  };
  const inProgressId = mkInstance(annualTpl, xodim, { startDate: daysFromNow(14).slice(0, 10), endDate: daysFromNow(28).slice(0, 10), daysCount: 15, note: 'Oilaviy sayohat' }, 0, 'IN_PROGRESS', 1);
  mkInstance(otherTpl, xodim, { requestType: "Ma'lumotnoma", details: 'Bankka taqdim etish uchun ish joyidan ma’lumotnoma' }, 1, 'APPROVED', 9);
  const atHrId = mkInstance(vacationTpl, legal, { startDate: daysFromNow(20).slice(0, 10), endDate: daysFromNow(34).slice(0, 10), daysCount: 15, note: '' }, 1, 'IN_PROGRESS', 3);

  const notify = (userId: string | null, type: string, message: string, entityType: string | null, entityId: string | null, daysAgo: number, isRead = false) => {
    if (!userId) return;
    db.notifications.push({ id: newId(), organizationId: orgId, userId, type, message, entityType, entityId, isRead, createdAt: daysFromNow(-daysAgo, 12) });
  };
  notify(head.userId, 'REQUEST_SUBMITTED', `${annualTpl.name} arizasi tasdiqlash uchun yuborildi`, 'WorkflowInstance', inProgressId, 1);
  notify(hr.userId, 'REQUEST_SUBMITTED', `${vacationTpl.name} arizasi tasdiqlash uchun yuborildi`, 'WorkflowInstance', atHrId, 2);

  // --- Learning --------------------------------------------------------------
  const MATERIALS: any[] = [
    { title: 'Menejment formulasi', description: "Jamoani boshqarish, maqsad qo'yish va natijani nazorat qilishning asosiy tamoyillari.", type: 'VIDEO', durationMinutes: 180, author: 'HR Orbit akademiyasi', tags: ['menejment', 'liderlik'], contentUrl: 'https://www.youtube.com/results?search_query=management+fundamentals', daysAgo: 2 },
    { title: 'Menejment formulasi: qisqa audio', description: 'Yo‘lda tinglash uchun menejment asoslari bo‘yicha qisqa audio dars.', type: 'AUDIO', durationMinutes: 13, author: 'HR Orbit akademiyasi', tags: ['menejment', 'audio'], contentUrl: 'https://www.youtube.com/results?search_query=management+podcast', daysAgo: 1 },
    { title: 'Mijozni ishlab chiqish jarayoniga jalb qiling', description: 'Mahsulotni mijoz bilan birga yaratish: intervyu, prototip va tezkor fikr-mulohaza.', type: 'BOOK', durationMinutes: 180, author: 'Stiv Blank', tags: ['mahsulot', 'mijoz'], contentUrl: 'https://en.wikipedia.org/wiki/Customer_development', daysAgo: 5 },
    { title: 'Inson va biznes rivoji uchun muhit arxitekturasi', description: "Tashkilot ichida o'rganish va rivojlanishni qo'llab-quvvatlovchi muhitni qanday qurish kerak.", type: 'COURSE', durationMinutes: 180, author: 'HR Orbit akademiyasi', tags: ['tashkilot', 'rivojlanish'], contentUrl: 'https://en.wikipedia.org/wiki/Learning_organization', daysAgo: 9 },
    { title: '21-asrda mijozga yo‘naltirilgan raqamli mahsulot dizayni', description: 'Raqamli mahsulotlarni foydalanuvchi ehtiyojidan kelib chiqib loyihalash.', type: 'VIDEO', durationMinutes: 180, author: 'Dizayn maktabi', tags: ['dizayn', 'ux'], contentUrl: 'https://www.youtube.com/results?search_query=customer+centric+product+design', daysAgo: 12 },
    { title: 'Tashqi kutubxonalarni boshqarish', description: 'Dasturiy loyihalarda tashqi kutubxonalarni tanlash, yangilash va xavfsizligini nazorat qilish.', type: 'ARTICLE', durationMinutes: 15, author: 'IT bo‘limi', tags: ['dasturlash', 'xavfsizlik'], contentUrl: 'https://en.wikipedia.org/wiki/Software_supply_chain', daysAgo: 3 },
    { title: 'To‘lqin ustida: texnologiya, hokimiyat va buyuk dilemma', description: "Sun'iy intellekt va yangi texnologiyalarning jamiyatga ta'siri haqida kitob.", type: 'BOOK', durationMinutes: 420, author: 'Mustafo Sulaymon', tags: ['texnologiya', 'ai'], contentUrl: 'https://en.wikipedia.org/wiki/The_Coming_Wave', daysAgo: 4 },
    { title: 'Samarali muzokara olib borish', description: "Muzokaraga tayyorlanish, manfaatlarni aniqlash va g'alaba-g'alaba yechim topish.", type: 'COURSE', durationMinutes: 240, author: 'Biznes maktabi', tags: ['muloqot', 'sotuv'], contentUrl: 'https://en.wikipedia.org/wiki/Negotiation', requiresApproval: true, daysAgo: 6 },
    { title: 'Vaqtni boshqarish: 5 ta amaliy usul', description: 'Pomodoro, Eyzenxauer matritsasi va boshqa usullar bilan kunni rejalashtirish.', type: 'ARTICLE', durationMinutes: 10, author: 'HR bo‘limi', tags: ['samaradorlik'], contentUrl: 'https://en.wikipedia.org/wiki/Time_management', daysAgo: 7 },
    { title: 'Hissiy intellekt ish joyida', description: "O'z his-tuyg'ularini boshqarish va hamkasblar bilan samarali munosabat qurish.", type: 'AUDIO', durationMinutes: 45, author: 'Psixologiya markazi', tags: ['soft skills', 'liderlik'], contentUrl: 'https://en.wikipedia.org/wiki/Emotional_intelligence', daysAgo: 8 },
    { title: 'Excel: moliyaviy tahlil asoslari', description: 'Jadval, formulalar va pivot jadvallar yordamida moliyaviy hisobotlarni tahlil qilish.', type: 'COURSE', durationMinutes: 300, author: 'Moliya bo‘limi', tags: ['excel', 'moliya'], contentUrl: 'https://www.youtube.com/results?search_query=excel+financial+analysis', daysAgo: 10 },
    { title: 'Axborot xavfsizligi: har bir xodim bilishi shart', description: 'Fishing, parollar va maxfiy ma’lumotlar bilan ishlash qoidalari. Barcha xodimlar uchun majburiy.', type: 'VIDEO', durationMinutes: 30, author: 'IT bo‘limi', tags: ['xavfsizlik', 'majburiy'], contentUrl: 'https://www.youtube.com/results?search_query=information+security+awareness+training', daysAgo: 14 },
  ];
  for (const m of MATERIALS) {
    const { daysAgo, ...data } = m;
    const publishedAt = daysFromNow(-daysAgo);
    db.materials.push({
      id: newId(),
      organizationId: orgId,
      description: null,
      coverUrl: null,
      contentUrl: null,
      durationMinutes: 0,
      author: null,
      tags: [],
      status: 'PUBLISHED',
      requiresApproval: false,
      contentSource: 'LINK',
      contentFileId: null,
      displayMode: 'NEW_TAB',
      completionRule: 'MANUAL',
      level: null,
      language: 'uz',
      allowDownload: true,
      visibility: 'ALL',
      visibleDepartmentIds: [],
      visiblePositionIds: [],
      visibleBranchIds: [],
      availableFrom: null,
      availableUntil: null,
      pendingAssignment: null,
      createdByUserId: hrUserId,
      createdAt: publishedAt,
      updatedAt: publishedAt,
      ...data,
      publishedAt,
    });
  }
  const byTitle = (t: string) => db.materials.find((m) => m.title === t)!;

  const ev = (e: any) => db.events.push({ id: newId(), organizationId: orgId, description: null, location: null, meetingUrl: null, speaker: null, coverUrl: null, capacity: null, requiresApproval: false, status: 'PUBLISHED', createdAt: now, updatedAt: now, ...e });
  ev({ title: 'Liderlik bo‘yicha amaliy trening', description: 'Yangi rahbarlar uchun ikki kunlik amaliy trening: jamoa bilan ishlash, fikr-mulohaza berish.', format: 'OFFLINE', location: 'Toshkent bosh ofis, 3-qavat konferens-zal', speaker: 'Dilnoza Qosimova', startsAt: daysFromNow(5, 10), endsAt: daysFromNow(5, 17), capacity: 20, requiresApproval: true });
  ev({ title: 'Vebinar: sun’iy intellekt kundalik ishda', description: 'ChatGPT va boshqa AI vositalaridan xavfsiz va samarali foydalanish.', format: 'ONLINE', meetingUrl: 'https://meet.google.com/', speaker: 'Olim Boshliqov', startsAt: daysFromNow(2, 15), endsAt: daysFromNow(2, 16) });
  ev({ title: 'Kitob klubi: “To‘lqin ustida”', description: 'Oyning kitobini birga muhokama qilamiz. Choy va pechenye bizdan.', format: 'OFFLINE', location: 'Kutubxona xonasi', startsAt: daysFromNow(9, 18), endsAt: daysFromNow(9, 19), capacity: 15 });
  ev({ title: 'Axborot xavfsizligi bo‘yicha yillik instruktaj', description: 'Barcha xodimlar uchun majburiy onlayn instruktaj.', format: 'ONLINE', meetingUrl: 'https://meet.google.com/', speaker: 'IT bo‘limi', startsAt: daysFromNow(14, 11), endsAt: daysFromNow(14, 12) });
  ev({ title: 'Muzokara san’ati: master-klass', description: "Sotuv va xarid bo'limlari uchun master-klass.", format: 'OFFLINE', location: 'Toshkent bosh ofis, 2-qavat', speaker: 'Bahodir Nematov', startsAt: daysFromNow(-7, 14), endsAt: daysFromNow(-7, 17) });

  const mkBatch = (name: string, material: any, reason: string, dueDate: string, note: string | null) => {
    const b = { id: newId(), organizationId: orgId, name, materialId: material.id, source: 'MANUAL', ruleId: null, reason, reasonText: null, note, dueDate, dueInDays: null, audienceSummary: 'Demo xodimlar', createdByUserId: hrUserId, createdAt: daysFromNow(-12), updatedAt: daysFromNow(-12) };
    db.batches.push(b);
    return b;
  };
  const security = byTitle('Axborot xavfsizligi: har bir xodim bilishi shart');
  const excel = byTitle('Excel: moliyaviy tahlil asoslari');
  const secBatch = mkBatch('Axborot xavfsizligi — barcha uchun majburiy', security, 'LEGAL', daysFromNow(10), 'Barcha xodimlar uchun majburiy');
  const excelBatch = mkBatch('Excel — moliyaviy tahlil', excel, 'DEVELOPMENT', daysFromNow(30), null);

  const learners = [xodim, head, hr, tabelchi];
  const inProgress: [string, number][] = [
    ['Inson va biznes rivoji uchun muhit arxitekturasi', 24],
    ['Mijozni ishlab chiqish jarayoniga jalb qiling', 72],
    ['Menejment formulasi', 5],
    ['21-asrda mijozga yo‘naltirilgan raqamli mahsulot dizayni', 48],
  ];
  for (const emp of learners) {
    for (const [title, progress] of inProgress) {
      db.progress.push({ id: newId(), organizationId: orgId, employeeId: emp.id, materialId: byTitle(title).id, progress, status: 'IN_PROGRESS', startedAt: daysFromNow(-10), lastOpenedAt: daysFromNow(-Math.round(progress / 20)), completedAt: null });
    }
    db.progress.push({ id: newId(), organizationId: orgId, employeeId: emp.id, materialId: byTitle('Vaqtni boshqarish: 5 ta amaliy usul').id, progress: 100, status: 'COMPLETED', startedAt: daysFromNow(-6), lastOpenedAt: daysFromNow(-5), completedAt: daysFromNow(-5) });
    const assignBase = { organizationId: orgId, employeeId: emp.id, assignedByUserId: hrUserId, reasonText: null, source: 'MANUAL', status: 'ACTIVE', cancelledAt: null, cancelledByUserId: null, reminderSentAt: null, remindBeforeDays: 3, remindAfterDays: null, reminderAfterSentAt: null, ruleId: null, createdAt: daysFromNow(-12), updatedAt: daysFromNow(-12) };
    db.assignments.push(
      { id: newId(), ...assignBase, materialId: security.id, dueDate: secBatch.dueDate, note: 'Barcha xodimlar uchun majburiy', reason: 'LEGAL', batchId: secBatch.id },
      { id: newId(), ...assignBase, materialId: excel.id, dueDate: excelBatch.dueDate, note: null, reason: 'DEVELOPMENT', batchId: excelBatch.id },
    );
    db.favorites.push(
      { id: newId(), organizationId: orgId, employeeId: emp.id, materialId: byTitle('To‘lqin ustida: texnologiya, hokimiyat va buyuk dilemma').id, createdAt: daysFromNow(-4) },
      { id: newId(), organizationId: orgId, employeeId: emp.id, materialId: byTitle('Hissiy intellekt ish joyida').id, createdAt: daysFromNow(-3) },
    );
    db.goals.push({
      id: newId(),
      organizationId: orgId,
      employeeId: emp.id,
      title: 'Jamoa rahbari bo‘lishga tayyorlanish',
      description: "Yil oxirigacha liderlik va menejment bo'yicha asosiy materiallarni o'zlashtirish.",
      dueDate: daysFromNow(90),
      status: 'ACTIVE',
      createdAt: daysFromNow(-15),
      materialIds: [byTitle('Menejment formulasi').id, byTitle('Hissiy intellekt ish joyida').id, byTitle('Vaqtni boshqarish: 5 ta amaliy usul').id],
    });
    notify(emp.userId, 'LEARNING_ASSIGNED', `Sizga yangi o'quv material tayinlandi: "${security.title}"`, 'LearningMaterial', security.id, 12, true);
  }

  const rec = (from: any, to: any, title: string, comment: string | null) =>
    db.recommendations.push({ id: newId(), organizationId: orgId, fromEmployeeId: from.id, toEmployeeId: to.id, materialId: byTitle(title).id, comment, dismissedAt: null, createdAt: daysFromNow(-2), updatedAt: daysFromNow(-2) });
  rec(head, xodim, 'Samarali muzokara olib borish', 'Mijozlar bilan uchrashuvlardan oldin albatta o‘tib chiq');
  rec(hr, xodim, 'To‘lqin ustida: texnologiya, hokimiyat va buyuk dilemma', 'Kitob klubida muhokama qilamiz');
  rec(tabelchi, xodim, 'Excel: moliyaviy tahlil asoslari', null);
  rec(xodim, head, 'Tashqi kutubxonalarni boshqarish', 'Jamoa uchun foydali bo‘ladi');
  rec(head, hr, 'Hissiy intellekt ish joyida', null);

  db.requests.push({ id: newId(), organizationId: orgId, employeeId: xodim.id, materialId: null, eventId: null, title: 'Coursera: Google Project Management', externalUrl: 'https://www.coursera.org/professional-certificates/google-project-management', comment: 'Loyiha boshqaruvini chuqurroq o‘rganmoqchiman', status: 'PENDING', decisionComment: null, decidedAt: null, createdAt: daysFromNow(-3) });

  // Namunaviy global qoida (yangi xodimlar uchun xavfsizlik kursi)
  const ruleId = newId();
  db.rules.push({
    id: ruleId,
    organizationId: orgId,
    name: 'Yangi xodimlar — majburiy kurslar',
    description: "Ishga kirganiga 30 kundan oshmagan barcha xodimlarga majburiy kurslar avtomatik tayinlanadi.",
    tag: 'onboarding',
    scope: 'GLOBAL',
    materialId: null,
    type: 'PERMANENT',
    allOrganization: true,
    departmentIds: [],
    positionIds: [],
    branchIds: [],
    hiredWithinDays: 30,
    employeeCodes: [],
    hiredFrom: null,
    hiredTo: null,
    notifyOnAssign: true,
    remindBeforeDays: 3,
    remindAfterDays: null,
    resetProgress: false,
    reason: 'ONBOARDING',
    reasonText: null,
    note: null,
    dueInDays: 14,
    dueDate: null,
    skipIfCompletedWithinDays: null,
    cancelOutOfScope: false,
    status: 'ACTIVE',
    createdByUserId: hrUserId,
    lastRunAt: now,
    createdAt: daysFromNow(-20),
    updatedAt: daysFromNow(-20),
  });
  db.ruleMaterials.push({ id: newId(), organizationId: orgId, ruleId, materialId: security.id, attachedByUserId: hrUserId, createdAt: daysFromNow(-20) });

  return db;
}

function resolveApproverSeed(db: DemoDb, emp: any, step: any): string | null {
  switch (step.approverType) {
    case 'SPECIFIC_USER':
      return step.approverUserId;
    case 'ROLE':
      return db.users.find((u) => u.role === step.approverRole && u.isActive)?.id ?? null;
    case 'DIRECT_MANAGER':
      return db.employees.find((e) => e.id === emp.managerId)?.userId ?? null;
    case 'DEPARTMENT_HEAD': {
      const dept = db.departments.find((d) => d.id === emp.departmentId);
      return db.employees.find((e) => e.id === dept?.headEmployeeId)?.userId ?? null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

let cache: DemoDb | null = null;

export function getDb(): DemoDb {
  if (cache) return cache;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoDb;
        if (parsed.version === DB_VERSION) {
          cache = parsed;
          return cache;
        }
      }
    } catch {
      // buzilgan yoki bo'sh — qaytadan yaratiladi
    }
  }
  cache = seed();
  saveDb();
  return cache;
}

export function saveDb() {
  if (!cache || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage to'lgan bo'lishi mumkin — demo xotirada ishlashda davom etadi
  }
}

export function resetDb() {
  cache = null;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  return getDb();
}
