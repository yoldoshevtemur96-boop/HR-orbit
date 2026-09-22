import type { EmploymentStatus, EmploymentType, Prisma, RoleName } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';
import { recordAuditLog } from './auditLog.service';
import { sanitizeEmployeeForRole, sanitizeEmployeeListForRole } from './employee.serializer';

interface AuthContext {
  userId: string;
  organizationId: string;
  role: RoleName;
}

const EMPLOYEE_INCLUDE = {
  position: { select: { id: true, name: true, code: true } },
  department: { select: { id: true, name: true, code: true } },
  branch: { select: { id: true, name: true, code: true } },
  manager: { select: { id: true, fullName: true, employeeCode: true } },
} satisfies Prisma.EmployeeInclude;

// --------------------------------------------------------------------------
// Create
// --------------------------------------------------------------------------

interface CreateEmployeeInput {
  organizationId: string;
  actingUserId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth?: Date;
  gender?: 'MALE' | 'FEMALE';
  pinfl?: string;
  passportNumber?: string;
  personalPhone?: string;
  workPhone?: string;
  personalEmail?: string;
  workEmail?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  departmentId?: string;
  branchId?: string;
  positionId?: string;
  managerId?: string;
  status?: EmploymentStatus;
  employmentType?: EmploymentType;
  contractNumber?: string;
  contractStartDate?: Date;
  contractEndDate?: Date;
  workSchedule?: string;
  workLocation?: string;
  hiredAt?: Date;
}

export async function createEmployee(input: CreateEmployeeInput) {
  await assertUniqueFields(input.organizationId, {
    employeeCode: input.employeeCode,
    pinfl: input.pinfl,
    workEmail: input.workEmail,
  });

  if (input.departmentId) {
    await assertDepartmentExists(input.organizationId, input.departmentId);
  }
  if (input.positionId) {
    await assertPositionExists(input.organizationId, input.positionId);
  }

  const fullName = buildFullName(input.firstName, input.lastName, input.middleName);
  const hiredAt = input.hiredAt ?? new Date();

  const employee = await prisma.$transaction(async (tx) => {
    const created = await tx.employee.create({
      data: {
        organizationId: input.organizationId,
        employeeCode: input.employeeCode,
        firstName: input.firstName,
        lastName: input.lastName,
        middleName: input.middleName,
        fullName,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        pinfl: input.pinfl,
        passportNumber: input.passportNumber,
        personalPhone: input.personalPhone,
        workPhone: input.workPhone,
        personalEmail: input.personalEmail,
        workEmail: input.workEmail,
        address: input.address,
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
        departmentId: input.departmentId,
        branchId: input.branchId,
        positionId: input.positionId,
        managerId: input.managerId,
        status: input.status ?? 'ACTIVE',
        employmentType: input.employmentType,
        contractNumber: input.contractNumber,
        contractStartDate: input.contractStartDate,
        contractEndDate: input.contractEndDate,
        workSchedule: input.workSchedule,
        workLocation: input.workLocation,
        hiredAt,
      },
      include: EMPLOYEE_INCLUDE,
    });

    // Boshlang'ich EmploymentRecord — yaratilgan zahoti tarix boshlanadi
    await tx.employmentRecord.create({
      data: {
        organizationId: input.organizationId,
        employeeId: created.id,
        positionId: created.positionId,
        departmentId: created.departmentId,
        branchId: created.branchId,
        managerId: created.managerId,
        startDate: hiredAt,
        endDate: null,
        reason: 'Ishga qabul qilindi',
        changedByUserId: input.actingUserId,
      },
    });

    await recordAuditLog(
      {
        organizationId: input.organizationId,
        userId: input.actingUserId,
        action: 'employee.created',
        entityType: 'Employee',
        entityId: created.id,
        metadata: { employeeCode: created.employeeCode, fullName: created.fullName },
      },
      tx,
    );

    return created;
  });

  return employee;
}

// --------------------------------------------------------------------------
// List — qidiruv/filtr/sort/pagination + RBAC resurs-filtrlash
// --------------------------------------------------------------------------

