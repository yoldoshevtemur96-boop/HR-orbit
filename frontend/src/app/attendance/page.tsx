'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_MANAGER', 'TIMEKEEPER'];

// Attendance modulining kirish nuqtasi — rolga qarab mos default tabga
// yo'naltiradi (HR/Timekeeper -> kunlik jadval, boshqalar -> shaxsiy davomat).
export default function AttendanceIndexPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    if (MANAGE_ROLES.includes(user.role) || user.role === 'DEPARTMENT_HEAD') {
      router.replace('/attendance/daily');
    } else {
      router.replace('/attendance/my');
    }
  }, [user, router]);

  return null;
}
