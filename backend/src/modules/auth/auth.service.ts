import bcrypt from 'bcryptjs';
import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './jwt';

interface RegisterOrgInput {
  organizationName: string;
  organizationSlug: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName: string;
}

// Yangi tashkilotni va uning birinchi SUPER_ADMIN foydalanuvchisini
// bitta tranzaksiyada yaratadi — SaaS'ga yangi mijoz shu yo'l bilan qo'shiladi.
export async function registerOrganization(input: RegisterOrgInput) {
  const existingSlug = await prisma.organization.findUnique({
    where: { slug: input.organizationSlug },
  });
  if (existingSlug) {
    throw AppError.conflict("Bu tashkilot slug'i band");
  }

  const passwordHash = await bcrypt.hash(input.adminPassword, 10);

  const { organization, user } = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: input.organizationName, slug: input.organizationSlug },
    });

    const [firstName, ...rest] = input.adminFullName.trim().split(/\s+/);
    const lastName = rest.join(' ') || firstName;

    const user = await tx.user.create({
      data: {
        organizationId: organization.id,
        email: input.adminEmail,
        passwordHash,
        role: 'SUPER_ADMIN',
        employee: {
          create: {
            organizationId: organization.id,
            employeeCode: 'EMP-00001',
            firstName,
            lastName,
            fullName: input.adminFullName,
            workEmail: input.adminEmail,
          },
        },
      },
    });

    return { organization, user };
  });

  return issueTokens(user.id, organization.id, user.role);
}

export async function login(email: string, password: string, organizationSlug: string) {
  const organization = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
  });
  if (!organization) {
    throw AppError.unauthorized("Tashkilot topilmadi");
  }

  const user = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: organization.id, email } },
  });
  if (!user || !user.isActive) {
    throw AppError.unauthorized("Email yoki parol noto'g'ri");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw AppError.unauthorized("Email yoki parol noto'g'ri");
  }

  return issueTokens(user.id, user.organizationId, user.role);
}

export async function refreshAccessToken(refreshToken: string) {
  let payload: { userId: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized("Refresh token yaroqsiz yoki muddati o'tgan");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive) {
    throw AppError.unauthorized('Foydalanuvchi topilmadi');
  }

  return issueTokens(user.id, user.organizationId, user.role);
}

function issueTokens(userId: string, organizationId: string, role: import('@prisma/client').RoleName) {
  const accessToken = signAccessToken({ userId, organizationId, role });
  const refreshToken = signRefreshToken({ userId });
  return { accessToken, refreshToken };
}
