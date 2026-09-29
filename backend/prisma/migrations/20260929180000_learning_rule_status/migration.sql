-- CreateEnum
CREATE TYPE "LearningRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'STOPPED', 'COMPLETED', 'ARCHIVED');

-- AlterTable: yangi maydonlar
ALTER TABLE "learning_assignment_rules"
ADD COLUMN     "description" TEXT,
ADD COLUMN     "status" "LearningRuleStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "tag" TEXT;

-- Mavjud qoidalar holatini ko'chirish: isActive -> status
UPDATE "learning_assignment_rules"
SET "status" = CASE
  WHEN "isActive" THEN 'ACTIVE'::"LearningRuleStatus"
  WHEN "type" = 'ONE_TIME' THEN 'COMPLETED'::"LearningRuleStatus"
  ELSE 'STOPPED'::"LearningRuleStatus"
END;

-- Eski ustun va indeks
DROP INDEX "learning_assignment_rules_organizationId_isActive_type_idx";
ALTER TABLE "learning_assignment_rules" DROP COLUMN "isActive";

-- CreateIndex
CREATE INDEX "learning_assignment_rules_organizationId_status_type_idx" ON "learning_assignment_rules"("organizationId", "status", "type");
