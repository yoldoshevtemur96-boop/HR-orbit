import type { LearningMaterialType, Prisma, RoleName } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { sendDueReminders } from './assignment.service';
import { syncRulesForEmployee } from './rule.service';
import { signedFilePath } from '@/modules/files/file.service';

interface AuthContext {
  userId: string;
  organizationId: string;
  role: RoleName;
}

// Learning & Development — xodim tomoni. Har bir amal joriy foydalanuvchiga
// bog'langan xodim profili (Employee) nomidan bajariladi.
async function getSelfEmployee(auth: AuthContext) {
  const employee = await prisma.employee.findFirst({
    where: { userId: auth.userId, organizationId: auth.organizationId },
    select: { id: true, departmentId: true, positionId: true, branchId: true },
  });
  if (!employee) throw AppError.notFound("Sizga bog'langan xodim profili topilmadi");
  return employee;
}

async function getSelfEmployeeId(auth: AuthContext): Promise<string> {
  return (await getSelfEmployee(auth)).id;
}

type SelfEmployee = Awaited<ReturnType<typeof getSelfEmployee>>;

// Xodim katalogda ko'radigan materiallar: nashr qilingan va
// (a) unga tayinlangan — har doim, yoki
// (b) ko'rinish muddati ichida va hammaga / uning bo'limi, lavozimi yoki filialiga ochiq.
function visibleMaterialWhere(organizationId: string, employee: SelfEmployee): Prisma.LearningMaterialWhereInput {
  const now = new Date();
  const audience: Prisma.LearningMaterialWhereInput[] = [];
  if (employee.departmentId) audience.push({ visibleDepartmentIds: { has: employee.departmentId } });
  if (employee.positionId) audience.push({ visiblePositionIds: { has: employee.positionId } });
  if (employee.branchId) audience.push({ visibleBranchIds: { has: employee.branchId } });

  return {
    organizationId,
    status: 'PUBLISHED',
    OR: [
      { assignments: { some: { employeeId: employee.id, status: 'ACTIVE' } } },
      {
        AND: [
          { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
          { OR: [{ availableUntil: null }, { availableUntil: { gte: now } }] },
          { OR: [{ visibility: 'ALL' }, ...(audience.length ? [{ visibility: 'AUDIENCE' as const, OR: audience }] : [])] },
        ],
      },
    ],
  };
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
  const employee = await getSelfEmployee(auth);
  const employeeId = employee.id;
  const and: Prisma.LearningMaterialWhereInput[] = [visibleMaterialWhere(auth.organizationId, employee)];
  if (query.type) and.push({ type: query.type });
  if (query.search) {
    const search = query.search.trim();
    and.push({
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ],
    });
  }
  const materials = await prisma.learningMaterial.findMany({
    where: { AND: and },
    select: MATERIAL_LIST_SELECT,
    orderBy: { publishedAt: 'desc' },
    take: query.limit ?? 100,
  });
  return decorateMaterials(auth.organizationId, employeeId, materials);
}

