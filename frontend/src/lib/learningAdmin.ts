import type { RoleName } from '@/types/auth';

// L&D admin qismiga kira oladigan rollar (DEPARTMENT_HEAD — faqat o'z
// bo'ysunuvchilari bo'yicha, cheklov backend'da).
export const LEARNING_ADMIN_ROLES: RoleName[] = ['SUPER_ADMIN', 'HR_MANAGER', 'DEPARTMENT_HEAD'];

export function isLearningHr(role: RoleName | undefined) {
  return role === 'SUPER_ADMIN' || role === 'HR_MANAGER';
}
