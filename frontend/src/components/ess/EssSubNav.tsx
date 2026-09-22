'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'My Profile', href: '/self-service' },
  { label: 'My Documents', href: '/self-service/documents' },
  { label: 'My Requests', href: '/self-service/requests' },
  { label: 'HR Services', href: '/self-service/hr-services' },
  { label: 'Employment History', href: '/self-service/history' },
];

// Employee Self-Service modulining ikkinchi darajali navigatsiyasi —
// Core HR'dagi HrSubNav bilan bir xil naqsh, lekin ESS'ga xos tablar bilan.
export function EssSubNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-stone-200">
      {TABS.map((tab) => {
        const isActive = tab.href === '/self-service' ? pathname === '/self-service' : pathname?.startsWith(tab.href);
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
