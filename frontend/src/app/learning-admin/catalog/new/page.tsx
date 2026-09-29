'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  EMPTY_MATERIAL,
  MaterialForm,
  toMaterialPayload,
  type MaterialFormValues,
  type PublishStatus,
} from '@/components/learning-admin/MaterialForm';

export default function NewMaterialPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: MaterialFormValues, status: PublishStatus) {
    setIsSaving(true);
    setError(null);
    try {
      const res = await api.post<{ assignmentResult: { ok: boolean; message: string } | null }>('/learning-admin/catalog', {
        ...toMaterialPayload(values),
        status,
      });
      const verb = status === 'PUBLISHED' ? 'Material nashr qilindi' : 'Qoralama saqlandi';
      const msg = res.data.assignmentResult ? `${verb}. ${res.data.assignmentResult.message}` : verb;
      router.push(`/learning-admin/catalog?msg=${encodeURIComponent(msg)}${res.data.assignmentResult?.ok === false ? '&warn=1' : ''}`);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.response?.data?.error?.issues?.[0]?.message ?? 'Saqlashda xatolik');
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-semibold text-stone-900">Yangi material</h1>
      <MaterialForm initial={EMPTY_MATERIAL} currentStatus={null} isSaving={isSaving} error={error} onSubmit={handleSubmit} />
    </div>
  );
}
