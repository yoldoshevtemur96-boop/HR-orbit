'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LearningAdminIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/learning-admin/assignments');
  }, [router]);
  return null;
}
