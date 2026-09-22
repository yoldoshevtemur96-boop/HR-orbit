import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';

interface CreateCandidateInput {
  organizationId: string;
  vacancyId: string;
  fullName: string;
  email?: string;
  phone?: string;
  resumeUrl?: string;
}

export async function createCandidate(input: CreateCandidateInput) {
  const vacancy = await prisma.vacancy.findFirst({
    where: { id: input.vacancyId, organizationId: input.organizationId },
  });
  if (!vacancy) {
    throw AppError.notFound('Vakansiya topilmadi');
  }
  return prisma.candidate.create({ data: input });
}

const STAGE_ORDER = ['NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

export async function moveCandidateStage(organizationId: string, candidateId: string, stage: string) {
  if (!STAGE_ORDER.includes(stage)) {
    throw AppError.badRequest("Noto'g'ri bosqich nomi");
  }
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, organizationId } });
  if (!candidate) {
    throw AppError.notFound('Nomzod topilmadi');
  }
  return prisma.candidate.update({ where: { id: candidateId }, data: { stage: stage as any } });
}

// Nomzod ishga qabul qilinganda: Candidate.stage = HIRED, va avtomatik
// Core HR'da Employee yozuvi ochiladi — Recruiter va KDP shu orqali bog'lanadi.
export async function hireCandidate(
  organizationId: string,
  candidateId: string,
  input: { position: string; departmentId?: string; managerId?: string },
) {
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, organizationId } });
  if (!candidate) {
    throw AppError.notFound('Nomzod topilmadi');
  }

  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        organizationId,
        fullName: candidate.fullName,
        position: input.position,
        departmentId: input.departmentId,
        managerId: input.managerId,
      },
    });
    await tx.candidate.update({ where: { id: candidateId }, data: { stage: 'HIRED' } });
    return employee;
  });
}

export async function listCandidatesByVacancy(organizationId: string, vacancyId: string) {
  return prisma.candidate.findMany({
    where: { organizationId, vacancyId },
    orderBy: { createdAt: 'desc' },
  });
}
