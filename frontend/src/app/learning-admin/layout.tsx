'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { useAuthStore } from '@/store/authStore';
import { LEARNING_ADMIN_ROLES } from '@/lib/learningAdmin';

// L&D admin qismining bo'limlari. Hozircha faqat "Tayinlash" qurilgan —
// Materiallar, Kurslar, Tadbirlar, So'rovlar va Hisobotlar keyingi
// bosqichlarda shu yerga qo'shiladi.
const TABS = [{ label: 'Tayinlash', href: '/learning-admin/assignments' }];

export default function LearningAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <LearningAdminFrame>{children}</LearningAdminFrame>
    </AppShell>
  );
}

function LearningAdminFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  if (!user || !LEARNING_ADMIN_ROLES.includes(user.role)) {
    return <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">Bu bo&apos;lim uchun ruxsatingiz yo&apos;q.</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Learning &amp; Development</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">O&apos;qitishni boshqarish</h1>
      </div>
      <nav className="flex gap-1 border-b border-stone-200">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname?.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                active ? 'border-accent text-accent' : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
