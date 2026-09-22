'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { WorkflowTemplate } from '@/types/workflow';

interface EmployeeOption {
  id: string;
  fullName: string;
  userId: string | null;
}

// Xodim shablonlar ro'yxatidan tanlaydi, formani to'ldiradi va yuboradi.
// Forma maydonlari WorkflowTemplate.formSchema'dan dinamik chiziladi —
// konstruktorda qo'shilgan har qanday yangi maydon bu yerda avtomatik chiqadi.
export default function NewWorkflowPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [templates, setTemplates] = useState<WorkflowTemplate[] | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get('/workflow/templates').then((res) => setTemplates(res.data));
    api.get('/hr/employees').then((res) => setEmployees(res.data));
  }, []);

  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId) ?? null;

  // Joriy foydalanuvchiga tegishli employee yozuvi — ariza shu xodim nomidan yuboriladi.
  const myEmployee = employees.find((e) => e.userId === user?.userId);

  function handleFieldChange(key: string, value: string) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate || !myEmployee) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const formData: Record<string, unknown> = { ...formValues, employeeName: myEmployee.fullName };
      for (const field of selectedTemplate.formSchema) {
        if (field.type === 'number' && formData[field.key] !== undefined) {
          formData[field.key] = Number(formData[field.key]);
        }
      }
      const res = await api.post('/workflow/instances', {
        templateId: selectedTemplate.id,
        employeeId: myEmployee.id,
        formData,
      });
      router.push(`/workflow/${res.data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Ariza yuborishda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell>
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Yangi ariza</p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Ariza turini tanlang</h1>

      {!myEmployee && employees.length > 0 && (
        <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Hisobingiz xodim profiliga bog&apos;lanmagan — ariza yubora olmaysiz.
        </p>
      )}

      <div className="mt-6 grid gap-2">
        {templates === null && <p className="text-sm text-stone-400">Yuklanmoqda...</p>}
        {templates?.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setSelectedTemplateId(t.id);
              setFormValues({});
            }}
            className={`rounded-lg border px-4 py-3 text-left transition ${
              selectedTemplateId === t.id
                ? 'border-accent bg-accent-soft'
                : 'border-stone-200 bg-white hover:border-stone-300'
            }`}
          >
            <p className="text-sm font-semibold text-stone-800">{t.name}</p>
            {t.description && <p className="mt-0.5 text-xs text-stone-500">{t.description}</p>}
            <p className="mt-1 text-xs text-stone-400">{t.steps.length} bosqichli tasdiqlash zanjiri</p>
          </button>
        ))}
      </div>

      {selectedTemplate && (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-800">Forma ma&apos;lumotlari</h2>
          {selectedTemplate.formSchema.map((field) => (
            <label key={field.key} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-stone-600">
                {field.label} {field.required && <span className="text-rose-500">*</span>}
              </span>
              {field.type === 'textarea' ? (
                <textarea
                  required={field.required}
                  value={formValues[field.key] ?? ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  rows={3}
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              ) : (
                <input
                  type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                  required={field.required}
                  value={formValues[field.key] ?? ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              )}
            </label>
          ))}

          <div className="mt-2 rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-500">
            <p className="mb-1 font-semibold text-stone-600">Tasdiqlash zanjiri:</p>
            {selectedTemplate.steps.map((s) => (
              <span key={s.id}>
                {s.order}. {s.name}
                {s.order < selectedTemplate.steps.length ? ' → ' : ''}
              </span>
            ))}
          </div>

          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting || !myEmployee}
            className="mt-2 self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Yuborilmoqda...' : 'Arizani yuborish'}
          </button>
        </form>
      )}
    </AppShell>
  );
}
