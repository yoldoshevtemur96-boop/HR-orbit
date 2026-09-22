'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Dashboard', href: '/hr' },
  { label: 'Employees', href: '/hr/employees' },
  { label: 'Organization', href: '/hr/organization' },
  { label: 'Departments', href: '/hr/departments' },
  { label: 'Branches', href: '/hr/branches' },
  { label: 'Positions', href: '/hr/positions' },
];

// Core HR modulining ikkinchi darajali navigatsiyasi — chap sidebar'dagi
// "Core HR" bittasidan farqli, shu modul ichidagi sahifalar orasida
// almashish uchun.
export function HrSubNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-stone-200">
      {TABS.map((tab) => {
        const isActive = tab.href === '/hr' ? pathname === '/hr' : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
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
