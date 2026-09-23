import type { RoleName } from '@/types/auth';

export const ROLE_LABEL: Record<RoleName, string> = {
  SUPER_ADMIN: 'HR-direktor',
  HR_MANAGER: 'HR menejer',
  HR_SPECIALIST: 'HR mutaxassisi',
  RECRUITER: 'Rekruter',
  DEPARTMENT_HEAD: 'Departament rahbari',
  EMPLOYEE: 'Xodim',
  TIMEKEEPER: 'Tabelchi',
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role as RoleName] ?? role;
}
