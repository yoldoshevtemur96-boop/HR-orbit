import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import type { PrismaClient, RoleName } from '@prisma/client';

interface CreateInstanceInput {
  organizationId: string;
  templateId: string;
  initiatorUserId: string;
  employeeId: string;
  formData: Record<string, unknown>;
}

// Xodim "Ariza yuborish" tugmasini bosganda ishlaydi:
// 1. Shablonni va uning zanjirini o'qiydi
// 2. Forma matnidan hujjat generatsiya qiladi ({{maydon}} o'rniga qiymat)
// 3. Instance yaratadi va zanjirdagi HAR BIR bosqich uchun PENDING action yozuvini oldindan tayyorlaydi
// 4. Birinchi bosqichning ijrochisini aniqlaydi (assignedUserId)
export async function createInstance(input: CreateInstanceInput) {
  const template = await prisma.workflowTemplate.findFirst({
    where: { id: input.templateId, organizationId: input.organizationId, isActive: true },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!template) {
    throw AppError.notFound('Shablon topilmadi yoki faol emas');
  }
  if (template.steps.length === 0) {
    throw AppError.badRequest("Shablonda tasdiqlash bosqichlari yo'q");
  }

  validateFormData(template.formSchema as any, input.formData);

  const generatedDocument = renderDocument(template.documentBody ?? '', input.formData);

  // Tranzaksiya faqat yozish amallarini o'z ichiga oladi va instance.id'ni
  // qaytaradi — o'qish (getInstanceById) tranzaksiyadan TASHQARIDA bajariladi.
  // Sabab: tx obyekti commit bo'lgach yopiladi; agar uni keyin ham ishlatishga
  // urinsak (masalan tarmoq kechikishi tufayli tranzaksiya muddati tugab qolsa),
  // "Transaction not found" xatosi chiqadi. maxWait/timeout esa bulut DB
  // (Supabase pooler) kechikishlariga bardosh berish uchun oshirilgan.
  const instanceId = await prisma.$transaction(
    async (tx) => {
      const instance = await tx.workflowInstance.create({
        data: {
          organizationId: input.organizationId,
          templateId: input.templateId,
          initiatorUserId: input.initiatorUserId,
          employeeId: input.employeeId,
          formData: input.formData as any,
          generatedDocument,
          currentStepOrder: 1,
        },
      });

      // Har bir bosqich uchun oldindan PENDING yozuv — shu orqali kuzatuv ekranida
      // "kimda turibdi, kim hali navbatda" bir so'rovda ko'rinadi.
      for (const step of template.steps) {
        const assignedUserId = await resolveApprover(tx, input.organizationId, input.employeeId, step);
        await tx.workflowStepAction.create({
          data: {
            instanceId: instance.id,
            stepId: step.id,
            assignedUserId,
            status: 'PENDING',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          userId: input.initiatorUserId,
          action: 'workflow.instance.created',
          entityType: 'WorkflowInstance',
          entityId: instance.id,
        },
      });

      return instance.id;
    },
    { maxWait: 15000, timeout: 20000 },
  );

  return getInstanceById(input.organizationId, instanceId);
}

// Bosqich qoidasiga qarab "aniq kim tasdiqlaydi"ni hisoblaydi.
// DIRECT_MANAGER / DEPARTMENT_HEAD — tashkiliy tuzilmadan dinamik aniqlanadi,
// shuning uchun zanjirni qurishda "bo'lim boshlig'i" deb bitta marta yozib qo'yish kifoya —
// har bir xodim uchun to'g'ri odam avtomatik topiladi.
async function resolveApprover(
  tx: Omit<PrismaClient, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>,
  organizationId: string,
  employeeId: string,
  step: { approverType: string; approverRole: RoleName | null; approverUserId: string | null },
): Promise<string | null> {
  switch (step.approverType) {
    case 'SPECIFIC_USER':
      return step.approverUserId;

    case 'ROLE': {
      const user = await tx.user.findFirst({
        where: { organizationId, role: step.approverRole ?? undefined, isActive: true },
      });
      return user?.id ?? null;
    }

    case 'DIRECT_MANAGER': {
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        include: { manager: true },
      });
      return employee?.manager?.userId ?? null;
    }

    case 'DEPARTMENT_HEAD': {
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        include: { department: { include: { headEmployee: true } } },
      });
      return employee?.department?.headEmployee?.userId ?? null;
    }

    default:
      return null;
  }
}

interface DecideStepInput {
  organizationId: string;
  instanceId: string;
  actingUserId: string;
  decision: 'APPROVED' | 'REJECTED';
  comment?: string;
}

