'use client';

import { AppShell } from '@/components/AppShell';
import { EssSubNav } from '@/components/ess/EssSubNav';

export default function SelfServiceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <EssSubNav />
      <div className="mt-6">{children}</div>
    </AppShell>
  );
}
