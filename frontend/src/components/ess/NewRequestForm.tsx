'use client';

import { useEffect, useState } from 'react';
import { DynamicRequestForm } from './DynamicRequestForm';
import { api } from '@/lib/api';
import type { WorkflowTemplate } from '@/types/workflow';

interface EmployeeOption {
  id: string;
  fullName: string;
}

interface NewRequestFormProps {
  presetTemplateId?: string | null;
  presetRequestType?: string | null;
  onCreated: (instanceId: string) => void;
}

// Yangi so'rov formasi — Drawer ichida (My Requests) yoki to'liq sahifada
// (requests/new, HR Services'dan yo'naltirilganda) ishlatiladi.
export function NewRequestForm({ presetTemplateId, presetRequestType, onCreated }: NewRequestFormProps) {
  const [templates, setTemplates] = useState<WorkflowTemplate[] | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [myEmployee, setMyEmployee] = useState<EmployeeOption | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get('/workflow/templates').then((res) => setTemplates(res.data));
    api
      .get('/hr/employees/me')
      .then((res) => setMyEmployee(res.data))
      .catch(() => setMyEmployee(null));
  }, []);

  useEffect(() => {
    if (presetTemplateId && templates?.some((t) => t.id === presetTemplateId)) {
      setSelectedTemplateId(presetTemplateId);
      if (presetRequestType) {
        setFormValues((prev) => ({ ...prev, requestType: presetRequestType }));
      }
    }
  }, [presetTemplateId, presetRequestType, templates]);

  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId) ?? null;

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
      onCreated(res.data.id);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Soʻrov yuborishda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {!myEmployee && templates !== null && (
        <p className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Hisobingiz xodim profiliga bog&apos;lanmagan — so&apos;rov yubora olmaysiz.
        </p>
      )}

      <div className="grid gap-2">
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
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-800">Forma ma&apos;lumotlari</h2>
          <DynamicRequestForm fields={selectedTemplate.formSchema} values={formValues} onChange={handleFieldChange} />

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
            {isSubmitting ? 'Yuborilmoqda...' : 'Soʻrovni yuborish'}
          </button>
        </form>
      )}
    </div>
  );
}
