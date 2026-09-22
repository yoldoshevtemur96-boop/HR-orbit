'use client';

import { AppShell } from '@/components/AppShell';
import { HrSubNav } from '@/components/hr/HrSubNav';

// Barcha /hr/* sahifalari shu layout orqali o'raladi — AppShell (chap
// sidebar + top panel) tashqarida, HrSubNav (ikkinchi darajali navigatsiya)
// ichkarida. Individual /hr/* sahifalari endi o'zlari AppShell bilan
// o'ralmaydi, chunki bu layout allaqachon o'raydi.
export default function HrLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <HrSubNav />
      <div className="mt-6">{children}</div>
    </AppShell>
  );
}
