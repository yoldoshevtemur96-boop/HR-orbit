'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'HR-direktor',
  HR_MANAGER: 'HR menejer',
  RECRUITER: 'Rekruter',
  DEPARTMENT_HEAD: "Bo'lim boshlig'i",
  EMPLOYEE: 'Xodim',
};

interface NavItem {
  label: string;
  href: string;
}

// Rejalashtirish bosqichida kelishilgan 9 modul — HR Orbit loyihalash
// hujjatidagi tuzilmaga mos. Sahifasi hali qurilmagan modullar ham
// shu yerda ko'rinadi (bosilganda routega o'tadi, sahifa asta qo'shiladi).
const NAV_ITEMS: NavItem[] = [
  { label: 'Obzor', href: '/dashboard' },
  { label: 'Podbor', href: '/recruitment' },
  { label: 'Adaptatsiya', href: '/onboarding' },
  { label: 'KDP', href: '/hr' },
  { label: 'Otpuska', href: '/workflow' },
  { label: 'Obuchenie', href: '/training' },
  { label: 'KPI va baholash', href: '/kpi' },
  { label: 'Analitika', href: '/analytics' },
  { label: 'Administrirovanie', href: '/admin' },
];

const ICONS: Record<string, JSX.Element> = {
  Obzor: (
    <path d="M3 12h4v8H3v-8Zm7-6h4v14h-4V6Zm7 3h4v11h-4V9Z" />
  ),
  Podbor: (
    <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9a6 6 0 0 1 6-6h0a6 6 0 0 1 6 6M17 8v6M20 11h-6" />
  ),
  Adaptatsiya: (
    <path d="M4 4h12l4 4v12H4V4Zm12 0v4h4M8 12h8M8 16h5" />
  ),
  KDP: (
    <path d="M6 3h9l4 4v14H6V3Zm9 0v4h4M9 11h6M9 15h6" />
  ),
  Otpuska: (
    <path d="M3 12c4-6 14-6 18 0M12 3v3M5 8l1.5 1.5M19 8l-1.5 1.5M12 21v-6M9 15h6" />
  ),
  Obuchenie: (
    <path d="M3 6.5 12 3l9 3.5-9 3.5-9-3.5Zm4 2v6c0 1.5 2.5 3 5 3s5-1.5 5-3v-6" />
  ),
  'KPI va baholash': (
    <path d="M4 20V10M10 20V4M16 20v-7M20 20H3" />
  ),
  Analitika: (
    <path d="M4 19h16M7 16V9M12 16V5M17 16v-7" />
  ),
  Administrirovanie: (
    <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Zm0 6v6" />
  ),
};

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col bg-[#151b26] text-stone-300">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
          H
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">HR Orbit</p>
          <p className="text-[11px] text-stone-400">HR-platforma</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    isActive
                      ? 'bg-accent/15 font-medium text-white'
                      : 'text-stone-400 hover:bg-white/5 hover:text-stone-100'
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-accent' : 'text-stone-500'}`}
                  >
                    {ICONS[item.label]}
                  </svg>
                  <span className="truncate">{item.label}</span>
                  {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {user && (
        <div className="border-t border-white/10 px-3 py-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-white/5"
          >
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
              {(ROLE_LABEL[user.role] ?? user.role).slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-xs font-medium text-stone-100">
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
              <span className="block text-[11px] text-stone-500">Chiqish</span>
            </span>
          </button>
        </div>
      )}
    </aside>
  );
}
