'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { roleLabel } from '@/lib/roleLabels';
import type { RoleName } from '@/types/auth';

// Faqat demo/test muhiti uchun — barcha rollar oldindan ma'lum parol
// bilan seed qilingan (backend/prisma/seed.ts). Test qilishni osonlashtirish
// uchun profil menyusidan bevosita boshqa demo hisobga qayta kirish.
const DEMO_ACCOUNTS: { email: string; role: RoleName }[] = [
  { email: 'ceo@demo.uz', role: 'SUPER_ADMIN' },
  { email: 'hr@demo.uz', role: 'HR_MANAGER' },
  { email: 'boshliq@demo.uz', role: 'DEPARTMENT_HEAD' },
  { email: 'tabelchi@demo.uz', role: 'TIMEKEEPER' },
  { email: 'legal@demo.uz', role: 'EMPLOYEE' },
  { email: 'xodim@demo.uz', role: 'EMPLOYEE' },
];
const DEMO_PASSWORD = 'Password123!';
const DEMO_ORG_SLUG = 'demo';

export function RoleSwitcher() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setTokens = useAuthStore((s) => s.setTokens);
  const logout = useAuthStore((s) => s.logout);

  const [isOpen, setIsOpen] = useState(false);
  const [switchingEmail, setSwitchingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!user) return null;

  async function handleSwitch(email: string) {
    setError(null);
    setSwitchingEmail(email);
    try {
      const res = await api.post('/auth/login', {
        organizationSlug: DEMO_ORG_SLUG,
        email,
        password: DEMO_PASSWORD,
      });
      setTokens(res.data.accessToken, res.data.refreshToken);
      setIsOpen(false);
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Almashtirishda xatolik yuz berdi');
    } finally {
      setSwitchingEmail(null);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2.5 border-l border-stone-200 pl-3 transition hover:opacity-80"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {roleLabel(user.role).slice(0, 2).toUpperCase()}
        </span>
        <span className="hidden text-xs leading-tight sm:block">
          <span className="block font-medium text-stone-800">{roleLabel(user.role)}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-stone-200 bg-white py-2 shadow-lg">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Test sifatida kirish
            </p>
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleSwitch(acc.email)}
                disabled={switchingEmail !== null}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-stone-50 disabled:opacity-50"
              >
                <span>
                  <span className="block font-medium text-stone-800">{roleLabel(acc.role)}</span>
                  <span className="block text-xs text-stone-400">{acc.email}</span>
                </span>
                {switchingEmail === acc.email && <span className="text-xs text-stone-400">...</span>}
              </button>
            ))}
            {error && <p className="mx-3 mt-1 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{error}</p>}
            <div className="my-1.5 border-t border-stone-100" />
            <button
              type="button"
              onClick={() => {
                logout();
                setIsOpen(false);
                router.push('/login');
              }}
              className="flex w-full items-center px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
            >
              Chiqish
            </button>
          </div>
        </>
      )}
    </div>
  );
}
