import { Prisma } from '@prisma/client';
import type {
  LearningCompletionRule,
  LearningContentSource,
  LearningDisplayMode,
  LearningLevel,
  LearningMaterialType,
  LearningPublishStatus,
  LearningVisibility,
  RoleName,
} from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { createAssignments, isLearningAdmin } from './assignment.service';
import { createRule } from './rule.service';
import { assertFileInOrganization, signedFilePath } from '@/modules/files/file.service';

interface AuthContext {
  userId: string;
  organizationId: string;
  role: RoleName;
}

// L&D admin — katalog: material yaratish, tahrirlash, nashr qilish,
// arxivlash (faqat HR). Xodim faqat PUBLISHED materiallarni ko'radi.

function assertHr(auth: AuthContext) {
  if (!isLearningAdmin(auth.role)) throw AppError.forbidden('Katalogni faqat HR boshqaradi');
}

export interface MaterialInput {
  title: string;
  description?: string | null;
  type: LearningMaterialType;
  coverUrl?: string | null;
  contentUrl?: string | null;
  durationMinutes?: number;
  author?: string | null;
  tags?: string[];
  requiresApproval?: boolean;
  status?: LearningPublishStatus;
  contentSource?: LearningContentSource;
  contentFileId?: string | null;
  displayMode?: LearningDisplayMode;
  completionRule?: LearningCompletionRule;
  level?: LearningLevel | null;
  language?: string | null;
  allowDownload?: boolean;
  visibility?: LearningVisibility;
  visibleDepartmentIds?: string[];
  visiblePositionIds?: string[];
  visibleBranchIds?: string[];
  availableFrom?: Date | null;
  availableUntil?: Date | null;
  // Formadagi "Majburiy qilish" bloki — nashrda bajariladi, qoralamada saqlanadi
  assignment?: MaterialAssignmentSettings | null;
  // Arxivlashda: faol tayinlovlarni bekor qilish va qoidalarni to'xtatish
  cancelActiveAssignments?: boolean;
}

export interface MaterialAssignmentSettings {
  mode: 'ONE_TIME' | 'PERMANENT';
  sameAsVisibility: boolean;
  allOrganization?: boolean;
  departmentIds?: string[];
  positionIds?: string[];
  branchIds?: string[];
  reason: 'LEGAL' | 'POSITION' | 'ONBOARDING' | 'DEVELOPMENT' | 'OTHER';
  reasonText?: string | null;
  dueInDays?: number | null;
  dueDate?: string | null; // yyyy-mm-dd, faqat ONE_TIME
  skipIfCompletedWithinDays?: number | null;
}

// Formadan kelgan tayinlash sozlamasini bajaradi: bir martalik — qo'lda
// tayinlash, doimiy — qoida yaratish. Material saqlanishini to'xtatmaydi:
// natija (yoki "tayinlanadigan xodim yo'q" kabi sabab) javobda qaytadi.
async function runMaterialAssignment(
  auth: AuthContext,
  material: {
    id: string;
    title: string;
    visibility: LearningVisibility;
    visibleDepartmentIds: string[];
    visiblePositionIds: string[];
    visibleBranchIds: string[];
  },
  settings: MaterialAssignmentSettings,
) {
  const audience = settings.sameAsVisibility
    ? material.visibility === 'ALL'
      ? { allOrganization: true }
      : material.visibility === 'AUDIENCE'
        ? {
            departmentIds: material.visibleDepartmentIds,
            positionIds: material.visiblePositionIds,
            branchIds: material.visibleBranchIds,
          }
        : null
    : {
        allOrganization: settings.allOrganization,
        departmentIds: settings.departmentIds ?? [],
        positionIds: settings.positionIds ?? [],
        branchIds: settings.branchIds ?? [],
      };
  if (!audience) {
    return { ok: false, message: "Yashirin material uchun tayinlash auditoriyasini alohida tanlang" };
  }

  const dueDate = settings.mode === 'ONE_TIME' && settings.dueDate ? new Date(`${settings.dueDate}T18:59:59.000Z`) : null;
  try {
    if (settings.mode === 'PERMANENT') {
      const result = await createRule(auth, {
        name: `${material.title} — avtomatik tayinlash`,
        materialId: material.id,
        type: 'PERMANENT',
        ...audience,
        reason: settings.reason,
        reasonText: settings.reasonText,
        dueInDays: settings.dueInDays ?? null,
        skipIfCompletedWithinDays: settings.skipIfCompletedWithinDays ?? null,
        cancelOutOfScope: true,
      });
      return { ok: true, message: `Doimiy qoida yaratildi, ${result.assigned} ta xodimga tayinlandi` };
    }
    const result = await createAssignments(auth, {
      materialId: material.id,
      audience,
      reason: settings.reason,
      reasonText: settings.reasonText ?? undefined,
      dueDate: dueDate ?? undefined,
      dueInDays: dueDate ? undefined : settings.dueInDays ?? undefined,
      skipIfCompletedWithinDays: settings.skipIfCompletedWithinDays ?? undefined,
    });
    return { ok: true, message: `${result.assignedCount} ta xodimga tayinlandi` };
  } catch (err) {
    return { ok: false, message: err instanceof AppError ? err.message : "Tayinlab bo'lmadi" };
  }
}

