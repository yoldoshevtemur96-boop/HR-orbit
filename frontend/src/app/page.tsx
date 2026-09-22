'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function HomePage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;
    router.replace(user ? '/dashboard' : '/login');
  }, [isHydrated, user, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5]">
      <p className="text-sm text-stone-400">Yuklanmoqda...</p>
    </main>
  );
}
