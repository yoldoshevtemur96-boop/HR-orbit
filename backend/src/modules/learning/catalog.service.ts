import type { LearningMaterialType, LearningPublishStatus, Prisma, RoleName } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { isLearningAdmin } from './assignment.service';

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
}

function normalizeTags(tags: string[] | undefined) {
  return [...new Set((tags ?? []).map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))].slice(0, 10);
}

function assertPublishable(status: LearningPublishStatus | undefined, contentUrl: string | null | undefined) {
  if (status === 'PUBLISHED' && !contentUrl) {
    throw AppError.badRequest("Nashr qilish uchun kontent havolasini kiriting");
  }
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

export async function getCatalogMaterial(auth: AuthContext, materialId: string) {
  assertHr(auth);
  const material = await prisma.learningMaterial.findFirst({ where: { id: materialId, organizationId: auth.organizationId } });
  if (!material) throw AppError.notFound('Material topilmadi');
  return material;
}

export async function createMaterial(auth: AuthContext, input: MaterialInput) {
  assertHr(auth);
  const status = input.status ?? 'DRAFT';
  assertPublishable(status, input.contentUrl);
  return prisma.learningMaterial.create({
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
    },
  });
}

export async function updateMaterial(auth: AuthContext, materialId: string, input: Partial<MaterialInput>) {
  const existing = await getCatalogMaterial(auth, materialId);
  const nextStatus = input.status ?? existing.status;
  const nextContentUrl = input.contentUrl !== undefined ? input.contentUrl : existing.contentUrl;
  assertPublishable(nextStatus, nextContentUrl);

  const data: Prisma.LearningMaterialUpdateInput = {};
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

  return prisma.learningMaterial.update({ where: { id: materialId }, data });
}