function normalizeTags(tags: string[] | undefined) {
  return [...new Set((tags ?? []).map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))].slice(0, 10);
}

function assertPublishable(state: {
  status: LearningPublishStatus;
  contentSource: LearningContentSource;
  contentUrl: string | null | undefined;
  contentFileId: string | null | undefined;
  visibility: LearningVisibility;
  audienceSize: number;
  availableFrom: Date | null | undefined;
  availableUntil: Date | null | undefined;
}) {
  if (state.availableFrom && state.availableUntil && state.availableFrom > state.availableUntil) {
    throw AppError.badRequest("Ko'rinish sanalari noto'g'ri: boshlanishi tugashidan keyin");
  }
  if (state.status !== 'PUBLISHED') return;
  if (state.contentSource === 'LINK' && !state.contentUrl) {
    throw AppError.badRequest('Nashr qilish uchun kontent havolasini kiriting');
  }
  if (state.contentSource === 'FILE' && !state.contentFileId) {
    throw AppError.badRequest('Nashr qilish uchun kontent faylini yuklang');
  }
  if (state.visibility === 'AUDIENCE' && state.audienceSize === 0) {
    throw AppError.badRequest("'Faqat tanlanganlarga' uchun kamida bitta bo'lim, lavozim yoki filial tanlang");
  }
}

// Kiritilgan sozlamalarni Prisma ma'lumotiga aylantiradi (create va update uchun umumiy)
type SettingsKey =
  | 'contentSource'
  | 'contentFileId'
  | 'displayMode'
  | 'completionRule'
  | 'level'
  | 'language'
  | 'allowDownload'
  | 'visibility'
  | 'visibleDepartmentIds'
  | 'visiblePositionIds'
  | 'visibleBranchIds'
  | 'availableFrom'
  | 'availableUntil';

function settingsData(input: Partial<MaterialInput>) {
  const data: Partial<Pick<Prisma.LearningMaterialUncheckedCreateInput, SettingsKey>> = {};
  if (input.contentSource !== undefined) data.contentSource = input.contentSource;
  if (input.contentFileId !== undefined) data.contentFileId = input.contentFileId || null;
  if (input.displayMode !== undefined) data.displayMode = input.displayMode;
  if (input.completionRule !== undefined) data.completionRule = input.completionRule;
  if (input.level !== undefined) data.level = input.level;
  if (input.language !== undefined) data.language = input.language || null;
  if (input.allowDownload !== undefined) data.allowDownload = input.allowDownload;
  if (input.visibility !== undefined) data.visibility = input.visibility;
  if (input.visibleDepartmentIds !== undefined) data.visibleDepartmentIds = input.visibleDepartmentIds;
  if (input.visiblePositionIds !== undefined) data.visiblePositionIds = input.visiblePositionIds;
  if (input.visibleBranchIds !== undefined) data.visibleBranchIds = input.visibleBranchIds;
  if (input.availableFrom !== undefined) data.availableFrom = input.availableFrom;
  if (input.availableUntil !== undefined) data.availableUntil = input.availableUntil;
  return data;
}

