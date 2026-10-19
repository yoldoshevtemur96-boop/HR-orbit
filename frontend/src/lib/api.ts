import axios from 'axios';
import { resolveDemoFileUrl } from '@/mock/files';

// Demo rejim: backend (Supabase/Postgres) ulanmagan holatda UI brauzer ichidagi
// mock API bilan ishlaydi — ma'lumotlar localStorage'da saqlanadi.
// Haqiqiy backendga ulanish uchun NEXT_PUBLIC_DEMO_MODE=false qo'ying.
export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

// Backend API bilan bog'lanish uchun markazlashgan klient.
// Har bir so'rovga localStorage'dagi access token avtomatik qo'shiladi.
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api',
  ...(isDemoMode && {
    // Mock API kodi faqat kerak bo'lganda yuklanadi
    adapter: async (config) => (await import('@/mock/adapter')).demoAdapter(config),
  }),
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Token yaroqsiz/muddati tugagan bo'lsa — tozalab login sahifasiga qaytaramiz.
// (To'liq refresh-token oqimi keyingi bosqichda qo'shiladi.)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error?.response?.status === 401) {
      window.localStorage.removeItem('accessToken');
      window.localStorage.removeItem('refreshToken');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// Backend'ga yuklangan fayllar nisbiy manzil bilan keladi (/files/<id>...) —
// ularni API bazaviy manziliga qo'shamiz. Tashqi havolalar o'zgarmaydi.
export function resolveFileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/files/')) {
    if (isDemoMode) return typeof window === 'undefined' ? null : resolveDemoFileUrl(url);
    return `${api.defaults.baseURL}${url}`;
  }
  return url;
}