interface ListEmployeesInput {
  auth: AuthContext;
  search?: string;
  departmentId?: string;
  branchId?: string;
  positionId?: string;
  managerId?: string;
  status?: EmploymentStatus;
  employmentType?: EmploymentType;
  sortBy?: 'fullName' | 'hiredAt' | 'employeeCode';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export async function listEmployees(input: ListEmployeesInput) {
  const page = input.page ?? 1;
  const pageSize = Math.min(input.pageSize ?? 25, 100);

  const where: Prisma.EmployeeWhereInput = {
    organizationId: input.auth.organizationId,
    departmentId: input.departmentId,
    branchId: input.branchId,
    positionId: input.positionId,
    managerId: input.managerId,
    status: input.status,
    employmentType: input.employmentType,
  };

  if (input.search) {
    where.OR = [
      { fullName: { contains: input.search, mode: 'insensitive' } },
      { employeeCode: { contains: input.search, mode: 'insensitive' } },
      { workEmail: { contains: input.search, mode: 'insensitive' } },
      { personalPhone: { contains: input.search, mode: 'insensitive' } },
    ];
  }

  await applyResourceScope(where, input.auth);

  const sortBy = input.sortBy ?? 'fullName';
  const sortDir = input.sortDir ?? 'asc';

  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: EMPLOYEE_INCLUDE,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
  ]);

  const sanitized = sanitizeEmployeeListForRole(items, input.auth.role, input.auth.userId);

  return { items: sanitized, total, page, pageSize };
}

// Rolga qarab qo'shimcha WHERE sharti — resurs egaligi tekshiruvi shu yerda.
async function applyResourceScope(where: Prisma.EmployeeWhereInput, auth: AuthContext) {
  if (auth.role === 'SUPER_ADMIN' || auth.role === 'HR_MANAGER' || auth.role === 'HR_SPECIALIST') {
    return; // cheklovsiz (organizationId allaqachon where'da bor)
  }

  if (auth.role === 'EMPLOYEE') {
    const self = await prisma.employee.findUnique({ where: { userId: auth.userId }, select: { id: true } });
    where.id = self?.id ?? '__none__'; // hech kim topilmasin, agar employee yozuvi yo'q bo'lsa
    return;
  }

  if (auth.role === 'DEPARTMENT_HEAD') {
    const self = await prisma.employee.findUnique({ where: { userId: auth.userId }, select: { id: true, departmentId: true } });
    if (!self) {
      where.id = '__none__';
      return;
    }
    where.OR = [{ id: self.id }, { departmentId: self.departmentId ?? '__none__' }, { managerId: self.id }];
    return;
  }

  // RECRUITER va boshqa rollar — Core HR'ga umuman kirmasin
  where.id = '__none__';
}

// --------------------------------------------------------------------------
// Get by id
// --------------------------------------------------------------------------

export async function getEmployeeById(auth: AuthContext, employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId: auth.organizationId },
    include: { ...EMPLOYEE_INCLUDE, directReports: { select: { id: true, fullName: true, employeeCode: true } } },
  });
  if (!employee) {
    throw AppError.notFound('Xodim topilmadi');
  }

  await assertCanViewEmployee(auth, employee.id, employee.departmentId, employee.managerId);

  const isSelf = employee.userId === auth.userId;
  return sanitizeEmployeeForRole(employee, auth.role, isSelf);
}

// Employee Self-Service uchun: joriy foydalanuvchining o'z Core HR yozuvini
// topadi ("user -> employee -> Core HR" zanjiri). ESS sahifalari o'z
// employeeId'ini shu orqali oladi — butun xodimlar ro'yxatini olib,
// userId bo'yicha qidirishning mo'rt naqshi o'rniga.
export async function getMyEmployee(auth: AuthContext) {
  const employee = await prisma.employee.findFirst({
    where: { userId: auth.userId, organizationId: auth.organizationId },
    include: EMPLOYEE_INCLUDE,
  });
  if (!employee) {
    throw AppError.notFound("Sizga bog'langan xodim profili topilmadi");
  }
  return sanitizeEmployeeForRole(employee, auth.role, true);
}

