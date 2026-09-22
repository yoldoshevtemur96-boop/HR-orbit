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

  console.log('Seed tugadi ✅');
  console.log('---------------------------------------------');
  console.log('Tashkilot slug:', org.slug);
  console.log('Test foydalanuvchilar (parol hammasida: Password123!):');
  console.log('  Bosh direktor (SUPER_ADMIN):', ceoUser.email);
  console.log('  HR menejer:', hrUser.email);
  console.log('  Bo\'lim boshlig\'i:', deptHeadUser.email);
  console.log('  Yurist:', legalUser.email);
  console.log('  Oddiy xodim:', employeeUser.email);
  console.log('Workflow shabloni yaratildi:', template.name, '(id:', template.id + ')');
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