export async function listCatalog(
  auth: AuthContext,
  query: { search?: string; type?: LearningMaterialType; status?: LearningPublishStatus },
) {
  assertHr(auth);
  const where: Prisma.LearningMaterialWhereInput = { organizationId: auth.organizationId };
  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;
  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { author: { contains: search, mode: 'insensitive' } },
      { tags: { has: search.toLowerCase() } },
    ];
  }

  const materials = await prisma.learningMaterial.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      type: true,
      coverUrl: true,
      durationMinutes: true,
      author: true,
      tags: true,
      status: true,
      requiresApproval: true,
      publishedAt: true,
      updatedAt: true,
      visibility: true,
      contentSource: true,
    },
  });

  const ids = materials.map((m) => m.id);
  const [assignments, completions] = await Promise.all([
    prisma.learningAssignment.groupBy({
      by: ['materialId'],
      where: { organizationId: auth.organizationId, status: 'ACTIVE', materialId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.learningProgress.groupBy({
      by: ['materialId'],
      where: { organizationId: auth.organizationId, status: 'COMPLETED', materialId: { in: ids } },
      _count: { _all: true },
    }),
  ]);
  const assignedById = new Map(assignments.map((a) => [a.materialId, a._count._all]));
  const completedById = new Map(completions.map((c) => [c.materialId, c._count._all]));

  const counts = await prisma.learningMaterial.groupBy({
    by: ['status'],
    where: { organizationId: auth.organizationId },
    _count: { _all: true },
  });

  return {
    counts: {
      DRAFT: counts.find((c) => c.status === 'DRAFT')?._count._all ?? 0,
      PUBLISHED: counts.find((c) => c.status === 'PUBLISHED')?._count._all ?? 0,
      ARCHIVED: counts.find((c) => c.status === 'ARCHIVED')?._count._all ?? 0,
    },
    rows: materials.map((m) => ({
      ...m,
      activeAssignments: assignedById.get(m.id) ?? 0,
      completions: completedById.get(m.id) ?? 0,
    })),
  };
}

async function getMaterialRow(auth: AuthContext, materialId: string) {
  assertHr(auth);
  const material = await prisma.learningMaterial.findFirst({ where: { id: materialId, organizationId: auth.organizationId } });
  if (!material) throw AppError.notFound('Material topilmadi');
  return material;
}

// Tahrirlash formasi uchun: material + yuklangan kontent fayli ma'lumoti
export async function getCatalogMaterial(auth: AuthContext, materialId: string) {
  const material = await getMaterialRow(auth, materialId);
  const contentFile = material.contentFileId
    ? await prisma.storedFile.findUnique({
        where: { id: material.contentFileId },
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
      })
    : null;
  const [activeAssignments, activeRules] = await Promise.all([
    prisma.learningAssignment.count({ where: { organizationId: auth.organizationId, materialId, status: 'ACTIVE' } }),
    prisma.learningAssignmentRule.count({ where: { organizationId: auth.organizationId, materialId, status: 'ACTIVE' } }),
  ]);
  return {
    ...material,
    contentFile: contentFile ? { ...contentFile, url: signedFilePath(contentFile.id) } : null,
    activeAssignments,
    activeRules,
  };
}

export async function createMaterial(auth: AuthContext, input: MaterialInput) {
  assertHr(auth);
  const status = input.status ?? 'DRAFT';
  if (input.contentFileId) await assertFileInOrganization(auth.organizationId, input.contentFileId);
  assertPublishable({
    status,
    contentSource: input.contentSource ?? 'LINK',
    contentUrl: input.contentUrl,
    contentFileId: input.contentFileId,
    visibility: input.visibility ?? 'ALL',
    audienceSize:
      (input.visibleDepartmentIds?.length ?? 0) + (input.visiblePositionIds?.length ?? 0) + (input.visibleBranchIds?.length ?? 0),
    availableFrom: input.availableFrom,
    availableUntil: input.availableUntil,
  });
  const created = await prisma.learningMaterial.create({
    data: {
      organizationId: auth.organizationId,
      createdByUserId: auth.userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      type: input.type,
      coverUrl: input.coverUrl || null,
      contentUrl: input.contentUrl || null,
      durationMinutes: input.durationMinutes ?? 0,
      author: input.author?.trim() || null,
      tags: normalizeTags(input.tags),
      requiresApproval: Boolean(input.requiresApproval),
      status,
      publishedAt: new Date(),
      ...settingsData(input),
      // Qoralamada tayinlash sozlamasi saqlanadi — nashr qilinganda bajariladi
      pendingAssignment: status === 'DRAFT' && input.assignment ? (input.assignment as unknown as Prisma.InputJsonValue) : undefined,
    },
  });
  const assignmentResult =
    status === 'PUBLISHED' && input.assignment ? await runMaterialAssignment(auth, created, input.assignment) : null;
  return { ...created, assignmentResult };
}

export async function updateMaterial(auth: AuthContext, materialId: string, input: Partial<MaterialInput>) {
  const existing = await getMaterialRow(auth, materialId);
  if (input.contentFileId) await assertFileInOrganization(auth.organizationId, input.contentFileId);
  const pick = <K extends keyof MaterialInput & keyof typeof existing>(key: K) =>
    (input[key] !== undefined ? input[key] : existing[key]) as (typeof existing)[K];
  assertPublishable({
    status: pick('status'),
    contentSource: pick('contentSource'),
    contentUrl: pick('contentUrl'),
    contentFileId: pick('contentFileId'),
    visibility: pick('visibility'),
    audienceSize: pick('visibleDepartmentIds').length + pick('visiblePositionIds').length + pick('visibleBranchIds').length,
    availableFrom: pick('availableFrom'),
    availableUntil: pick('availableUntil'),
  });

  const data: Prisma.LearningMaterialUncheckedUpdateInput = { ...settingsData(input) };
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.type !== undefined) data.type = input.type;
  if (input.coverUrl !== undefined) data.coverUrl = input.coverUrl || null;
  if (input.contentUrl !== undefined) data.contentUrl = input.contentUrl || null;
  if (input.durationMinutes !== undefined) data.durationMinutes = input.durationMinutes;
  if (input.author !== undefined) data.author = input.author?.trim() || null;
  if (input.tags !== undefined) data.tags = normalizeTags(input.tags);
  if (input.requiresApproval !== undefined) data.requiresApproval = input.requiresApproval;
  if (input.status !== undefined) {
    data.status = input.status;
    // Qoralamadan birinchi marta nashr qilinganda — "so'nggi qo'shilganlar"
    // ro'yxatida tepaga chiqishi uchun nashr sanasi yangilanadi.
    if (input.status === 'PUBLISHED' && existing.status === 'DRAFT') data.publishedAt = new Date();
  }

  const nextStatus = input.status ?? existing.status;
  // Tayinlash sozlamasi: qoralamada saqlanadi, nashr qilinganda (yoki nashr
  // qilingan materialda darhol) bajariladi. null — saqlangan sozlamani o'chirish.
  const settings =
    input.assignment !== undefined
      ? input.assignment
      : existing.pendingAssignment
        ? (existing.pendingAssignment as unknown as MaterialAssignmentSettings)
        : null;
  const runNow = nextStatus === 'PUBLISHED' && settings !== null && (input.assignment != null || existing.status !== 'PUBLISHED');
  if (nextStatus === 'DRAFT' && input.assignment !== undefined) {
    data.pendingAssignment = input.assignment ? (input.assignment as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
  }
  if (runNow) data.pendingAssignment = Prisma.DbNull;

  const updated = await prisma.learningMaterial.update({ where: { id: materialId }, data });

  let cancelledAssignments = 0;
  if (nextStatus === 'ARCHIVED' && existing.status !== 'ARCHIVED' && input.cancelActiveAssignments) {
    const [cancelled] = await prisma.$transaction([
      prisma.learningAssignment.updateMany({
        where: { organizationId: auth.organizationId, materialId, status: 'ACTIVE' },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledByUserId: auth.userId },
      }),
      prisma.learningAssignmentRule.updateMany({
        where: { organizationId: auth.organizationId, materialId, status: 'ACTIVE' },
        data: { status: 'STOPPED' },
      }),
    ]);
    cancelledAssignments = cancelled.count;
  }

  const assignmentResult = runNow && settings ? await runMaterialAssignment(auth, updated, settings) : null;
  return { ...updated, assignmentResult, cancelledAssignments };
}
