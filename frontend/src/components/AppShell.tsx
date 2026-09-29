'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { NotificationBell } from './NotificationBell';
import { RoleSwitcher } from './RoleSwitcher';
import { Sidebar } from './Sidebar';

// Himoyalangan sahifalar uchun umumiy qobiq: auth holatini tekshiradi,
// yo'q bo'lsa /login'ga yo'naltiradi. Tuzilma: chapda doimiy modullar
// paneli (Sidebar), o'ngda yuqori panel (qidiruv/foydalanuvchi) + kontent.
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  // Kichik ekranlarda (lg dan past) chap menyu yashirin — ☰ bilan ochiladi
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && !user) {
      router.replace('/login');
    }
  }, [isHydrated, user, router]);

  if (!isHydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f6f4]">
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    // Ekran balandligiga qat'iy: menyu va yuqori panel joyida turadi,
    // faqat <main> aylanadi (scroll).
    <div className="flex h-screen overflow-hidden bg-[#f5f6f4]">
      <Sidebar mobileOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            aria-label="Menyuni ochish"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100 lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="relative hidden max-w-sm flex-1 md:block">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              placeholder="Qidiruv..."
              className="w-full rounded-lg border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/15"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <RoleSwitcher />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full min-w-0 max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
