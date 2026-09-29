'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { EMPTY_RULE, RuleForm, ruleToPayload, type RuleFormValues } from '@/components/learning-admin/RuleForm';

export default function NewRulePage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-400">Yuklanmoqda...</p>}>
      <NewRule />
    </Suspense>
  );
}

function NewRule() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ?materialId= — kurs ichidan: lokal qoida (faqat shu kurs uchun)
  const materialId = searchParams.get('materialId');
  const [localMaterial, setLocalMaterial] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!materialId) return;
    api.get(`/learning-admin/catalog/${materialId}`).then((res) => setLocalMaterial({ id: res.data.id, title: res.data.title }));
  }, [materialId]);

  async function handleSubmit(values: RuleFormValues, activate: boolean) {
    setError(null);
    setIsSaving(true);
    try {
      const res = await api.post<{ assigned: number }>(`/learning-admin/rules?activate=${activate ? 1 : 0}`, ruleToPayload(values));
      const msg = activate ? `Qoida faollashtirildi, ${res.data.assigned} ta xodimga tayinlandi` : 'Qoida qoralama sifatida saqlandi';
      router.push(
        materialId ? `/learning-admin/catalog/${materialId}?tab=assignments` : `/learning-admin/rules?msg=${encodeURIComponent(msg)}`,
      );
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.response?.data?.error?.issues?.[0]?.message ?? 'Saqlashda xatolik');
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-semibold text-stone-900">
        {materialId ? 'Yangi lokal qoida' : 'Yangi tayinlash (qoida)'}
      </h1>
      {materialId && !localMaterial ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : (
        <RuleForm
          initial={EMPTY_RULE}
          mode="create"
          isSaving={isSaving}
          error={error}
          onSubmit={handleSubmit}
          localMaterial={localMaterial}
        />
      )}
    </div>
  );
}