// Zanjirdagi joriy bosqichda turgan odam "tasdiqlash" yoki "rad etish" tugmasini bosganda.
// Tasdiqlansa — navbat avtomatik keyingi bosqichga o'tadi; oxirgi bosqich bo'lsa,
// butun instance APPROVED bo'ladi. Rad etilsa — butun zanjir to'xtaydi (REJECTED).
export async function decideStep(input: DecideStepInput) {
  const instanceId = await prisma.$transaction(
    async (tx) => {
      const instance = await tx.workflowInstance.findFirst({
        where: { id: input.instanceId, organizationId: input.organizationId },
        include: { template: { include: { steps: { orderBy: { order: 'asc' } } } } },
      });
      if (!instance) {
        throw AppError.notFound('Ariza topilmadi');
      }
      if (instance.status !== 'IN_PROGRESS') {
        throw AppError.badRequest('Bu ariza allaqachon yakunlangan');
      }

      const currentStep = instance.template.steps.find((s) => s.order === instance.currentStepOrder);
      if (!currentStep) {
        throw AppError.badRequest('Joriy bosqich topilmadi');
      }

      const action = await tx.workflowStepAction.findUnique({
        where: { instanceId_stepId: { instanceId: instance.id, stepId: currentStep.id } },
      });
      if (!action) {
        throw AppError.notFound('Bosqich yozuvi topilmadi');
      }
      if (action.assignedUserId && action.assignedUserId !== input.actingUserId) {
        throw AppError.forbidden('Bu bosqich sizga tayinlanmagan');
      }
      if (action.status !== 'PENDING') {
        throw AppError.badRequest("Bu bosqich allaqachon ko'rib chiqilgan");
      }

      await tx.workflowStepAction.update({
        where: { id: action.id },
        data: {
          status: input.decision,
          comment: input.comment,
          actedAt: new Date(),
          assignedUserId: input.actingUserId,
        },
      });

      if (input.decision === 'REJECTED') {
        await tx.workflowInstance.update({
          where: { id: instance.id },
          data: { status: 'REJECTED' },
        });
      } else {
        const nextStep = instance.template.steps.find((s) => s.order === instance.currentStepOrder + 1);
        if (nextStep) {
          // Keyingi bosqichga o'tkazamiz. Agar avvalgi resolveApprover paytida
          // ijrochi topilmagan bo'lsa (masalan rahbar hali tayinlanmagan), shu yerda qayta hisoblanadi.
          const nextAction = await tx.workflowStepAction.findUnique({
            where: { instanceId_stepId: { instanceId: instance.id, stepId: nextStep.id } },
          });
          if (nextAction && !nextAction.assignedUserId) {
            const assignedUserId = await resolveApprover(tx, input.organizationId, instance.employeeId, nextStep);
            await tx.workflowStepAction.update({ where: { id: nextAction.id }, data: { assignedUserId } });
          }
          await tx.workflowInstance.update({
            where: { id: instance.id },
            data: { currentStepOrder: nextStep.order },
          });
        } else {
          // Zanjirning oxiri — ariza to'liq tasdiqlandi
          await tx.workflowInstance.update({
            where: { id: instance.id },
            data: { status: 'APPROVED' },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          userId: input.actingUserId,
          action: `workflow.step.${input.decision.toLowerCase()}`,
          entityType: 'WorkflowInstance',
          entityId: instance.id,
          metadata: { stepId: currentStep.id, comment: input.comment },
        },
      });

      return instance.id;
    },
    { maxWait: 15000, timeout: 20000 },
  );

  return getInstanceById(input.organizationId, instanceId);
}

// Kuzatuv ekrani uchun: "kimga bordi, kim imzolagan, kim navbatda" — bitta obyektda.
export async function getInstanceById(
  organizationId: string,
  instanceId: string,
  tx: any = prisma,
) {
  const instance = await tx.workflowInstance.findFirst({
    where: { id: instanceId, organizationId },
    include: {
      template: { include: { steps: { orderBy: { order: 'asc' } } } },
      employee: true,
      initiator: { select: { id: true, email: true } },
      stepActions: {
        include: { step: true, assignedUser: { select: { id: true, email: true } } },
      },
    },
  });
  if (!instance) {
    throw AppError.notFound('Ariza topilmadi');
  }

  const timeline = instance.template.steps.map((step: any) => {
    const action = instance.stepActions.find((a: any) => a.stepId === step.id);
    return {
      order: step.order,
      stepName: step.name,
      status: action?.status ?? 'PENDING',
      assignedUser: action?.assignedUser ?? null,
      comment: action?.comment ?? null,
      actedAt: action?.actedAt ?? null,
      isCurrent: step.order === instance.currentStepOrder && instance.status === 'IN_PROGRESS',
    };
  });

  return { ...instance, timeline };
}

// Xodimning o'z arizalari ro'yxati
export async function listMyInstances(organizationId: string, initiatorUserId: string) {
  return prisma.workflowInstance.findMany({
    where: { organizationId, initiatorUserId },
    include: { template: true },
    orderBy: { createdAt: 'desc' },
  });
}

// HR/menejer uchun: barcha faol arizalar (kimda turibdi — filtrlash mumkin)
export async function listOrganizationInstances(organizationId: string, status?: string) {
  return prisma.workflowInstance.findMany({
    where: { organizationId, status: status as any },
    include: { template: true, employee: true },
    orderBy: { createdAt: 'desc' },
  });
}

// "Menga kelgan, mendan javob kutilayotgan" arizalar — zanjirdagi ishtirokchining shaxsiy navbati
export async function listPendingForUser(organizationId: string, userId: string) {
  return prisma.workflowStepAction.findMany({
    where: {
      status: 'PENDING',
      assignedUserId: userId,
      instance: { organizationId, status: 'IN_PROGRESS' },
    },
    include: {
      step: true,
      instance: { include: { template: true, employee: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

function validateFormData(schema: Array<{ key: string; label: string; required: boolean }>, data: Record<string, unknown>) {
  for (const field of schema) {
    if (field.required && (data[field.key] === undefined || data[field.key] === '')) {
      throw AppError.badRequest(`"${field.label}" maydoni to'ldirilishi shart`);
    }
  }
}

function renderDocument(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? ''));
}
