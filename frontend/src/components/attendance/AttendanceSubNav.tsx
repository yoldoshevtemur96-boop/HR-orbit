'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import type { RoleName } from '@/types/auth';

const MANAGE_ROLES: RoleName[] = ['SUPER_ADMIN', 'HR_MANAGER', 'TIMEKEEPER'];

interface Tab {
  label: string;
  href: string;
  roles?: RoleName[];
}

const TABS: Tab[] = [
  { label: 'Kunlik davomat', href: '/attendance/daily', roles: [...MANAGE_ROLES, 'DEPARTMENT_HEAD'] },
  { label: 'Mening davomatim', href: '/attendance/my' },
  { label: 'Tuzatish so‘rovlari', href: '/attendance/corrections', roles: [...MANAGE_ROLES, 'DEPARTMENT_HEAD'] },
  { label: "Bo'lim tabellari", href: '/attendance/timesheets/department', roles: [...MANAGE_ROLES, 'DEPARTMENT_HEAD'] },
  { label: 'Tashkilot tabeli', href: '/attendance/timesheets/organization', roles: MANAGE_ROLES },
  { label: 'Sozlamalar', href: '/attendance/settings', roles: MANAGE_ROLES },
];

// Attendance modulining ikkinchi darajali navigatsiyasi — rolga qarab
// tablar ko'rinadi/yashiriladi (masalan oddiy EMPLOYEE faqat "Mening
// davomatim" va "Tuzatish so'rovlari"ni ko'radi).
export function AttendanceSubNav() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  const visibleTabs = TABS.filter((tab) => !tab.roles || (user && tab.roles.includes(user.role)));

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-stone-200">
      {visibleTabs.map((tab) => {
        const isActive = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition ${
              isActive
                ? 'border-accent text-accent'
                : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
