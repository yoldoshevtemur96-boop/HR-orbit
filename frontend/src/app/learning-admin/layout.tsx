'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { useAuthStore } from '@/store/authStore';
import { LEARNING_ADMIN_ROLES } from '@/lib/learningAdmin';

// Ichki sahifalar nomlari — yo'l ko'rsatkichi (breadcrumb) uchun.
// Bo'limlarga o'tish bosh sahifadagi (/learning-admin) kartalar orqali.
const SEGMENT_LABEL: Record<string, string> = {
  catalog: 'Katalog',
  assignments: 'Tayinlovlar',
  rules: 'Qoidalar',
  new: 'Yangi',
};

export default function LearningAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <LearningAdminFrame>{children}</LearningAdminFrame>
    </AppShell>
  );
}

function LearningAdminFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/learning-admin';
  const user = useAuthStore((s) => s.user);

  if (!user || !LEARNING_ADMIN_ROLES.includes(user.role)) {
    return <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">Bu bo&apos;lim uchun ruxsatingiz yo&apos;q.</p>;
  }

  // /learning-admin/assignments/new -> Tayinlovlar / Yangi
  const segments = pathname.replace(/^\/learning-admin\/?/, '').split('/').filter(Boolean);
  const crumbs = segments.map((segment, i) => ({
    // Noma'lum segment — yozuv id'si (masalan /catalog/<id>) => tahrirlash sahifasi
    label: SEGMENT_LABEL[segment] ?? 'Tahrirlash',
    href: '/learning-admin/' + segments.slice(0, i + 1).join('/'),
  }));
  const isHub = crumbs.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-stone-400">
        <Link href="/learning" className="hover:text-accent">
          Bosh sahifa
        </Link>
        <span>/</span>
        <span>Boshqaruv</span>
        <span>/</span>
        {isHub ? (
          <span className="text-stone-700">O&apos;qitish</span>
        ) : (
          <Link href="/learning-admin" className="hover:text-accent">
            O&apos;qitish
          </Link>
        )}
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            <span>/</span>
            {i === crumbs.length - 1 ? (
              <span className="text-stone-700">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-accent">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
      {children}
    </div>
  );
}
