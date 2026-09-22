import type { CurrentUser } from '@/types/auth';

// JWT'ning payload qismini imzoni tekshirmasdan o'qiydi — bu faqat UI'da
// rolga qarab ko'rsatish uchun, xavfsizlik tekshiruvi har doim backendda.
export function decodeAccessToken(token: string): CurrentUser | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(json);
    return { userId: data.userId, organizationId: data.organizationId, role: data.role };
  } catch {
    return null;
  }
}
