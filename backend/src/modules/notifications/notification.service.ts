import { prisma } from '@/config/prisma';
import type { NotificationType, Prisma } from '@prisma/client';

interface CreateNotificationInput {
  organizationId: string;
  userId: string;
  type: NotificationType;
  message: string;
  entityType?: string;
  entityId?: string;
}

// Tranzaksiya ichida ham chaqirilishi mumkin (masalan workflow instance.service.ts
// ichida, ariza yuborilganda/tasdiqlanganda) — shuning uchun tx ixtiyoriy parametr.
export async function createNotification(
  input: CreateNotificationInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  await tx.notification.create({ data: input });
}

export async function listMyNotifications(organizationId: string, userId: string) {
  return prisma.notification.findMany({
    where: { organizationId, userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function markAsRead(organizationId: string, userId: string, notificationId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, organizationId, userId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(organizationId: string, userId: string) {
  await prisma.notification.updateMany({
    where: { organizationId, userId, isRead: false },
    data: { isRead: true },
  });
}
