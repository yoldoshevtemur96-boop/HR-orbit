import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';

interface CreateEducationInput {
  organizationId: string;
  employeeId: string;
  level: string;
  institution: string;
  specialty?: string;
  graduationYear?: number;
}

export async function addEducation(input: CreateEducationInput) {
  const employee = await prisma.employee.findFirst({ where: { id: input.employeeId, organizationId: input.organizationId } });
  if (!employee) throw AppError.notFound('Xodim topilmadi');

  return prisma.employeeEducation.create({
    data: {
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      level: input.level,
      institution: input.institution,
      specialty: input.specialty,
      graduationYear: input.graduationYear,
    },
  });
}

export async function listEducation(organizationId: string, employeeId: string) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, organizationId } });
  if (!employee) throw AppError.notFound('Xodim topilmadi');

  return prisma.employeeEducation.findMany({
    where: { employeeId },
    orderBy: { graduationYear: 'desc' },
  });
}
