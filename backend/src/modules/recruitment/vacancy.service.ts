import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';

export async function createVacancy(organizationId: string, title: string, description?: string, departmentId?: string) {
  return prisma.vacancy.create({ data: { organizationId, title, description, departmentId } });
}

export async function listVacancies(organizationId: string) {
  return prisma.vacancy.findMany({
    where: { organizationId },
    include: { _count: { select: { candidates: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getVacancyById(organizationId: string, vacancyId: string) {
  const vacancy = await prisma.vacancy.findFirst({
    where: { id: vacancyId, organizationId },
    include: { candidates: { orderBy: { createdAt: 'desc' } } },
  });
  if (!vacancy) {
    throw AppError.notFound('Vakansiya topilmadi');
  }
  return vacancy;
}

export async function closeVacancy(organizationId: string, vacancyId: string) {
  await getVacancyById(organizationId, vacancyId);
  return prisma.vacancy.update({ where: { id: vacancyId }, data: { status: 'CLOSED' } });
}
