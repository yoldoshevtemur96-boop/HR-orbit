import type { RoleName } from '@prisma/client';

// Davomatni to'liq boshqaradi: sozlamalar, kunlik yozuvlar, tuzatishlarni
// yakunlash, tabellarni generatsiya/konsolidatsiya qilish.
export function canManageAttendance(role: RoleName): boolean {
  return role === 'SUPER_ADMIN' || role === 'HR_MANAGER' || role === 'TIMEKEEPER';
}

// Departament tabelini ko'rish — HR/Timekeeper + o'z bo'limi uchun DEPARTMENT_HEAD.
export function canViewDepartmentAttendance(role: RoleName): boolean {
  return canManageAttendance(role) || role === 'DEPARTMENT_HEAD';
}

// Tashkilot darajasidagi (FINAL) tabelni faqat yuqori rahbar tasdiqlaydi.
export function canApproveOrgTimesheet(role: RoleName): boolean {
  return role === 'SUPER_ADMIN';
}
