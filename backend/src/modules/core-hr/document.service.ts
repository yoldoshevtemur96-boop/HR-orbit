import { prisma } from '@/config/prisma';
import { AppError } from '@/common/errors/AppError';

export async function listDocuments(organizationId: string, employeeId: string) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, organizationId } });
  if (!employee) throw AppError.notFound('Xodim topilmadi');

  return prisma.employeeDocument.findMany({
    where: { employeeId },
    include: { uploadedByUser: { select: { id: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

interface AddDocumentInput {
  organizationId: string;
  employeeId: string;
  uploadedByUserId: string;
  name: string;
  fileUrl: string;
}

// fileUrl — tashqi havola (masalan Google Drive link). Haqiqiy fayl
// yuklash/saqlash (S3/R2) hali qurilmagan — bu qasddan qilingan qaror,
// infratuzilma kelajakda qo'shiladi.
export async function addDocument(input: AddDocumentInput) {
  const employee = await prisma.employee.findFirst({ where: { id: input.employeeId, organizationId: input.organizationId } });
  if (!employee) throw AppError.notFound('Xodim topilmadi');

  return prisma.employeeDocument.create({
    data: {
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      name: input.name,
      fileUrl: input.fileUrl,
      uploadedByUserId: input.uploadedByUserId,
    },
  });
}
