-- CreateEnum
CREATE TYPE "LearningRuleType" AS ENUM ('ONE_TIME', 'PERMANENT');

-- AlterTable
ALTER TABLE "learning_assignments" ADD COLUMN     "ruleId" TEXT;

-- CreateTable
CREATE TABLE "learning_assignment_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "type" "LearningRuleType" NOT NULL,
    "allOrganization" BOOLEAN NOT NULL DEFAULT false,
    "departmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "positionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "branchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hiredWithinDays" INTEGER,
    "reason" "LearningAssignmentReason" NOT NULL DEFAULT 'DEVELOPMENT',
    "reasonText" TEXT,
    "note" TEXT,
    "dueInDays" INTEGER,
    "dueDate" TIMESTAMP(3),
    "skipIfCompletedWithinDays" INTEGER,
    "cancelOutOfScope" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_assignment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_assignment_rules_organizationId_isActive_type_idx" ON "learning_assignment_rules"("organizationId", "isActive", "type");

-- CreateIndex
CREATE INDEX "learning_assignments_ruleId_status_idx" ON "learning_assignments"("ruleId", "status");

-- AddForeignKey
ALTER TABLE "learning_assignments" ADD CONSTRAINT "learning_assignments_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "learning_assignment_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_assignment_rules" ADD CONSTRAINT "learning_assignment_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_assignment_rules" ADD CONSTRAINT "learning_assignment_rules_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "learning_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

