import axios from 'axios';

// Backend API bilan bog'lanish uchun markazlashgan klient.
// Har bir so'rovga localStorage'dagi access token avtomatik qo'shiladi.
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api',
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
