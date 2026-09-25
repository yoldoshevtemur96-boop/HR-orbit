-- CreateEnum
CREATE TYPE "LearningAssignmentReason" AS ENUM ('LEGAL', 'POSITION', 'ONBOARDING', 'DEVELOPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "LearningAssignmentSource" AS ENUM ('MANUAL', 'RULE', 'FILE');

-- CreateEnum
CREATE TYPE "LearningAssignmentStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'LEARNING_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'LEARNING_REMINDER';

-- DropIndex
DROP INDEX "learning_assignments_employeeId_materialId_key";

-- AlterTable
ALTER TABLE "learning_assignments" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByUserId" TEXT,
ADD COLUMN     "reason" "LearningAssignmentReason" NOT NULL DEFAULT 'DEVELOPMENT',
ADD COLUMN     "reasonText" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "source" "LearningAssignmentSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "status" "LearningAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "learning_assignments_organizationId_materialId_status_idx" ON "learning_assignments"("organizationId", "materialId", "status");

-- CreateIndex
CREATE INDEX "learning_assignments_employeeId_materialId_idx" ON "learning_assignments"("employeeId", "materialId");


-- Bir xodim x material uchun bir vaqtda faqat bitta faol tayinlov (Prisma partial index qo'llamaydi)
CREATE UNIQUE INDEX "learning_assignments_active_unique" ON "learning_assignments"("employeeId", "materialId") WHERE "status" = 'ACTIVE';
