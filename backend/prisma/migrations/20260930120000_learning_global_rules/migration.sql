-- CreateEnum
CREATE TYPE "LearningRuleScope" AS ENUM ('GLOBAL', 'LOCAL');

-- DropIndex
DROP INDEX "learning_assignment_batches_ruleId_key";

-- AlterTable
ALTER TABLE "learning_assignment_rules" ADD COLUMN     "scope" "LearningRuleScope" NOT NULL DEFAULT 'GLOBAL',
ALTER COLUMN "materialId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "learning_rule_materials" (
    "ruleId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "attachedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_rule_materials_pkey" PRIMARY KEY ("ruleId","materialId")
);

-- CreateIndex
CREATE INDEX "learning_rule_materials_materialId_idx" ON "learning_rule_materials"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_assignment_batches_ruleId_materialId_key" ON "learning_assignment_batches"("ruleId", "materialId");

-- AddForeignKey
ALTER TABLE "learning_rule_materials" ADD CONSTRAINT "learning_rule_materials_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "learning_assignment_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_rule_materials" ADD CONSTRAINT "learning_rule_materials_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "learning_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_rule_materials" ADD CONSTRAINT "learning_rule_materials_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Mavjud qoidalar — global qoidaga aylanadi va o'z materialiga biriktiriladi
-- ---------------------------------------------------------------------------
INSERT INTO "learning_rule_materials" ("ruleId", "materialId", "organizationId", "attachedByUserId", "createdAt")
SELECT r."id", r."materialId", r."organizationId", r."createdByUserId", r."createdAt"
FROM "learning_assignment_rules" r
WHERE r."materialId" IS NOT NULL;

UPDATE "learning_assignment_rules" SET "scope" = 'GLOBAL', "materialId" = NULL;