async function assertCanViewEmployee(
  auth: AuthContext,
  employeeId: string,
  departmentId: string | null,
  managerId: string | null,
) {
  if (auth.role === 'SUPER_ADMIN' || auth.role === 'HR_MANAGER' || auth.role === 'HR_SPECIALIST') {
    return;
  }
  const self = await prisma.employee.findUnique({ where: { userId: auth.userId }, select: { id: true, departmentId: true } });
  if (!self) {
    throw AppError.forbidden();
  }
  if (auth.role === 'EMPLOYEE') {
    if (self.id !== employeeId) throw AppError.forbidden();
    return;
  }
  if (auth.role === 'DEPARTMENT_HEAD') {
    const inScope = self.id === employeeId || self.departmentId === departmentId || self.id === managerId;
    if (!inScope) throw AppError.forbidden();
    return;
  }
  throw AppError.forbidden();
}

// --------------------------------------------------------------------------
// Update (oddiy maydonlar — personal/contact; employment o'zgarishi
// employmentHistory.service.ts orqali alohida amalga oshiriladi)
// --------------------------------------------------------------------------

interface UpdateEmployeeInput {
  firstName?: string;
  lastName?: string;
  middleName?: string | null;
  dateOfBirth?: Date | null;
  gender?: 'MALE' | 'FEMALE' | null;
  pinfl?: string | null;
  passportNumber?: string | null;
  personalPhone?: string | null;
  workPhone?: string | null;
  personalEmail?: string | null;
  workEmail?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  contractNumber?: string | null;
  contractStartDate?: Date | null;
  contractEndDate?: Date | null;
  workSchedule?: string | null;
  workLocation?: string | null;
}

export async function updateEmployee(
  organizationId: string,
  actingUserId: string,
  employeeId: string,
  input: UpdateEmployeeInput,
) {
  const existing = await prisma.employee.findFirst({ where: { id: employeeId, organizationId } });
  if (!existing) {
    throw AppError.notFound('Xodim topilmadi');
  }

  if (input.pinfl !== undefined || input.workEmail !== undefined) {
    await assertUniqueFields(
      organizationId,
      { pinfl: input.pinfl ?? undefined, workEmail: input.workEmail ?? undefined },
      employeeId,
    );
  }

  const nextFirstName = input.firstName ?? existing.firstName;
  const nextLastName = input.lastName ?? existing.lastName;
  const nextMiddleName = input.middleName !== undefined ? input.middleName : existing.middleName;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.employee.update({
      where: { id: employeeId },
      data: {
        ...input,
        fullName: buildFullName(nextFirstName, nextLastName, nextMiddleName ?? undefined),
      },
      include: EMPLOYEE_INCLUDE,
    });

    await recordAuditLog(
      {
        organizationId,
        userId: actingUserId,
        action: 'employee.updated',
        entityType: 'Employee',
        entityId: employeeId,
        metadata: { fields: Object.keys(input) },
      },
      tx,
    );

    return result;
  });

  return updated;
}

// --------------------------------------------------------------------------
// Yordamchi funksiyalar
// --------------------------------------------------------------------------

function buildFullName(firstName: string, lastName: string, middleName?: string): string {
  return [lastName, firstName, middleName].filter(Boolean).join(' ');
}

async function assertUniqueFields(
  organizationId: string,
  fields: { employeeCode?: string; pinfl?: string; workEmail?: string },
  excludeEmployeeId?: string,
) {
  if (fields.employeeCode) {
    const existing = await prisma.employee.findFirst({
      where: { organizationId, employeeCode: fields.employeeCode, id: { not: excludeEmployeeId } },
    });
    if (existing) throw AppError.conflict("Bu Employee ID band");
  }
  if (fields.pinfl) {
    const existing = await prisma.employee.findFirst({
      where: { organizationId, pinfl: fields.pinfl, id: { not: excludeEmployeeId } },
    });
    if (existing) throw AppError.conflict('Bu PINFL band');
  }
  if (fields.workEmail) {
    const existing = await prisma.employee.findFirst({
      where: { organizationId, workEmail: fields.workEmail, id: { not: excludeEmployeeId } },
    });
    if (existing) throw AppError.conflict('Bu ish email band');
  }
}

async function assertDepartmentExists(organizationId: string, departmentId: string) {
  const dept = await prisma.department.findFirst({ where: { id: departmentId, organizationId } });
  if (!dept) throw AppError.badRequest("Ko'rsatilgan bo'lim topilmadi");
}

async function assertPositionExists(organizationId: string, positionId: string) {
  const pos = await prisma.position.findFirst({ where: { id: positionId, organizationId } });
  if (!pos) throw AppError.badRequest("Ko'rsatilgan lavozim topilmadi");
}
