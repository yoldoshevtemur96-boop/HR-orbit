'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Modal } from '@/components/hr/Modal';
import {
  EMPTY_ASSIGN,
  MaterialForm,
  assignFromPending,
  toMaterialPayload,
  type MaterialFormValues,
  type PublishStatus,
} from '@/components/learning-admin/MaterialForm';
import { MaterialAssignmentsPanel } from '@/components/learning-admin/MaterialAssignmentsPanel';
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
  pendingAssignment: Record<string, unknown> | null;
  activeAssignments: number;
  activeRules: number;
  attachedRuleIds: string[];
}

interface SaveResult {
  assignmentResult: { ok: boolean; message: string } | null;
  cancelledAssignments?: number;
}

const STATUS_LABEL: Record<PublishStatus, string> = {
  DRAFT: 'Qoralama',
  PUBLISHED: 'Nashr qilingan',
  ARCHIVED: 'Arxivda',
};

// ISO sana -> Toshkent bo'yicha yyyy-mm-dd (date input uchun)
function toDateInput(iso: string | null) {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function resultMessage(verb: string, res: SaveResult) {
  const parts = [verb];
  if (res.assignmentResult) parts.push(res.assignmentResult.message);
  if (res.cancelledAssignments) parts.push(`${res.cancelledAssignments} ta tayinlov bekor qilindi`);
  return parts.join('. ');
}

export default function EditMaterialPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [material, setMaterial] = useState<AdminMaterial | null>(null);
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'material' | 'assignments'>(searchParams.get('tab') === 'assignments' ? 'assignments' : 'material');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  useEffect(() => {
    api
      .get<AdminMaterial>(`/learning-admin/catalog/${params.id}`)
      .then((res) => setMaterial(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik'));
  }, [params.id]);

  async function save(body: Record<string, unknown>, verb: string) {
    setIsSaving(true);
    setError(null);
    try {
      const res = await api.patch<SaveResult>(`/learning-admin/catalog/${params.id}`, body);
      const msg = resultMessage(verb, res.data);
      router.push(`/learning-admin/catalog?msg=${encodeURIComponent(msg)}${res.data.assignmentResult?.ok === false ? '&warn=1' : ''}`);
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
    // Qoralamada saqlangan tayinlash sozlamasi tiklanadi; nashr qilinganda — bo'sh
    assign: material.status === 'DRAFT' ? assignFromPending(material.pendingAssignment) : EMPTY_ASSIGN,
    attachedRuleIds: material.attachedRuleIds,
  };

  const hasActive = material.activeAssignments > 0 || material.activeRules > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold text-stone-900">{material.title}</h1>
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
              onClick={() => save({ status: 'DRAFT' }, "Material nashrdan olindi")}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Nashrdan olish
            </button>
          )}
          {material.status !== 'ARCHIVED' ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsArchiveOpen(true)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-500 hover:border-rose-200 hover:text-rose-600"
            >
              Arxivga olish
            </button>
          ) : (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => save({ status: 'DRAFT' }, 'Material arxivdan qaytarildi (qoralama)')}
              className="rounded-lg border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/5"
            >
              Arxivdan qaytarish
            </button>
          )}
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-stone-200">
        {(
          [
            ['material', 'Material'],
            ['assignments', `Tayinlovlar${material.activeAssignments ? ` (${material.activeAssignments})` : ''}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === key ? 'border-accent text-accent' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'material' ? (
        <MaterialForm
          initial={initial}
          currentStatus={material.status}
          isSaving={isSaving}
          error={error}
          onSubmit={(values, status) =>
            save(
              // Global qoidalar biriktirmasi "Tayinlovlar" tabida boshqariladi — bu yerdan yuborilmaydi
              { ...toMaterialPayload(values), attachedRuleIds: undefined, status },
              status === 'PUBLISHED' ? (material.status === 'PUBLISHED' ? "O'zgarishlar saqlandi" : 'Material nashr qilindi') : 'Qoralama saqlandi',
            )
          }
        />
      ) : (
        <MaterialAssignmentsPanel materialId={material.id} isPublished={material.status === 'PUBLISHED'} />
      )}

      <Modal isOpen={isArchiveOpen} title="Arxivga olish" onClose={() => !isSaving && setIsArchiveOpen(false)}>
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-stone-600">Arxivdagi material xodimlarga katalogda ko&apos;rinmaydi.</p>
          {hasActive && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">
              Bu materialda {material.activeAssignments} ta faol tayinlov
              {material.activeRules > 0 && ` va ${material.activeRules} ta faol qoida`} bor.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {hasActive && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => save({ status: 'ARCHIVED', cancelActiveAssignments: true }, 'Material arxivga olindi')}
                className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                Arxivlash va tayinlovlarni bekor qilish
              </button>
            )}
            <button
              type="button"
              disabled={isSaving}
              onClick={() => save({ status: 'ARCHIVED' }, 'Material arxivga olindi')}
              className="rounded-lg border border-stone-200 px-4 py-2 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              {hasActive ? 'Faqat arxivlash (tayinlovlar qoladi)' : 'Arxivlash'}
            </button>
            <button type="button" onClick={() => setIsArchiveOpen(false)} className="px-4 py-2 text-stone-500 hover:text-stone-800">
              Bekor qilish
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
