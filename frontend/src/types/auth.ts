export type RoleName =
  | 'SUPER_ADMIN'
  | 'HR_MANAGER'
  | 'HR_SPECIALIST'
  | 'RECRUITER'
  | 'DEPARTMENT_HEAD'
  | 'EMPLOYEE'
  | 'TIMEKEEPER';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// JWT payload'dan olinadigan joriy foydalanuvchi konteksti.
export interface CurrentUser {
  userId: string;
  organizationId: string;
  role: RoleName;
}
