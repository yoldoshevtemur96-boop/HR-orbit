import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import type { ApproverType, RoleName, StepActionType } from '@prisma/client';

export interface FormField {
  key: string; // masalan "startDate"
  label: string; // masalan "Boshlanish sanasi"
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  options?: string[]; // type === 'select' bo'lsa
}

export interface StepInput {
  order: number;
  name: string;
  approverType: ApproverType;
  approverRole?: RoleName;
  approverUserId?: string;
  actionType?: StepActionType;
}

export interface CreateTemplateInput {
  organizationId: string;
  name: string;
  description?: string;
  formSchema: FormField[];
  documentBody?: string;
  steps: StepInput[];
}

// Konstruktor: yangi ariza turi (masalan "Mehnat ta'tiliga chiqish") va uning
// tasdiqlash zanjirini bir vaqtda yaratadi. Zanjir tartibi `order` bo'yicha
// ketma-ket bo'lishi shart — aks holda ijro vaqtida "keyingi bosqich" topilmay qoladi.
export async function createTemplate(input: CreateTemplateInput) {
  validateSteps(input.steps);

  return prisma.workflowTemplate.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      description: input.description,
      formSchema: input.formSchema as any,
      documentBody: input.documentBody,
      steps: {
        create: input.steps.map((step) => ({
          order: step.order,
          name: step.name,
          approverType: step.approverType,
          approverRole: step.approverRole,
          approverUserId: step.approverUserId,
          actionType: step.actionType ?? 'APPROVE',
        })),
      },
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
}

function validateSteps(steps: StepInput[]) {
  if (steps.length === 0) {
    throw AppError.badRequest('Kamida bitta tasdiqlash bosqichi kerak');
  }
  const orders = steps.map((s) => s.order).sort((a, b) => a - b);
  const expected = Array.from({ length: steps.length }, (_, i) => i + 1);
  const isSequential = orders.every((val, idx) => val === expected[idx]);
  if (!isSequential) {
    throw AppError.badRequest('Bosqichlar tartibi 1 dan boshlab ketma-ket bo\'lishi kerak (1, 2, 3, ...)');
  }
  for (const step of steps) {
    if (step.approverType === 'SPECIFIC_USER' && !step.approverUserId) {
      throw AppError.badRequest(`"${step.name}" bosqichi uchun approverUserId ko'rsatilmagan`);
    }
    if (step.approverType === 'ROLE' && !step.approverRole) {
      throw AppError.badRequest(`"${step.name}" bosqichi uchun approverRole ko'rsatilmagan`);
    }
  }
}

export async function listTemplates(organizationId: string) {
  return prisma.workflowTemplate.findMany({
    where: { organizationId, isActive: true },
    include: { steps: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTemplateById(organizationId: string, templateId: string) {
  const template = await prisma.workflowTemplate.findFirst({
    where: { id: templateId, organizationId },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!template) {
    throw AppError.notFound('Shablon topilmadi');
  }
  return template;
}

export async function deactivateTemplate(organizationId: string, templateId: string) {
  await getTemplateById(organizationId, templateId); // tenant tekshiruvi
  return prisma.workflowTemplate.update({
    where: { id: templateId },
    data: { isActive: false },
  });
}
