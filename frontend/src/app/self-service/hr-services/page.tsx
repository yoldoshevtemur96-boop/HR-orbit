'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { WorkflowTemplate } from '@/types/workflow';

const OTHER_HR_REQUEST_TEMPLATE_NAME = "Boshqa HR so'rovi";

const SERVICES = [
  {
    requestType: "Ma'lumotnoma",
    title: "Ma'lumotnoma",
    description: 'Ish joyidan maʻlumotnoma olish uchun soʻrov yuborish.',
  },
  {
    requestType: 'Mehnat shartnomasi nusxasi',
    title: 'Mehnat shartnomasi nusxasi',
    description: 'Mehnat shartnomangizning nusxasini soʻrash.',
  },
  {
    requestType: 'Boshqa hujjat/soʻrov',
    title: 'Boshqa hujjat',
    description: 'Boshqa turdagi HR hujjati yoki soʻrovi.',
  },
];

// HR Services — alohida infratuzilma emas, "Boshqa HR so'rovi" shabloniga
// requestType oldindan to'ldirilgan holda yo'naltiruvchi kirish nuqtasi.
export default function HrServicesPage() {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<string | null>(null);

  useEffect(() => {
    api.get<WorkflowTemplate[]>('/workflow/templates').then((res) => {
      const template = res.data.find((t) => t.name === OTHER_HR_REQUEST_TEMPLATE_NAME);
      setTemplateId(template?.id ?? null);
    });
  }, []);

  function requestService(requestType: string) {
    if (!templateId) return;
    router.push(`/self-service/requests/new?templateId=${templateId}&requestType=${encodeURIComponent(requestType)}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Self-Service</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">HR xizmatlari</h1>
        <p className="mt-1 text-sm text-stone-500">Hujjat yoki ma&apos;lumotnoma so&apos;rovini yuboring.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {SERVICES.map((service) => (
          <button
            key={service.requestType}
            type="button"
            disabled={!templateId}
            onClick={() => requestService(service.requestType)}
            className="rounded-lg border border-stone-200 bg-white p-5 text-left transition hover:border-accent hover:shadow-sm disabled:opacity-50"
          >
            <p className="text-sm font-semibold text-stone-800">{service.title}</p>
            <p className="mt-1 text-xs text-stone-500">{service.description}</p>
            <p className="mt-3 text-xs font-medium text-accent">So&apos;rov yuborish →</p>
          </button>
        ))}
      </div>
    </div>
  );
}
