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

// Xodim hayot aylanishi bosqichlariga mos 7 bo'lim: Core HR (xodim/bo'lim
// bazasi) → Employee Self-Service (xodimning shaxsiy kabineti) →
// Applications & Workflow (shablon konstruktori — istalgan ariza turini
// sozlash) → Attendance (davomat) → Leave (ta'til — mavjud workflow
// sahifalari: ariza yaratish/kuzatish shu yerda) → Recruitment +
// Onboarding (ishga qabul va moslashuv) → HR Analytics (hisobotlar).
const NAV_ITEMS: NavItem[] = [
  { label: 'Core HR', href: '/hr' },
  { label: 'Employee Self-Service', href: '/self-service' },
  { label: 'Applications & Workflow', href: '/workflow/templates' },
  { label: 'Attendance', href: '/attendance' },
  { label: 'Leave', href: '/workflow' },
  { label: 'Recruitment + Onboarding', href: '/recruitment' },
  { label: 'HR Analytics', href: '/analytics' },
];

const ICONS: Record<string, JSX.Element> = {
  'Core HR': (
    <path d="M6 3h9l4 4v14H6V3Zm9 0v4h4M9 11h6M9 15h6" />
  ),
  'Employee Self-Service': (
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" />
  ),
  'Applications & Workflow': (
    <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm13 0 3 3-3 3m-3-3h6" />
  ),
  Attendance: (
    <path d="M12 8v4l3 2M12 3a9 9 0 1 0 .01 0Z" />
  ),
  Leave: (
    <path d="M3 12c4-6 14-6 18 0M12 3v3M5 8l1.5 1.5M19 8l-1.5 1.5M12 21v-6M9 15h6" />
  ),
  'Recruitment + Onboarding': (
    <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9a6 6 0 0 1 6-6h0a6 6 0 0 1 6 6M17 8v6M20 11h-6" />
  ),
  'HR Analytics': (
    <path d="M4 19h16M7 16V9M12 16V5M17 16v-7" />
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
