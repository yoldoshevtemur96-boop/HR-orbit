import { create } from 'zustand';
import { decodeAccessToken } from '@/lib/jwt';
import type { CurrentUser } from '@/types/auth';

interface AuthState {
  user: CurrentUser | null;
  accessToken: string | null;
  isHydrated: boolean; // localStorage'dan o'qish tugadimi (SSR/CSR farqini oldini olish uchun)
  setTokens: (accessToken: string, refreshToken: string) => void;
  hydrate: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isHydrated: false,

  setTokens: (accessToken, refreshToken) => {
    window.localStorage.setItem('accessToken', accessToken);
    window.localStorage.setItem('refreshToken', refreshToken);
    set({ accessToken, user: decodeAccessToken(accessToken) });
  },

  // Sahifa yangilanganda localStorage'dagi tokenni store'ga qayta yuklaydi.
  hydrate: () => {
    const accessToken = window.localStorage.getItem('accessToken');
    set({
      accessToken,
      user: accessToken ? decodeAccessToken(accessToken) : null,
      isHydrated: true,
    });
  },

  logout: () => {
    window.localStorage.removeItem('accessToken');
    window.localStorage.removeItem('refreshToken');
    set({ user: null, accessToken: null });
  },
}));
