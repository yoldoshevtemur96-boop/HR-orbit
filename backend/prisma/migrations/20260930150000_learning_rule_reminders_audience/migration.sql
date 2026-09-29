-- AlterTable
ALTER TABLE "learning_assignments" ADD COLUMN     "remindAfterDays" INTEGER,
ADD COLUMN     "remindBeforeDays" INTEGER DEFAULT 3,
ADD COLUMN     "reminderAfterSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "learning_assignment_rules" ADD COLUMN     "employeeCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "hiredFrom" TIMESTAMP(3),
ADD COLUMN     "hiredTo" TIMESTAMP(3),
ADD COLUMN     "notifyOnAssign" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "remindAfterDays" INTEGER,
ADD COLUMN     "remindBeforeDays" INTEGER DEFAULT 3,
ADD COLUMN     "resetProgress" BOOLEAN NOT NULL DEFAULT false;

