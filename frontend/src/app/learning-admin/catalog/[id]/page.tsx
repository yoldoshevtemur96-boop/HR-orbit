'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { MaterialForm, toMaterialPayload, type MaterialFormValues, type PublishStatus } from '@/components/learning-admin/MaterialForm';
import type {
  LearningCompletionRule,
  LearningContentSource,
  LearningDisplayMode,
  LearningLevel,
  LearningMaterialType,
  LearningVisibility,
} from '@/types/learning';

interface AdminMaterial {
  id: string;
  title: string;
  description: string | null;
  type: LearningMaterialType;
  coverUrl: string | null;
  contentUrl: string | null;
  durationMinutes: number;
  author: string | null;
  tags: string[];
  requiresApproval: boolean;
  status: PublishStatus;
  contentSource: LearningContentSource;
  contentFile: { id: string; fileName: string; mimeType: string; sizeBytes: number; url: string } | null;
  displayMode: LearningDisplayMode;
  completionRule: LearningCompletionRule;
  level: LearningLevel | null;
  language: 'uz' | 'ru' | 'en' | null;
  allowDownload: boolean;
  visibility: LearningVisibility;
  visibleDepartmentIds: string[];
  visiblePositionIds: string[];
  visibleBranchIds: string[];
  availableFrom: string | null;
  availableUntil: string | null;
}

// ISO sana -> Toshkent bo'yicha yyyy-mm-dd (date input uchun)
function toDateInput(iso: string | null) {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<PublishStatus, string> = {
  DRAFT: 'Qoralama',
  PUBLISHED: 'Nashr qilingan',
  ARCHIVED: 'Arxivda',
};

export default function EditMaterialPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [material, setMaterial] = useState<AdminMaterial | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AdminMaterial>(`/learning-admin/catalog/${params.id}`)
      .then((res) => setMaterial(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik'));
  }, [params.id]);

  async function save(body: Record<string, unknown>) {
    setIsSaving(true);
    setError(null);
    try {
      await api.patch(`/learning-admin/catalog/${params.id}`, body);
      router.push('/learning-admin/catalog');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.response?.data?.error?.issues?.[0]?.message ?? 'Saqlashda xatolik');
      setIsSaving(false);
    }
  }

  if (!material) {
    return error ? (
      <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
    ) : (
      <p className="text-sm text-stone-400">Yuklanmoqda...</p>
    );
  }

  const initial: MaterialFormValues = {
    title: material.title,
    description: material.description ?? '',
    type: material.type,
    coverUrl: material.coverUrl ?? '',
    contentUrl: material.contentUrl ?? '',
    durationMinutes: material.durationMinutes,
    author: material.author ?? '',
    tags: material.tags,
    requiresApproval: material.requiresApproval,
    contentSource: material.contentSource,
    contentFile: material.contentFile,
    displayMode: material.displayMode,
    completionRule: material.completionRule,
    level: material.level ?? '',
    language: material.language ?? '',
    allowDownload: material.allowDownload,
    visibility: material.visibility,
    visibleDepartmentIds: material.visibleDepartmentIds,
    visiblePositionIds: material.visiblePositionIds,
    visibleBranchIds: material.visibleBranchIds,
    availableFrom: toDateInput(material.availableFrom),
    availableUntil: toDateInput(material.availableUntil),
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold text-stone-900">Materialni tahrirlash</h1>
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">{STATUS_LABEL[material.status]}</span>
        </div>
        <div className="flex gap-2">
          {material.status === 'PUBLISHED' && (
            <Link
              href={`/learning/materials/${material.id}`}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Xodim ko&apos;rinishi
            </Link>
          )}
          {material.status === 'PUBLISHED' && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => save({ status: 'DRAFT' })}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Nashrdan olish
            </button>
          )}
          {material.status !== 'ARCHIVED' ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                if (window.confirm("Material arxivga olinsinmi? Xodimlar uni katalogda ko'rmaydi.")) save({ status: 'ARCHIVED' });
              }}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-500 hover:border-rose-200 hover:text-rose-600"
            >
              Arxivga olish
            </button>
          ) : (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => save({ status: 'DRAFT' })}
              className="rounded-lg border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/5"
            >
              Arxivdan qaytarish
            </button>
          )}
        </div>
      </div>
      <MaterialForm
        initial={initial}
        currentStatus={material.status}
        isSaving={isSaving}
        error={error}
        onSubmit={(values, status) => save({ ...toMaterialPayload(values), status })}
      />
    </div>
  );
}
