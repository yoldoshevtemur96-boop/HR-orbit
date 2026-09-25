-- CreateEnum
CREATE TYPE "LearningMaterialType" AS ENUM ('AUDIO', 'VIDEO', 'ARTICLE', 'BOOK', 'COURSE');

-- CreateEnum
CREATE TYPE "LearningPublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LearningProgressStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "LearningEventFormat" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "LearningRegistrationStatus" AS ENUM ('REGISTERED', 'CANCELLED', 'ATTENDED');

-- CreateEnum
CREATE TYPE "LearningRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DevelopmentGoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "learning_materials" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "LearningMaterialType" NOT NULL,
    "coverUrl" TEXT,
    "contentUrl" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "author" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "LearningPublishStatus" NOT NULL DEFAULT 'PUBLISHED',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_progress" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" "LearningProgressStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "learning_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_favorites" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_assignments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "format" "LearningEventFormat" NOT NULL,
    "location" TEXT,
    "meetingUrl" TEXT,
    "speaker" TEXT,
    "coverUrl" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "status" "LearningPublishStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_event_registrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "LearningRegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "materialId" TEXT,
    "eventId" TEXT,
    "title" TEXT NOT NULL,
    "externalUrl" TEXT,
    "comment" TEXT,
    "status" "LearningRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_goals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "DevelopmentGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "development_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_goal_materials" (
    "goalId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,

    CONSTRAINT "development_goal_materials_pkey" PRIMARY KEY ("goalId","materialId")
);

-- CreateIndex
CREATE INDEX "learning_materials_organizationId_status_publishedAt_idx" ON "learning_materials"("organizationId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "learning_progress_organizationId_employeeId_status_idx" ON "learning_progress"("organizationId", "employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "learning_progress_employeeId_materialId_key" ON "learning_progress"("employeeId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_favorites_employeeId_materialId_key" ON "learning_favorites"("employeeId", "materialId");

-- CreateIndex
CREATE INDEX "learning_assignments_organizationId_employeeId_idx" ON "learning_assignments"("organizationId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_assignments_employeeId_materialId_key" ON "learning_assignments"("employeeId", "materialId");

-- CreateIndex
CREATE INDEX "learning_events_organizationId_status_startsAt_idx" ON "learning_events"("organizationId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "learning_event_registrations_organizationId_employeeId_idx" ON "learning_event_registrations"("organizationId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_event_registrations_eventId_employeeId_key" ON "learning_event_registrations"("eventId", "employeeId");

-- CreateIndex
CREATE INDEX "learning_requests_organizationId_employeeId_status_idx" ON "learning_requests"("organizationId", "employeeId", "status");

-- CreateIndex
CREATE INDEX "development_goals_organizationId_employeeId_idx" ON "development_goals"("organizationId", "employeeId");

-- AddForeignKey
ALTER TABLE "learning_materials" ADD CONSTRAINT "learning_materials_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "learning_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_favorites" ADD CONSTRAINT "learning_favorites_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_favorites" ADD CONSTRAINT "learning_favorites_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "learning_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_assignments" ADD CONSTRAINT "learning_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_assignments" ADD CONSTRAINT "learning_assignments_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "learning_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_event_registrations" ADD CONSTRAINT "learning_event_registrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_event_registrations" ADD CONSTRAINT "learning_event_registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "learning_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_requests" ADD CONSTRAINT "learning_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_requests" ADD CONSTRAINT "learning_requests_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "learning_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_requests" ADD CONSTRAINT "learning_requests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "learning_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_goals" ADD CONSTRAINT "development_goals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_goal_materials" ADD CONSTRAINT "development_goal_materials_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "development_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_goal_materials" ADD CONSTRAINT "development_goal_materials_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "learning_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

