-- CreateEnum
CREATE TYPE "LearningContentSource" AS ENUM ('LINK', 'FILE');

-- CreateEnum
CREATE TYPE "LearningDisplayMode" AS ENUM ('EMBED', 'NEW_TAB');

-- CreateEnum
CREATE TYPE "LearningCompletionRule" AS ENUM ('MANUAL', 'ON_OPEN', 'ON_FINISH');

-- CreateEnum
CREATE TYPE "LearningLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "LearningVisibility" AS ENUM ('ALL', 'AUDIENCE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "StoredFileStorage" AS ENUM ('DB', 'SUPABASE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LearningMaterialType" ADD VALUE 'INSTRUCTION';
ALTER TYPE "LearningMaterialType" ADD VALUE 'PRESENTATION';

-- AlterTable
ALTER TABLE "learning_materials" ADD COLUMN     "allowDownload" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "availableUntil" TIMESTAMP(3),
ADD COLUMN     "completionRule" "LearningCompletionRule" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "contentFileId" TEXT,
ADD COLUMN     "contentSource" "LearningContentSource" NOT NULL DEFAULT 'LINK',
ADD COLUMN     "displayMode" "LearningDisplayMode" NOT NULL DEFAULT 'NEW_TAB',
ADD COLUMN     "language" TEXT,
ADD COLUMN     "level" "LearningLevel",
ADD COLUMN     "pendingAssignment" JSONB,
ADD COLUMN     "visibility" "LearningVisibility" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "visibleBranchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "visibleDepartmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "visiblePositionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storage" "StoredFileStorage" NOT NULL,
    "data" BYTEA,
    "storageKey" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stored_files_organizationId_idx" ON "stored_files"("organizationId");

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

