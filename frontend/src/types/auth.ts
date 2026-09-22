export type RoleName = 'SUPER_ADMIN' | 'HR_MANAGER' | 'RECRUITER' | 'DEPARTMENT_HEAD' | 'EMPLOYEE';

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
