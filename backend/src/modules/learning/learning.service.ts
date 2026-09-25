import type { LearningMaterialType, Prisma, RoleName } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { sendDueReminders } from './assignment.service';

interface AuthContext {
  userId: string;
  organizationId: string;
  role: RoleName;
}

// Learning & Development — xodim tomoni. Har bir amal joriy foydalanuvchiga
// bog'langan xodim profili (Employee) nomidan bajariladi.
async function getSelfEmployeeId(auth: AuthContext): Promise<string> {
  const employee = await prisma.employee.findFirst({
    where: { userId: auth.userId, organizationId: auth.organizationId },
    select: { id: true },
  });
  if (!employee) throw AppError.notFound("Sizga bog'langan xodim profili topilmadi");
  return employee.id;
}

const MATERIAL_LIST_SELECT = {
  id: true,
  title: true,
  description: true,
  type: true,
  coverUrl: true,
  durationMinutes: true,
  author: true,
  tags: true,
  requiresApproval: true,
  publishedAt: true,
} satisfies Prisma.LearningMaterialSelect;

type MaterialListItem = Prisma.LearningMaterialGetPayload<{ select: typeof MATERIAL_LIST_SELECT }>;

// Material ro'yxatiga xodimning shaxsiy holatini (progress, sevimli,
// tayinlangan) qo'shadi — kartochkalarda ko'rsatish uchun.
async function decorateMaterials(organizationId: string, employeeId: string, materials: MaterialListItem[]) {
  const ids = materials.map((m) => m.id);
  if (ids.length === 0) return [];
  const [progress, favorites, assignments] = await Promise.all([
    prisma.learningProgress.findMany({ where: { organizationId, employeeId, materialId: { in: ids } } }),
    prisma.learningFavorite.findMany({ where: { organizationId, employeeId, materialId: { in: ids } }, select: { materialId: true } }),
    prisma.learningAssignment.findMany({ where: { organizationId, employeeId, materialId: { in: ids }, status: 'ACTIVE' } }),
  ]);
  const progressById = new Map(progress.map((p) => [p.materialId, p]));
  const favoriteIds = new Set(favorites.map((f) => f.materialId));
  const assignmentById = new Map(assignments.map((a) => [a.materialId, a]));

  return materials.map((m) => {
    const p = progressById.get(m.id);
    const a = assignmentById.get(m.id);
    return {
      ...m,
      isFavorite: favoriteIds.has(m.id),
      myProgress: p ? { progress: p.progress, status: p.status, lastOpenedAt: p.lastOpenedAt, completedAt: p.completedAt } : null,
      assignment: a
        ? { dueDate: a.dueDate, note: a.note, reason: a.reason, reasonText: a.reasonText, createdAt: a.createdAt }
        : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Katalog
// ---------------------------------------------------------------------------

export async function listMaterials(
  auth: AuthContext,
  query: { search?: string; type?: LearningMaterialType; limit?: number },
) {
  const employeeId = await getSelfEmployeeId(auth);
  const where: Prisma.LearningMaterialWhereInput = { organizationId: auth.organizationId, status: 'PUBLISHED' };
  if (query.type) where.type = query.type;
  if (query.search) {
    const search = query.search.trim();
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { author: { contains: search, mode: 'insensitive' } },
      { tags: { has: search.toLowerCase() } },
    ];
  }
  const materials = await prisma.learningMaterial.findMany({
    where,
    select: MATERIAL_LIST_SELECT,
    orderBy: { publishedAt: 'desc' },
    take: query.limit ?? 100,
  });
  return decorateMaterials(auth.organizationId, employeeId, materials);
}

export async function getMaterial(auth: AuthContext, materialId: string) {
  const employeeId = await getSelfEmployeeId(auth);
  const material = await prisma.learningMaterial.findFirst({
    where: { id: materialId, organizationId: auth.organizationId, status: 'PUBLISHED' },
    select: { ...MATERIAL_LIST_SELECT, contentUrl: true },
  });
  if (!material) throw AppError.notFound('Material topilmadi');

  const [decorated] = await decorateMaterials(auth.organizationId, employeeId, [material]);
  const pendingRequest = await prisma.learningRequest.findFirst({
    where: { organizationId: auth.organizationId, employeeId, materialId, status: { in: ['PENDING', 'APPROVED'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  });

  // Tasdiq talab qilinadigan material kontenti faqat so'rov tasdiqlangach
  // (yoki material tayinlangan bo'lsa) ochiladi.
  const hasAccess =
    !material.requiresApproval || Boolean(decorated.assignment) || pendingRequest?.status === 'APPROVED' || Boolean(decorated.myProgress);

  return {
    ...decorated,
    contentUrl: hasAccess ? material.contentUrl : null,
    hasAccess,
    request: pendingRequest,
  };
}

async function assertMaterialAccessible(auth: AuthContext, employeeId: string, materialId: string) {
  const material = await prisma.learningMaterial.findFirst({
    where: { id: materialId, organizationId: auth.organizationId, status: 'PUBLISHED' },
  });
  if (!material) throw AppError.notFound('Material topilmadi');
  if (!material.requiresApproval) return material;

  const [assignment, approved, progress] = await Promise.all([
    prisma.learningAssignment.findFirst({ where: { employeeId, materialId, status: 'ACTIVE' } }),
    prisma.learningRequest.findFirst({ where: { employeeId, materialId, status: 'APPROVED' } }),
    prisma.learningProgress.findUnique({ where: { employeeId_materialId: { employeeId, materialId } } }),
  ]);
  if (!assignment && !approved && !progress) {
    throw AppError.forbidden("Bu material uchun avval rahbar tasdig'i kerak — so'rov yuboring");
  }
  return material;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export async function startMaterial(auth: AuthContext, materialId: string) {
  const employeeId = await getSelfEmployeeId(auth);
  const material = await assertMaterialAccessible(auth, employeeId, materialId);

  const progress = await prisma.learningProgress.upsert({
    where: { employeeId_materialId: { employeeId, materialId } },
    create: { organizationId: auth.organizationId, employeeId, materialId },
    update: { lastOpenedAt: new Date() },
  });
  return { progress, contentUrl: material.contentUrl };
}

export async function updateProgress(auth: AuthContext, materialId: string, value: number) {
  const employeeId = await getSelfEmployeeId(auth);
  await assertMaterialAccessible(auth, employeeId, materialId);

  const completed = value >= 100;
  const data = {
    progress: Math.min(100, Math.max(0, value)),
    status: completed ? ('COMPLETED' as const) : ('IN_PROGRESS' as const),
    completedAt: completed ? new Date() : null,
    lastOpenedAt: new Date(),
  };
  return prisma.learningProgress.upsert({
    where: { employeeId_materialId: { employeeId, materialId } },
    create: { organizationId: auth.organizationId, employeeId, materialId, ...data },
    update: data,
  });
}

// "Davom ettirish" (IN_PROGRESS) va "Tarix" (COMPLETED) tablari uchun
export async function listMyProgress(auth: AuthContext, status: 'IN_PROGRESS' | 'COMPLETED') {
  const employeeId = await getSelfEmployeeId(auth);
  const rows = await prisma.learningProgress.findMany({
    where: { organizationId: auth.organizationId, employeeId, status, material: { status: 'PUBLISHED' } },
    orderBy: status === 'COMPLETED' ? { completedAt: 'desc' } : { lastOpenedAt: 'desc' },
    include: { material: { select: MATERIAL_LIST_SELECT } },
  });
  return decorateMaterials(
    auth.organizationId,
    employeeId,
    rows.map((r) => r.material),
  );
}

export async function listMyAssignments(auth: AuthContext) {
  const employeeId = await getSelfEmployeeId(auth);
  const rows = await prisma.learningAssignment.findMany({
    where: { organizationId: auth.organizationId, employeeId, status: 'ACTIVE', material: { status: 'PUBLISHED' } },
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    include: { material: { select: MATERIAL_LIST_SELECT } },
  });
  return decorateMaterials(
    auth.organizationId,
    employeeId,
    rows.map((r) => r.material),
  );
}

// ---------------------------------------------------------------------------
// Sevimlilar
// ---------------------------------------------------------------------------

export async function listMyFavorites(auth: AuthContext) {
  const employeeId = await getSelfEmployeeId(auth);
  const rows = await prisma.learningFavorite.findMany({
    where: { organizationId: auth.organizationId, employeeId, material: { status: 'PUBLISHED' } },
    orderBy: { createdAt: 'desc' },
    include: { material: { select: MATERIAL_LIST_SELECT } },
  });
  return decorateMaterials(
    auth.organizationId,
    employeeId,
    rows.map((r) => r.material),
  );
}

export async function setFavorite(auth: AuthContext, materialId: string, favorite: boolean) {
  const employeeId = await getSelfEmployeeId(auth);
  const material = await prisma.learningMaterial.findFirst({
    where: { id: materialId, organizationId: auth.organizationId, status: 'PUBLISHED' },
    select: { id: true },
  });
  if (!material) throw AppError.notFound('Material topilmadi');

  if (favorite) {
    await prisma.learningFavorite.upsert({
      where: { employeeId_materialId: { employeeId, materialId } },
      create: { organizationId: auth.organizationId, employeeId, materialId },
      update: {},
    });
  } else {
    await prisma.learningFavorite.deleteMany({ where: { employeeId, materialId } });
  }
  return { materialId, isFavorite: favorite };
}

// ---------------------------------------------------------------------------
// Tadbirlar
// ---------------------------------------------------------------------------

export async function listEvents(auth: AuthContext, query: { scope: 'upcoming' | 'mine' | 'past' }) {
  const employeeId = await getSelfEmployeeId(auth);
  const now = new Date();

  const where: Prisma.LearningEventWhereInput = { organizationId: auth.organizationId, status: 'PUBLISHED' };
  if (query.scope === 'upcoming') where.endsAt = { gte: now };
  if (query.scope === 'past') where.endsAt = { lt: now };
  if (query.scope === 'mine') where.registrations = { some: { employeeId, status: { in: ['REGISTERED', 'ATTENDED'] } } };

  const events = await prisma.learningEvent.findMany({
    where,
    orderBy: { startsAt: query.scope === 'upcoming' ? 'asc' : 'desc' },
    include: {
      registrations: { where: { status: { in: ['REGISTERED', 'ATTENDED'] } }, select: { employeeId: true, status: true } },
      requests: { where: { employeeId, status: { in: ['PENDING', 'APPROVED'] } }, select: { id: true, status: true } },
    },
  });

  return events.map(({ registrations, requests, ...event }) => {
    const mine = registrations.find((r) => r.employeeId === employeeId);
    return {
      ...event,
      registeredCount: registrations.length,
      myRegistration: mine ? { status: mine.status } : null,
      myRequest: requests[0] ?? null,
    };
  });
}

export async function registerForEvent(auth: AuthContext, eventId: string) {
  const employeeId = await getSelfEmployeeId(auth);
  const event = await prisma.learningEvent.findFirst({
    where: { id: eventId, organizationId: auth.organizationId, status: 'PUBLISHED' },
  });
  if (!event) throw AppError.notFound('Tadbir topilmadi');
  if (event.endsAt < new Date()) throw AppError.badRequest("Tadbir allaqachon o'tib ketgan");

  if (event.requiresApproval) {
    const approved = await prisma.learningRequest.findFirst({ where: { employeeId, eventId, status: 'APPROVED' } });
    if (!approved) throw AppError.forbidden("Bu tadbir uchun avval rahbar tasdig'i kerak — so'rov yuboring");
  }

  if (event.capacity !== null) {
    const taken = await prisma.learningEventRegistration.count({
      where: { eventId, status: { in: ['REGISTERED', 'ATTENDED'] }, NOT: { employeeId } },
    });
    if (taken >= event.capacity) throw AppError.badRequest("Bo'sh o'rin qolmagan");
  }

  return prisma.learningEventRegistration.upsert({
    where: { eventId_employeeId: { eventId, employeeId } },
    create: { organizationId: auth.organizationId, eventId, employeeId },
    update: { status: 'REGISTERED' },
  });
}

export async function cancelEventRegistration(auth: AuthContext, eventId: string) {
  const employeeId = await getSelfEmployeeId(auth);
  const registration = await prisma.learningEventRegistration.findFirst({
    where: { eventId, employeeId, organizationId: auth.organizationId },
  });
  if (!registration) throw AppError.notFound("Siz bu tadbirga yozilmagansiz");
  return prisma.learningEventRegistration.update({ where: { id: registration.id }, data: { status: 'CANCELLED' } });
}

// ---------------------------------------------------------------------------
// So'rovlar
// ---------------------------------------------------------------------------

export async function listMyRequests(auth: AuthContext) {
  const employeeId = await getSelfEmployeeId(auth);
  return prisma.learningRequest.findMany({
    where: { organizationId: auth.organizationId, employeeId },
    orderBy: { createdAt: 'desc' },
    include: {
      material: { select: { id: true, title: true, type: true } },
      event: { select: { id: true, title: true, startsAt: true } },
    },
  });
}

export async function createRequest(
  auth: AuthContext,
  input: { materialId?: string; eventId?: string; title?: string; externalUrl?: string; comment?: string },
) {
  const employeeId = await getSelfEmployeeId(auth);
  let title = input.title?.trim() ?? '';

  if (input.materialId) {
    const material = await prisma.learningMaterial.findFirst({
      where: { id: input.materialId, organizationId: auth.organizationId, status: 'PUBLISHED' },
    });
    if (!material) throw AppError.notFound('Material topilmadi');
    title = material.title;
  } else if (input.eventId) {
    const event = await prisma.learningEvent.findFirst({
      where: { id: input.eventId, organizationId: auth.organizationId, status: 'PUBLISHED' },
    });
    if (!event) throw AppError.notFound('Tadbir topilmadi');
    title = event.title;
  } else if (!title) {
    throw AppError.badRequest("So'rov nomini kiriting");
  }

  if (input.materialId || input.eventId) {
    const existing = await prisma.learningRequest.findFirst({
      where: {
        employeeId,
        materialId: input.materialId ?? undefined,
        eventId: input.eventId ?? undefined,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });
    if (existing) throw AppError.badRequest("Bu bo'yicha so'rov allaqachon yuborilgan");
  }

  return prisma.learningRequest.create({
    data: {
      organizationId: auth.organizationId,
      employeeId,
      materialId: input.materialId,
      eventId: input.eventId,
      title,
      externalUrl: input.externalUrl,
      comment: input.comment,
    },
  });
}

export async function cancelRequest(auth: AuthContext, requestId: string) {
  const employeeId = await getSelfEmployeeId(auth);
  const request = await prisma.learningRequest.findFirst({
    where: { id: requestId, employeeId, organizationId: auth.organizationId },
  });
  if (!request) throw AppError.notFound("So'rov topilmadi");
  if (request.status !== 'PENDING') throw AppError.badRequest("Faqat ko'rib chiqilmagan so'rovni bekor qilish mumkin");
  return prisma.learningRequest.update({ where: { id: requestId }, data: { status: 'CANCELLED' } });
}

// ---------------------------------------------------------------------------
// Rivojlanish maqsadlari
// ---------------------------------------------------------------------------

export async function listMyGoals(auth: AuthContext) {
  const employeeId = await getSelfEmployeeId(auth);
  const goals = await prisma.developmentGoal.findMany({
    where: { organizationId: auth.organizationId, employeeId, status: { not: 'CANCELLED' } },
    orderBy: [{ status: 'asc' }, { dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    include: { materials: { include: { material: { select: MATERIAL_LIST_SELECT } } } },
  });

  const materialIds = goals.flatMap((g) => g.materials.map((m) => m.materialId));
  const completed = await prisma.learningProgress.findMany({
    where: { employeeId, materialId: { in: materialIds }, status: 'COMPLETED' },
    select: { materialId: true },
  });
  const completedIds = new Set(completed.map((c) => c.materialId));

  return goals.map(({ materials, ...goal }) => ({
    ...goal,
    materials: materials.map((m) => ({ ...m.material, isCompleted: completedIds.has(m.materialId) })),
    completedCount: materials.filter((m) => completedIds.has(m.materialId)).length,
  }));
}

async function getOwnGoal(auth: AuthContext, goalId: string) {
  const employeeId = await getSelfEmployeeId(auth);
  const goal = await prisma.developmentGoal.findFirst({ where: { id: goalId, employeeId, organizationId: auth.organizationId } });
  if (!goal) throw AppError.notFound('Maqsad topilmadi');
  return goal;
}

export async function createGoal(
  auth: AuthContext,
  input: { title: string; description?: string; dueDate?: Date; materialIds?: string[] },
) {
  const employeeId = await getSelfEmployeeId(auth);
  const materialIds = await filterPublishedMaterialIds(auth.organizationId, input.materialIds ?? []);
  return prisma.developmentGoal.create({
    data: {
      organizationId: auth.organizationId,
      employeeId,
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      materials: { create: materialIds.map((materialId) => ({ materialId })) },
    },
  });
}

export async function updateGoal(
  auth: AuthContext,
  goalId: string,
  input: { title?: string; description?: string | null; dueDate?: Date | null; status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; materialIds?: string[] },
) {
  await getOwnGoal(auth, goalId);
  const { materialIds, ...data } = input;

  return prisma.$transaction(async (tx) => {
    if (materialIds) {
      const ids = await filterPublishedMaterialIds(auth.organizationId, materialIds);
      await tx.developmentGoalMaterial.deleteMany({ where: { goalId } });
      await tx.developmentGoalMaterial.createMany({ data: ids.map((materialId) => ({ goalId, materialId })) });
    }
    return tx.developmentGoal.update({ where: { id: goalId }, data });
  });
}

async function filterPublishedMaterialIds(organizationId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const found = await prisma.learningMaterial.findMany({
    where: { id: { in: ids }, organizationId, status: 'PUBLISHED' },
    select: { id: true },
  });
  return found.map((m) => m.id);
}

// ---------------------------------------------------------------------------
// Bosh sahifa uchun hisoblagichlar (tezkor kartalar)
// ---------------------------------------------------------------------------

export async function getSummary(auth: AuthContext) {
  const employeeId = await getSelfEmployeeId(auth);
  const organizationId = auth.organizationId;
  // Muddat eslatmalari shu yerda yuboriladi (cron o'rniga) — xato bo'lsa
  // ham bosh sahifa ochilaverishi kerak.
  await sendDueReminders(organizationId, employeeId, auth.userId).catch(() => undefined);
  const [favorites, pendingRequests, activeGoals, upcomingEvents, inProgress, assigned] = await Promise.all([
    prisma.learningFavorite.count({ where: { organizationId, employeeId, material: { status: 'PUBLISHED' } } }),
    prisma.learningRequest.count({ where: { organizationId, employeeId, status: 'PENDING' } }),
    prisma.developmentGoal.count({ where: { organizationId, employeeId, status: 'ACTIVE' } }),
    prisma.learningEvent.count({ where: { organizationId, status: 'PUBLISHED', endsAt: { gte: new Date() } } }),
    prisma.learningProgress.count({ where: { organizationId, employeeId, status: 'IN_PROGRESS' } }),
    prisma.learningAssignment.count({ where: { organizationId, employeeId, status: 'ACTIVE' } }),
  ]);
  return { favorites, pendingRequests, activeGoals, upcomingEvents, inProgress, assigned };
}
