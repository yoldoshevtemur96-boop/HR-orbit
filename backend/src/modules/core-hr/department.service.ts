import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';

export async function createDepartment(organizationId: string, name: string, parentId?: string) {
  return prisma.department.create({ data: { organizationId, name, parentId } });
}

export async function listDepartments(organizationId: string) {
  return prisma.department.findMany({
    where: { organizationId },
    include: { headEmployee: { select: { id: true, fullName: true } }, _count: { select: { employees: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function setDepartmentHead(organizationId: string, departmentId: string, headEmployeeId: string) {
  const department = await prisma.department.findFirst({ where: { id: departmentId, organizationId } });
  if (!department) {
    throw AppError.notFound('Bo\'lim topilmadi');
  }
  return prisma.department.update({ where: { id: departmentId }, data: { headEmployeeId } });
}
