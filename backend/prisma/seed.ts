// Test uchun boshlang'ich ma'lumotlar: bitta tashkilot, tashkiliy tuzilma
// (Xodim → Bo'lim boshlig'i → Rahbar), va "Mehnat ta'tiliga chiqish arizasi"
// shablonining to'liq zanjiri — aynan foydalanuvchi tasvirlagan senariy bo'yicha:
//   Xodim (boshlaydi) → Bo'lim boshlig'i → Kadrlar → Yuridik (Yurist) → Rahbar
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed boshlandi...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const org = await prisma.organization.create({
    data: { name: 'Demo Kompaniya', slug: 'demo', plan: 'trial' },
  });

  // --- Foydalanuvchilar va xodimlar ---------------------------------------

  const ceoUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'ceo@demo.uz',
      passwordHash,
      role: 'SUPER_ADMIN',
      employee: { create: { organizationId: org.id, fullName: 'Aziz Rahbarov', position: 'Bosh direktor' } },
    },
    include: { employee: true },
  });

  const hrUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'hr@demo.uz',
      passwordHash,
      role: 'HR_MANAGER',
      employee: { create: { organizationId: org.id, fullName: 'Malika Kadrova', position: 'Kadrlar bo\'limi boshlig\'i' } },
    },
    include: { employee: true },
  });

  const legalUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'legal@demo.uz',
      passwordHash,
      role: 'EMPLOYEE',
      employee: { create: { organizationId: org.id, fullName: 'Jasur Yuristov', position: 'Yurist' } },
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
        create: { organizationId: org.id, fullName: 'Olim Boshliqov', position: 'IT bo\'limi boshlig\'i' },
      },
    },
    include: { employee: true },
  });

  const department = await prisma.department.create({
    data: { organizationId: org.id, name: 'IT bo\'limi', headEmployeeId: deptHeadUser.employee!.id },
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
          fullName: 'Bekzod Dasturchi',
          position: 'Backend dasturchi',
          departmentId: department.id,
          managerId: deptHeadUser.employee!.id, // bevosita rahbari — DIRECT_MANAGER shu orqali topiladi
        },
      },
    },
    include: { employee: true },
  });

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
