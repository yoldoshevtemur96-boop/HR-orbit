-- AlterTable
ALTER TABLE "learning_assignments" ADD COLUMN     "batchId" TEXT;

-- CreateTable
CREATE TABLE "learning_assignment_batches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "source" "LearningAssignmentSource" NOT NULL DEFAULT 'MANUAL',
    "ruleId" TEXT,
    "reason" "LearningAssignmentReason" NOT NULL DEFAULT 'DEVELOPMENT',
    "reasonText" TEXT,
    "note" TEXT,
    "dueDate" TIMESTAMP(3),
    "dueInDays" INTEGER,
    "audienceSummary" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_assignment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_assignment_batches_ruleId_key" ON "learning_assignment_batches"("ruleId");

-- CreateIndex
CREATE INDEX "learning_assignment_batches_organizationId_createdAt_idx" ON "learning_assignment_batches"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "learning_assignments_batchId_status_idx" ON "learning_assignments"("batchId", "status");

-- AddForeignKey
ALTER TABLE "learning_assignments" ADD CONSTRAINT "learning_assignments_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "learning_assignment_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_assignment_batches" ADD CONSTRAINT "learning_assignment_batches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_assignment_batches" ADD CONSTRAINT "learning_assignment_batches_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "learning_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_assignment_batches" ADD CONSTRAINT "learning_assignment_batches_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "learning_assignment_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Mavjud tayinlovlarni tayinlov (partiya) larga guruhlash
-- ---------------------------------------------------------------------------

-- 1) Qoida bergan tayinlovlar: har bir qoida uchun bitta tayinlov
INSERT INTO "learning_assignment_batches"
  ("id", "organizationId", "name", "materialId", "source", "ruleId", "reason", "reasonText", "note",
   "dueDate", "dueInDays", "createdByUserId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, r."organizationId", r."name", r."materialId", 'RULE', r."id", r."reason", r."reasonText",
       r."note", r."dueDate", r."dueInDays", r."createdByUserId", r."createdAt", CURRENT_TIMESTAMP
FROM "learning_assignment_rules" r;

UPDATE "learning_assignments" a
SET "batchId" = b."id"
FROM "learning_assignment_batches" b
WHERE a."ruleId" IS NOT NULL AND b."ruleId" = a."ruleId";

-- 2) Qo'lda berilganlar: bir xil material, muallif, manba va daqiqada
-- yaratilganlar — bitta tayinlov (bitta "Tayinlash" bosilishi)
INSERT INTO "learning_assignment_batches"
  ("id", "organizationId", "name", "materialId", "source", "reason", "reasonText", "note",
   "dueDate", "createdByUserId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, g."organizationId",
       m."title" || ' — ' || to_char(g."minute" + interval '5 hours', 'DD.MM.YYYY'),
       g."materialId", g."source", g."reason", g."reasonText", g."note", g."dueDate", g."assignedByUserId",
       g."minute", CURRENT_TIMESTAMP
FROM (
  SELECT a."organizationId", a."materialId", a."assignedByUserId", a."source",
         date_trunc('minute', a."createdAt") AS "minute",
         min(a."reason") AS "reason", min(a."reasonText") AS "reasonText", min(a."note") AS "note",
         max(a."dueDate") AS "dueDate"
  FROM "learning_assignments" a
  WHERE a."batchId" IS NULL
  GROUP BY a."organizationId", a."materialId", a."assignedByUserId", a."source", date_trunc('minute', a."createdAt")
) g
JOIN "learning_materials" m ON m."id" = g."materialId";

UPDATE "learning_assignments" a
SET "batchId" = b."id"
FROM "learning_assignment_batches" b
WHERE a."batchId" IS NULL
  AND b."ruleId" IS NULL
  AND b."organizationId" = a."organizationId"
  AND b."materialId" = a."materialId"
  AND b."source" = a."source"
  AND b."createdByUserId" IS NOT DISTINCT FROM a."assignedByUserId"
  AND b."createdAt" = date_trunc('minute', a."createdAt");
