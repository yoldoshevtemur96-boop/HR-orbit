'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Bosh direktor',
  HR_MANAGER: 'HR menejer',
  RECRUITER: 'Rekruter',
  DEPARTMENT_HEAD: "Bo'lim boshlig'i",
  EMPLOYEE: 'Xodim',
};

// Himoyalangan sahifalar uchun umumiy qobiq: auth holatini tekshiradi,
// yo'q bo'lsa /login'ga yo'naltiradi, bor bo'lsa header + logout beradi.
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isHydrated, hydrate, logout } = useAuthStore();

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
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f5]">
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8f5]">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link href="/dashboard" className="font-display text-lg font-semibold text-stone-900">
            HR Orbit
          </Link>
          <div className="flex items-center gap-4">
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
            <button
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="text-sm text-stone-500 transition hover:text-stone-900"
            >
              Chiqish
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}
