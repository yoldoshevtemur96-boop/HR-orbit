import type { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';

type TxClient = Prisma.TransactionClient;

interface RecordAuditLogInput {
  organizationId: string;
  userId: string;
  action: string; // masalan: "employee.created", "employee.employment.changed"
  entityType: string; // masalan: "Employee", "Department"
  entityId: string;
  metadata?: object;
}

// Tranzaksiya ichida ham, tashqarisida ham ishlatilishi mumkin (tx berilsa
// o'sha client, berilmasa global prisma). Audit yozuvlari hech qachon
// oddiy foydalanuvchi tomonidan tahrirlanmaydi — bu yerda faqat CREATE bor,
// UPDATE/DELETE endpoint umuman mavjud emas.
export async function recordAuditLog(input: RecordAuditLogInput, tx: TxClient | typeof prisma = prisma) {
  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata as Prisma.InputJsonValue,
    },
  });
}

interface ListAuditLogInput {
  organizationId: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
}

export async function listAuditLog(input: ListAuditLogInput) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 50;

  const where: Prisma.AuditLogWhereInput = {
    organizationId: input.organizationId,
    entityType: input.entityType,
    entityId: input.entityId,
    userId: input.userId,
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total, page, pageSize };
}
