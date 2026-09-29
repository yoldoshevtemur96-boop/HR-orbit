'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { RuleForm, ruleToFormValues, ruleToPayload, type RuleFormValues } from '@/components/learning-admin/RuleForm';
import { RULE_STATUS_LABEL, type RuleStatus } from '@/types/learningAdmin';

// Qoidani tahrirlash — faqat qoralama yoki to'xtatilgan holatda
export default function EditRulePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [rule, setRule] = useState<(Record<string, any> & { status: RuleStatus; name: string }) | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/learning-admin/rules/${params.id}`)
      .then((res) => setRule(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik'));
  }, [params.id]);

  async function handleSubmit(values: RuleFormValues, activate: boolean) {
    setError(null);
    setIsSaving(true);
    try {
      await api.put(`/learning-admin/rules/${params.id}`, ruleToPayload(values));
      let msg = 'Qoida saqlandi';
      if (activate) {
        const res = await api.post<{ assigned: number }>(`/learning-admin/rules/${params.id}/activate`);
        msg = `Qoida saqlandi va faollashtirildi, ${res.data.assigned} ta xodimga tayinlandi`;
      }
      router.push(`/learning-admin/rules?msg=${encodeURIComponent(msg)}`);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.response?.data?.error?.issues?.[0]?.message ?? 'Saqlashda xatolik');
      setIsSaving(false);
    }
  }

  if (!rule) {
    return error ? (
      <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
    ) : (
      <p className="text-sm text-stone-400">Yuklanmoqda...</p>
    );
  }

  const editable = rule.status === 'DRAFT' || rule.status === 'STOPPED';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-semibold text-stone-900">{rule.name}</h1>
        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">{RULE_STATUS_LABEL[rule.status]}</span>
      </div>
      {editable ? (
        <RuleForm
          initial={ruleToFormValues(rule)}
          mode="edit"
          isSaving={isSaving}
          error={error}
          onSubmit={handleSubmit}
          localMaterial={rule.scope === 'LOCAL' ? rule.materials?.[0] ?? null : null}
          attachedMaterials={rule.scope === 'GLOBAL' ? rule.materials ?? [] : []}
        />
      ) : (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {rule.status === 'ACTIVE'
            ? "Faol qoidani tahrirlash uchun avval uni to'xtating."
            : "Bu qoidani tahrirlab bo'lmaydi — undan nusxa yarating."}
        </p>
      )}
    </div>
  );
}
