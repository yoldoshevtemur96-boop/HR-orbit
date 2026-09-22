'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { NewRequestForm } from '@/components/ess/NewRequestForm';

// HR Services (`/self-service/hr-services`) shu sahifaga templateId/
// requestType bilan yo'naltiradi. My Requests'dagi asosiy oqim endi
// Drawer orqali (sahifa almashtirmasdan) ishlaydi — bu sahifa muqobil
// kirish nuqtasi sifatida qoladi.
export default function NewRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetTemplateId = searchParams.get('templateId');
  const presetRequestType = searchParams.get('requestType');

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Self-Service</p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Yangi so&apos;rov</h1>

      <div className="mt-6">
        <NewRequestForm
          presetTemplateId={presetTemplateId}
          presetRequestType={presetRequestType}
          onCreated={(instanceId) => router.push(`/workflow/${instanceId}`)}
        />
      </div>
    </div>
  );
}
