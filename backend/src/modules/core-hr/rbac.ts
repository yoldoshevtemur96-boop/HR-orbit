import type { RoleName } from '@prisma/client';

// Core HR uchun resurs-darajasidagi ruxsat qoidalari. Bular requireRole
// o'rniga emas, balki service funksiyalari ichida qo'shimcha WHERE/serializer
// mantig'i uchun ishlatiladi — rol middleware faqat "bu endpointga umuman
// kira oladimi" darajasida ishlaydi, bu yerdagi funksiyalar "nimani ko'ra
// oladi/o'zgartira oladi" darajasida ishlaydi.

export function canManageCoreHr(role: RoleName): boolean {
  return role === 'SUPER_ADMIN' || role === 'HR_MANAGER';
}

// Contact/personal maydonlarni tahrirlay oladigan, lekin employment
// (lavozim/bo'lim/filial/rahbar/status) o'zgartira olmaydigan rollar.
export function canEditLimited(role: RoleName): boolean {
  return canManageCoreHr(role) || role === 'HR_SPECIALIST';
}

export function canViewPinflPassport(role: RoleName): boolean {
  return canManageCoreHr(role) || role === 'HR_SPECIALIST';
}

export function canViewAuditLog(role: RoleName): boolean {
  return canManageCoreHr(role);
}
