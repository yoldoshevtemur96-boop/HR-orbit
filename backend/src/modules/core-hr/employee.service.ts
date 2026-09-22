import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';

interface CreateEmployeeInput {
  organizationId: string;
  fullName: string;
  position: string;
  departmentId?: string;
  managerId?: string;
  userId?: string;
}

export async function createEmployee(input: CreateEmployeeInput) {
  return prisma.employee.create({ data: input });
}

export async function listEmployees(organizationId: string) {
  return prisma.employee.findMany({
    where: { organizationId },
    include: { department: true, manager: { select: { id: true, fullName: true } } },
    orderBy: { fullName: 'asc' },
  });
}

export async function getEmployeeById(organizationId: string, employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
    include: { department: true, manager: true, directReports: true },
  });
  if (!employee) {
    throw AppError.notFound('Xodim topilmadi');
  }
  return employee;
}

interface UpdateEmployeeInput {
  fullName?: string;
  position?: string;
  departmentId?: string | null;
  managerId?: string | null;
  status?: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
}

export async function updateEmployee(organizationId: string, employeeId: string, input: UpdateEmployeeInput) {
  await getEmployeeById(organizationId, employeeId); // tenant tekshiruvi
  return prisma.employee.update({ where: { id: employeeId }, data: input });
}
