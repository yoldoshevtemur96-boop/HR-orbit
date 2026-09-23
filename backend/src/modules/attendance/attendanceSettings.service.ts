import { prisma } from '@/config/prisma';

// Tashkilotda hali sozlama yaratilmagan bo'lsa ham, standart qiymatlar
// bilan ishlashi uchun — birinchi so'rovda avtomatik yaratiladi.
export async function getSettings(organizationId: string) {
  const existing = await prisma.attendanceSettings.findUnique({ where: { organizationId } });
  if (existing) return existing;

  return prisma.attendanceSettings.create({ data: { organizationId } });
}

interface UpdateSettingsInput {
  standardStartTime?: string;
  standardEndTime?: string;
  standardWorkMinutes?: number;
  lateThresholdMinutes?: number;
}

export async function updateSettings(organizationId: string, input: UpdateSettingsInput) {
  await getSettings(organizationId); // yozuv mavjudligini kafolatlaydi

  return prisma.attendanceSettings.update({
    where: { organizationId },
    data: input,
  });
}
