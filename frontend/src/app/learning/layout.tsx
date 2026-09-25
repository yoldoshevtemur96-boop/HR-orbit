'use client';

import { AppShell } from '@/components/AppShell';

export default function LearningLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </AppShell>
  );
}
