-- AlterTable
ALTER TABLE "department_timesheets" ADD COLUMN     "hrOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hrOverrideReason" TEXT;
