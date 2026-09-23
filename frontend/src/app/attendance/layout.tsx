'use client';

import { AppShell } from '@/components/AppShell';
import { AttendanceSubNav } from '@/components/attendance/AttendanceSubNav';

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <AttendanceSubNav />
      <div className="mt-6">{children}</div>
    </AppShell>
  );
}