export async function getMaterial(auth: AuthContext, materialId: string) {
  const employee = await getSelfEmployee(auth);
  const employeeId = employee.id;
  const material = await prisma.learningMaterial.findFirst({
    where: { AND: [{ id: materialId }, visibleMaterialWhere(auth.organizationId, employee)] },
    select: {
      ...MATERIAL_LIST_SELECT,
      contentUrl: true,
      contentSource: true,
      contentFileId: true,
      displayMode: true,
      completionRule: true,
      allowDownload: true,
      level: true,
      language: true,
    },
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

  const contentFile =
    material.contentSource === 'FILE' && material.contentFileId
      ? await prisma.storedFile.findUnique({
          where: { id: material.contentFileId },
          select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
        })
      : null;

  return {
    ...decorated,
    contentSource: material.contentSource,
    displayMode: material.displayMode,
    completionRule: material.completionRule,
    allowDownload: material.allowDownload,
    level: material.level,
    language: material.language,
    // Fayl — vaqtinchalik imzoli havola (frontend api manziliga qo'shadi)
    contentUrl: !hasAccess ? null : contentFile ? signedFilePath(contentFile.id) : material.contentUrl,
    downloadUrl: hasAccess && contentFile && material.allowDownload ? signedFilePath(contentFile.id, true) : null,
    contentFile: hasAccess && contentFile ? { fileName: contentFile.fileName, mimeType: contentFile.mimeType, sizeBytes: contentFile.sizeBytes } : null,
    hasAccess,
    request: pendingRequest,
  };
}

async function assertMaterialAccessible(auth: AuthContext, employeeId: string, materialId: string) {
  const employee = await getSelfEmployee(auth);
  const material = await prisma.learningMaterial.findFirst({
    where: { AND: [{ id: materialId }, visibleMaterialWhere(auth.organizationId, employee)] },
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

  // "Ochilganda tugatilgan" sharti — birinchi ochishdayoq yakunlanadi
  const completeNow = material.completionRule === 'ON_OPEN';
  const now = new Date();
  const progress = await prisma.learningProgress.upsert({
    where: { employeeId_materialId: { employeeId, materialId } },
    create: {
      organizationId: auth.organizationId,
      employeeId,
      materialId,
      ...(completeNow ? { progress: 100, status: 'COMPLETED' as const, completedAt: now } : {}),
    },
    update: {
      lastOpenedAt: now,
      ...(completeNow ? { progress: 100, status: 'COMPLETED' as const, completedAt: now } : {}),
    },
  });
  return {
    progress,
    contentUrl: material.contentSource === 'FILE' && material.contentFileId ? signedFilePath(material.contentFileId) : material.contentUrl,
  };
}

export async function updateProgress(auth: AuthContext, materialId: string, value: number) {
  const employeeId = await getSelfEmployeeId(auth);
  await assertMaterialAccessible(auth, employeeId, materialId);

  // Progress faqat oshadi, tugatilgan material qayta ko'rilganda ham
  // "tugatilgan"ligicha qoladi (pleyer qayta ko'rishda kichik foiz yuboradi).
  const existing = await prisma.learningProgress.findUnique({
    where: { employeeId_materialId: { employeeId, materialId } },
  });
  if (existing?.status === 'COMPLETED') {
    return prisma.learningProgress.update({ where: { id: existing.id }, data: { lastOpenedAt: new Date() } });
  }

  const next = Math.min(100, Math.max(existing?.progress ?? 0, value));
  const completed = next >= 100;
  const data = {
    progress: next,
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
  // Doimiy qoidalar ham shu yerda xodimning o'zi uchun tekshiriladi
  // (masalan, "yangi xodimlar" qoidasi yoki o'tkazib yuborilgan voqea).
  await syncRulesForEmployee(organizationId, employeeId).catch(() => undefined);
  await sendDueReminders(organizationId, employeeId, auth.userId).catch(() => undefined);
  const [favorites, pendingRequests, activeGoals, upcomingEvents, inProgress, assigned, recommended] = await Promise.all([
    prisma.learningFavorite.count({ where: { organizationId, employeeId, material: { status: 'PUBLISHED' } } }),
    prisma.learningRequest.count({ where: { organizationId, employeeId, status: 'PENDING' } }),
    prisma.developmentGoal.count({ where: { organizationId, employeeId, status: 'ACTIVE' } }),
    prisma.learningEvent.count({ where: { organizationId, status: 'PUBLISHED', endsAt: { gte: new Date() } } }),
    prisma.learningProgress.count({ where: { organizationId, employeeId, status: 'IN_PROGRESS' } }),
    prisma.learningAssignment.count({ where: { organizationId, employeeId, status: 'ACTIVE' } }),
    prisma.learningRecommendation
      .findMany({
        where: { organizationId, toEmployeeId: employeeId, dismissedAt: null, material: { status: 'PUBLISHED' } },
        distinct: ['materialId'],
        select: { materialId: true },
      })
      .then((rows) => rows.length),
  ]);
  return { favorites, pendingRequests, activeGoals, upcomingEvents, inProgress, assigned, recommended };
}

// ---------------------------------------------------------------------------
// Hamkasblar tavsiyasi
// ---------------------------------------------------------------------------

const ACTIVE_EMPLOYMENT = ['ACTIVE', 'PROBATION', 'ON_LEAVE'] as const;

export async function listColleagues(auth: AuthContext, search?: string) {
  const employeeId = await getSelfEmployeeId(auth);
  const where: Prisma.EmployeeWhereInput = {
    organizationId: auth.organizationId,
    id: { not: employeeId },
    status: { in: [...ACTIVE_EMPLOYMENT] },
  };
  if (search?.trim()) {
    where.OR = [
      { fullName: { contains: search.trim(), mode: 'insensitive' } },
      { employeeCode: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }
  const employees = await prisma.employee.findMany({
    where,
    select: { id: true, fullName: true, department: { select: { name: true } }, position: { select: { name: true } } },
    orderBy: { fullName: 'asc' },
    take: 50,
  });
  return employees.map((e) => ({
    id: e.id,
    fullName: e.fullName,
    department: e.department?.name ?? null,
    position: e.position?.name ?? null,
  }));
}

export async function recommendMaterial(
  auth: AuthContext,
  materialId: string,
  input: { employeeIds: string[]; comment?: string },
) {
  const fromEmployeeId = await getSelfEmployeeId(auth);
  const material = await prisma.learningMaterial.findFirst({
    where: { id: materialId, organizationId: auth.organizationId, status: 'PUBLISHED' },
    select: { id: true, title: true },
  });
  if (!material) throw AppError.notFound('Material topilmadi');

  const [sender, recipients] = await Promise.all([
    prisma.employee.findUnique({ where: { id: fromEmployeeId }, select: { fullName: true } }),
    prisma.employee.findMany({
      where: {
        organizationId: auth.organizationId,
        id: { in: input.employeeIds, not: fromEmployeeId },
        status: { in: [...ACTIVE_EMPLOYMENT] },
      },
      select: { id: true, userId: true },
    }),
  ]);
  if (recipients.length === 0) throw AppError.badRequest('Kamida bitta hamkasbni tanlang');

  const comment = input.comment?.trim() || null;
  await prisma.$transaction([
    ...recipients.map((r) =>
      prisma.learningRecommendation.upsert({
        where: { fromEmployeeId_toEmployeeId_materialId: { fromEmployeeId, toEmployeeId: r.id, materialId } },
        create: { organizationId: auth.organizationId, materialId, fromEmployeeId, toEmployeeId: r.id, comment },
        update: { comment, dismissedAt: null },
      }),
    ),
    prisma.notification.createMany({
      data: recipients
        .filter((r) => r.userId)
        .map((r) => ({
          organizationId: auth.organizationId,
          userId: r.userId!,
          type: 'LEARNING_RECOMMENDED' as const,
          message: `${sender?.fullName ?? 'Hamkasbingiz'} sizga "${material.title}" materialini tavsiya qildi`,
          entityType: 'LearningMaterial',
          entityId: materialId,
        })),
    }),
  ]);
  return { recommendedCount: recipients.length };
}

// "Tavsiya etilgan" tabi: har bir material bir marta, kim(lar) tavsiya
// qilgani va izohlari bilan — eng yangi tavsiya birinchi.
export async function listMyRecommendations(auth: AuthContext) {
  const employee = await getSelfEmployee(auth);
  const employeeId = employee.id;
  const recommendations = await prisma.learningRecommendation.findMany({
    where: {
      organizationId: auth.organizationId,
      toEmployeeId: employeeId,
      dismissedAt: null,
      material: visibleMaterialWhere(auth.organizationId, employee),
    },
    orderBy: { updatedAt: 'desc' },
    include: { material: { select: MATERIAL_LIST_SELECT } },
  });

  const senders = await prisma.employee.findMany({
    where: { id: { in: [...new Set(recommendations.map((r) => r.fromEmployeeId))] } },
    select: { id: true, fullName: true },
  });
  const senderName = new Map(senders.map((s) => [s.id, s.fullName]));

  const byMaterial = new Map<
    string,
    { material: MaterialListItem; recommendedBy: { fullName: string; comment: string | null; createdAt: Date }[] }
  >();
  for (const r of recommendations) {
    const entry = byMaterial.get(r.materialId) ?? { material: r.material, recommendedBy: [] };
    entry.recommendedBy.push({ fullName: senderName.get(r.fromEmployeeId) ?? '—', comment: r.comment, createdAt: r.updatedAt });
    byMaterial.set(r.materialId, entry);
  }

  const entries = [...byMaterial.values()];
  const decorated = await decorateMaterials(
    auth.organizationId,
    employeeId,
    entries.map((e) => e.material),
  );
  return decorated.map((m, i) => ({ ...m, recommendedBy: entries[i].recommendedBy }));
}

export async function dismissRecommendations(auth: AuthContext, materialId: string) {
  const employeeId = await getSelfEmployeeId(auth);
  const result = await prisma.learningRecommendation.updateMany({
    where: { organizationId: auth.organizationId, toEmployeeId: employeeId, materialId, dismissedAt: null },
    data: { dismissedAt: new Date() },
  });
  return { dismissed: result.count };
}
