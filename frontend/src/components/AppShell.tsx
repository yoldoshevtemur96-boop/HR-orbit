'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { roleLabel } from '@/lib/roleLabels';
import { NotificationBell } from './NotificationBell';
import { Sidebar } from './Sidebar';

// Himoyalangan sahifalar uchun umumiy qobiq: auth holatini tekshiradi,
// yo'q bo'lsa /login'ga yo'naltiradi. Tuzilma: chapda doimiy modullar
// paneli (Sidebar), o'ngda yuqori panel (qidiruv/foydalanuvchi) + kontent.
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();

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
    <div className="flex min-h-screen bg-[#f5f6f4]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-stone-200 bg-white px-6 py-3">
          <div className="relative max-w-sm flex-1">
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

          <div className="flex items-center gap-3">
            <NotificationBell />

            <div className="flex items-center gap-2.5 border-l border-stone-200 pl-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                {roleLabel(user.role).slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden text-xs leading-tight sm:block">
                <span className="block font-medium text-stone-800">{roleLabel(user.role)}</span>
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
