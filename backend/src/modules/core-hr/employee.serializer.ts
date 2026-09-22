import type { RoleName } from '@prisma/client';
import { canViewPinflPassport } from './rbac';

// PINFL va passport — sezgir maydonlar. Ruxsati yo'q rollar uchun
// javobdan BUTUNLAY olib tashlanadi (undefined, null emas) — frontend
// "maydon yo'q/cheklangan" bilan "maydon bo'sh" holatini aralashtirmasin.
// EMPLOYEE roli o'ziga tegishli yozuvda bu maydonlarni ko'rishi kerak —
// buni chaqiruvchi tomon (isSelf) hal qiladi.
export function sanitizeEmployeeForRole<T extends { pinfl?: string | null; passportNumber?: string | null }>(
  employee: T,
  role: RoleName,
  isSelf: boolean,
): T {
  if (canViewPinflPassport(role) || isSelf) {
    return employee;
  }
  const { pinfl, passportNumber, ...rest } = employee;
  return rest as T;
}

export function sanitizeEmployeeListForRole<T extends { pinfl?: string | null; passportNumber?: string | null; userId?: string | null }>(
  employees: T[],
  role: RoleName,
  currentUserId: string,
): T[] {
  return employees.map((e) => sanitizeEmployeeForRole(e, role, e.userId === currentUserId));
}
