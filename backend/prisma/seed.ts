// Test uchun boshlang'ich ma'lumotlar: bitta tashkilot, to'liq Core HR
// tuzilmasi (bo'lim, filial, lavozim, xodimlar + tashkiliy ierarxiya),
// va "Mehnat ta'tiliga chiqish arizasi" shablonining to'liq zanjiri.
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed boshlandi...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const org = await prisma.organization.create({
    data: { name: 'Demo Kompaniya', slug: 'demo', plan: 'trial' },
  });

  // --- Tashkiliy tuzilma: bo'lim, filial, lavozimlar -----------------------

  const department = await prisma.department.create({
    data: { organizationId: org.id, name: "IT bo'limi", code: 'IT' },
  });

  const branch = await prisma.branch.create({
    data: {
      organizationId: org.id,
      name: 'Toshkent bosh ofis',
      code: 'TSH-HQ',
      region: 'Toshkent',
      address: 'Toshkent sh., Amir Temur ko\'chasi',
    },
  });

  const ceoPosition = await prisma.position.create({
    data: {
      organizationId: org.id,
      departmentId: department.id,
      branchId: branch.id,
      name: 'Bosh direktor',
      code: 'CEO',
      grade: 'C-Level',
      approvedHeadcount: 1,
    },
  });

  const hrHeadPosition = await prisma.position.create({
    data: {
      organizationId: org.id,
      departmentId: department.id,
      branchId: branch.id,
      name: "Kadrlar bo'limi boshlig'i",
      code: 'HR-HEAD',
      grade: 'Boshliq',
      approvedHeadcount: 1,
    },
  });

  const legalPosition = await prisma.position.create({
    data: {
      organizationId: org.id,
      departmentId: department.id,
      branchId: branch.id,
      name: 'Yurist',
      code: 'LEGAL-1',
      grade: 'Mutaxassis',
      approvedHeadcount: 1,
    },
  });

  const itHeadPosition = await prisma.position.create({
    data: {
      organizationId: org.id,
      departmentId: department.id,
      branchId: branch.id,
      name: "IT bo'limi boshlig'i",
      code: 'IT-HEAD',
      grade: 'Boshliq',
      approvedHeadcount: 1,
    },
  });

  const devPosition = await prisma.position.create({
    data: {
      organizationId: org.id,
      departmentId: department.id,
      branchId: branch.id,
      name: 'Backend dasturchi',
      code: 'BE-DEV',
      grade: 'Grade 1',
      approvedHeadcount: 3,
    },
  });

  // --- Foydalanuvchilar va xodimlar ---------------------------------------

  const ceoUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'ceo@demo.uz',
      passwordHash,
      role: 'SUPER_ADMIN',
      employee: {
        create: {
          organizationId: org.id,
          employeeCode: 'EMP-00001',
          firstName: 'Aziz',
          lastName: 'Rahbarov',
          fullName: 'Aziz Rahbarov',
          workEmail: 'ceo@demo.uz',
          positionId: ceoPosition.id,
          departmentId: department.id,
          branchId: branch.id,
          status: 'ACTIVE',
          employmentType: 'FULL_TIME',
        },
      },
    },
    include: { employee: true },
  });

  const hrUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'hr@demo.uz',
      passwordHash,
      role: 'HR_MANAGER',
      employee: {
        create: {
          organizationId: org.id,
          employeeCode: 'EMP-00002',
          firstName: 'Malika',
          lastName: 'Kadrova',
          fullName: 'Malika Kadrova',
          workEmail: 'hr@demo.uz',
          positionId: hrHeadPosition.id,
          departmentId: department.id,
          branchId: branch.id,
          managerId: ceoUser.employee!.id,
          status: 'ACTIVE',
          employmentType: 'FULL_TIME',
        },
      },
    },
    include: { employee: true },
  });

  const legalUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'legal@demo.uz',
      passwordHash,
      role: 'EMPLOYEE',
      employee: {
        create: {
          organizationId: org.id,
          employeeCode: 'EMP-00003',
          firstName: 'Jasur',
          lastName: 'Yuristov',
          fullName: 'Jasur Yuristov',
          workEmail: 'legal@demo.uz',
          positionId: legalPosition.id,
          departmentId: department.id,
          branchId: branch.id,
          managerId: ceoUser.employee!.id,
          status: 'ACTIVE',
          employmentType: 'FULL_TIME',
        },
      },
    },
    include: { employee: true },
  });

  const deptHeadUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'boshliq@demo.uz',
      passwordHash,
      role: 'DEPARTMENT_HEAD',
      employee: {
        create: {
          organizationId: org.id,
          employeeCode: 'EMP-00004',
          firstName: 'Olim',
          lastName: 'Boshliqov',
          fullName: 'Olim Boshliqov',
          workEmail: 'boshliq@demo.uz',
          positionId: itHeadPosition.id,
          departmentId: department.id,
          branchId: branch.id,
          managerId: ceoUser.employee!.id,
          status: 'ACTIVE',
          employmentType: 'FULL_TIME',
        },
      },
    },
    include: { employee: true },
  });

  // Bo'lim va filial rahbarlarini bog'lash
  await prisma.department.update({
    where: { id: department.id },
    data: { headEmployeeId: deptHeadUser.employee!.id },
  });
  await prisma.branch.update({
    where: { id: branch.id },
    data: { managerId: ceoUser.employee!.id },
  });

  const employeeUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'xodim@demo.uz',
      passwordHash,
      role: 'EMPLOYEE',
      employee: {
        create: {
          organizationId: org.id,
          employeeCode: 'EMP-00005',
          firstName: 'Bekzod',
          lastName: 'Dasturchi',
          fullName: 'Bekzod Dasturchi',
          workEmail: 'xodim@demo.uz',
          positionId: devPosition.id,
          departmentId: department.id,
          branchId: branch.id,
          managerId: deptHeadUser.employee!.id, // bevosita rahbari — DIRECT_MANAGER shu orqali topiladi
          status: 'ACTIVE',
          employmentType: 'FULL_TIME',
        },
      },
    },
    include: { employee: true },
  });

  // --- Har bir xodim uchun boshlang'ich EmploymentRecord (tarix) ----------

  const allEmployees = [
    { user: ceoUser, positionId: ceoPosition.id, managerId: null },
    { user: hrUser, positionId: hrHeadPosition.id, managerId: ceoUser.employee!.id },
    { user: legalUser, positionId: legalPosition.id, managerId: ceoUser.employee!.id },
    { user: deptHeadUser, positionId: itHeadPosition.id, managerId: ceoUser.employee!.id },
    { user: employeeUser, positionId: devPosition.id, managerId: deptHeadUser.employee!.id },
  ];

  for (const { user, positionId, managerId } of allEmployees) {
    await prisma.employmentRecord.create({
      data: {
        organizationId: org.id,
        employeeId: user.employee!.id,
        positionId,
        departmentId: department.id,
        branchId: branch.id,
        managerId,
        startDate: user.employee!.hiredAt,
        endDate: null,
        reason: "Boshlang'ich ma'lumot",
      },
    });
  }

  // --- Workflow shabloni: Mehnat ta'tiliga chiqish arizasi ----------------

  const template = await prisma.workflowTemplate.create({
    data: {
      organizationId: org.id,
      name: 'Mehnat ta\'tiliga chiqish arizasi',
      description: 'Xodim ta\'til sanalarini tanlaydi, ariza avtomatik shakllanadi va zanjir bo\'yicha aylanadi.',
      formSchema: [
        { key: 'startDate', label: 'Boshlanish sanasi', type: 'date', required: true },
        { key: 'endDate', label: 'Tugash sanasi', type: 'date', required: true },
        { key: 'daysCount', label: 'Kunlar soni', type: 'number', required: true },
        { key: 'note', label: 'Izoh', type: 'textarea', required: false },
      ],
      documentBody:
        '{{employeeName}} mehnat ta\'tiliga {{startDate}} sanasidan {{endDate}} sanasigacha ({{daysCount}} kun) chiqishini so\'raydi.\nIzoh: {{note}}',
      steps: {
        create: [
          { order: 1, name: 'Bo\'lim boshlig\'i tasdig\'i', approverType: 'DIRECT_MANAGER', actionType: 'APPROVE' },
          { order: 2, name: 'Kadrlar bo\'limi tekshiruvi', approverType: 'ROLE', approverRole: 'HR_MANAGER', actionType: 'APPROVE' },
          { order: 3, name: 'Yurist tasdig\'i', approverType: 'SPECIFIC_USER', approverUserId: legalUser.id, actionType: 'APPROVE' },
          { order: 4, name: 'Rahbar imzosi', approverType: 'ROLE', approverRole: 'SUPER_ADMIN', actionType: 'APPROVE' },
        ],
      },
    },
  });

  // --- Employee Self-Service uchun qo'shimcha ariza turlari ---------------
  // Ko'pchiligi 1-2 bosqichli — asosiy ta'til shablonidan farqli (4 bosqich —
  // qonuniy talab bo'lgani uchun istisno).

  const annualLeaveTemplate = await prisma.workflowTemplate.create({
    data: {
      organizationId: org.id,
      name: 'Yillik mehnat ta\'tili',
      description: 'Yillik ta\'til uchun standart ariza.',
      formSchema: [
        { key: 'startDate', label: 'Boshlanish sanasi', type: 'date', required: true },
        { key: 'endDate', label: 'Tugash sanasi', type: 'date', required: true },
        { key: 'daysCount', label: 'Kunlar soni', type: 'number', required: true },
        { key: 'note', label: 'Izoh', type: 'textarea', required: false },
      ],
      documentBody:
        '{{employeeName}} yillik mehnat ta\'tiliga {{startDate}} dan {{endDate}} gacha ({{daysCount}} kun) chiqishini so\'raydi.\nIzoh: {{note}}',
      steps: {
        create: [
          { order: 1, name: 'Bevosita rahbar tasdig\'i', approverType: 'DIRECT_MANAGER', actionType: 'APPROVE' },
          { order: 2, name: 'Kadrlar bo\'limi tasdig\'i', approverType: 'ROLE', approverRole: 'HR_MANAGER', actionType: 'APPROVE' },
        ],
      },
    },
  });

  const unpaidLeaveTemplate = await prisma.workflowTemplate.create({
    data: {
      organizationId: org.id,
      name: 'Haq to\'lanmaydigan ta\'til',
      description: 'Haq to\'lanmaydigan ta\'til uchun ariza.',
      formSchema: [
        { key: 'startDate', label: 'Boshlanish sanasi', type: 'date', required: true },
        { key: 'endDate', label: 'Tugash sanasi', type: 'date', required: true },
        { key: 'reason', label: 'Sabab', type: 'textarea', required: true },
      ],
      documentBody:
        '{{employeeName}} haq to\'lanmaydigan ta\'tilga {{startDate}} dan {{endDate}} gacha chiqishini so\'raydi.\nSabab: {{reason}}',
      steps: {
        create: [
          { order: 1, name: 'Bevosita rahbar tasdig\'i', approverType: 'DIRECT_MANAGER', actionType: 'APPROVE' },
          { order: 2, name: 'Kadrlar bo\'limi tasdig\'i', approverType: 'ROLE', approverRole: 'HR_MANAGER', actionType: 'APPROVE' },
        ],
      },
    },
  });

  const studyLeaveTemplate = await prisma.workflowTemplate.create({
    data: {
      organizationId: org.id,
      name: 'O\'qish ta\'tili',
      description: 'Ta\'lim muassasasida o\'qish bilan bog\'liq ta\'til.',
      formSchema: [
        { key: 'startDate', label: 'Boshlanish sanasi', type: 'date', required: true },
        { key: 'endDate', label: 'Tugash sanasi', type: 'date', required: true },
        { key: 'institution', label: 'Ta\'lim muassasasi', type: 'text', required: true },
        { key: 'note', label: 'Izoh', type: 'textarea', required: false },
      ],
      documentBody:
        '{{employeeName}} o\'qish ta\'tiliga {{startDate}} dan {{endDate}} gacha ({{institution}}) chiqishini so\'raydi.',
      steps: {
        create: [
          { order: 1, name: 'Bevosita rahbar tasdig\'i', approverType: 'DIRECT_MANAGER', actionType: 'APPROVE' },
          { order: 2, name: 'Kadrlar bo\'limi tasdig\'i', approverType: 'ROLE', approverRole: 'HR_MANAGER', actionType: 'APPROVE' },
        ],
      },
    },
  });

  const maternityLeaveTemplate = await prisma.workflowTemplate.create({
    data: {
      organizationId: org.id,
      name: 'Homiladorlik va bola parvarishi ta\'tili',
      description: 'Homiladorlik yoki bola parvarishi bilan bog\'liq ta\'til.',
      formSchema: [
        { key: 'startDate', label: 'Boshlanish sanasi', type: 'date', required: true },
        { key: 'endDate', label: 'Tugash sanasi', type: 'date', required: true },
        { key: 'note', label: 'Izoh', type: 'textarea', required: false },
      ],
      documentBody:
        '{{employeeName}} homiladorlik/bola parvarishi ta\'tiliga {{startDate}} dan {{endDate}} gacha chiqishini so\'raydi.',
      steps: {
        create: [{ order: 1, name: 'Kadrlar bo\'limi tasdig\'i', approverType: 'ROLE', approverRole: 'HR_MANAGER', actionType: 'APPROVE' }],
      },
    },
  });

  const changePersonalInfoTemplate = await prisma.workflowTemplate.create({
    data: {
      organizationId: org.id,
      name: 'Shaxsiy ma\'lumotni o\'zgartirish',
      description: 'Kontakt ma\'lumotlarini o\'zgartirish so\'rovi — HR tasdiqlagach qo\'lda qo\'llaniladi.',
      formSchema: [
        {
          key: 'field',
          label: 'Qaysi maydon',
          type: 'select',
          required: true,
          options: ['personalPhone', 'personalEmail', 'address', 'emergencyContactName', 'emergencyContactPhone'],
        },
        { key: 'oldValue', label: 'Joriy qiymat', type: 'text', required: false },
        { key: 'newValue', label: 'Yangi qiymat', type: 'text', required: true },
        { key: 'reason', label: 'Sabab', type: 'textarea', required: true },
      ],
      documentBody:
        '{{employeeName}} "{{field}}" maydonini "{{oldValue}}" dan "{{newValue}}" ga o\'zgartirishni so\'raydi.\nSabab: {{reason}}',
      steps: {
        create: [{ order: 1, name: 'Kadrlar bo\'limi tasdig\'i', approverType: 'ROLE', approverRole: 'HR_MANAGER', actionType: 'APPROVE' }],
      },
    },
  });

  const changeBankDetailsTemplate = await prisma.workflowTemplate.create({
    data: {
      organizationId: org.id,
      name: 'Bank rekvizitlarini o\'zgartirish',
      description: 'Ish haqi o\'tkaziladigan bank ma\'lumotlarini yangilash so\'rovi.',
      formSchema: [
        { key: 'bankName', label: 'Bank nomi', type: 'text', required: true },
        { key: 'accountNumber', label: 'Hisob raqami', type: 'text', required: true },
        { key: 'reason', label: 'Sabab', type: 'textarea', required: true },
      ],
      documentBody:
        '{{employeeName}} bank rekvizitlarini o\'zgartirishni so\'raydi: {{bankName}}, hisob raqami {{accountNumber}}.\nSabab: {{reason}}',
      steps: {
        create: [{ order: 1, name: 'Kadrlar bo\'limi tasdig\'i', approverType: 'ROLE', approverRole: 'HR_MANAGER', actionType: 'APPROVE' }],
      },
    },
  });

  const otherHrRequestTemplate = await prisma.workflowTemplate.create({
    data: {
      organizationId: org.id,
      name: 'Boshqa HR so\'rovi',
      description: 'Ma\'lumotnoma, shartnoma nusxasi va boshqa hujjat/so\'rovlar uchun (HR Services).',
      formSchema: [
        {
          key: 'requestType',
          label: 'So\'rov turi',
          type: 'select',
          required: true,
          options: ['Ma\'lumotnoma', 'Mehnat shartnomasi nusxasi', 'Boshqa hujjat/so\'rov'],
        },
        { key: 'details', label: 'Tafsilotlar', type: 'textarea', required: true },
      ],
      documentBody: '{{employeeName}} quyidagi so\'rovni yubordi: {{requestType}}.\nTafsilotlar: {{details}}',
      steps: {
        create: [{ order: 1, name: 'Kadrlar bo\'limi tasdig\'i', approverType: 'ROLE', approverRole: 'HR_MANAGER', actionType: 'APPROVE' }],
      },
    },
  });

  console.log('Seed tugadi ✅');
  console.log('---------------------------------------------');
  console.log('Tashkilot slug:', org.slug);
  console.log('Test foydalanuvchilar (parol hammasida: Password123!):');
  console.log('  Bosh direktor (SUPER_ADMIN):', ceoUser.email);
  console.log('  HR menejer:', hrUser.email);
  console.log('  Bo\'lim boshlig\'i:', deptHeadUser.email);
  console.log('  Yurist:', legalUser.email);
  console.log('  Oddiy xodim:', employeeUser.email);
  console.log('Workflow shablonlari yaratildi:');
  [
    template,
    annualLeaveTemplate,
    unpaidLeaveTemplate,
    studyLeaveTemplate,
    maternityLeaveTemplate,
    changePersonalInfoTemplate,
    changeBankDetailsTemplate,
    otherHrRequestTemplate,
  ].forEach((t) => console.log('  -', t.name, '(id:', t.id + ')'));
  console.log('---------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
