-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'DEVICE', 'IMPORT');

-- CreateEnum
CREATE TYPE "AttendanceDayStatus" AS ENUM ('PRESENT', 'LATE', 'EARLY_LEAVE', 'ABSENT', 'ON_LEAVE', 'BUSINESS_TRIP', 'REMOTE', 'SICK');

-- CreateEnum
CREATE TYPE "CorrectionReasonType" AS ENUM ('DEVICE_FAILURE', 'WRONG_CHECK_IN', 'WRONG_CHECK_OUT');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING_MANAGER', 'PENDING_TIMEKEEPER', 'APPLIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DepartmentTimesheetStatus" AS ENUM ('DRAFT', 'DEPT_SUBMITTED', 'DEPT_APPROVED', 'DEPT_REJECTED', 'CONSOLIDATED');

-- CreateEnum
CREATE TYPE "OrganizationTimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "RoleName" ADD VALUE 'TIMEKEEPER';

-- CreateTable
CREATE TABLE "attendance_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "standardStartTime" TEXT NOT NULL DEFAULT '09:00',
    "standardEndTime" TEXT NOT NULL DEFAULT '18:00',
    "standardWorkMinutes" INTEGER NOT NULL DEFAULT 480,
    "lateThresholdMinutes" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "status" "AttendanceDayStatus" NOT NULL DEFAULT 'PRESENT',
    "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "editedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_corrections" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceRecordId" TEXT,
    "date" DATE NOT NULL,
    "reasonType" "CorrectionReasonType" NOT NULL,
    "requestedCheckIn" TIMESTAMP(3),
    "requestedCheckOut" TIMESTAMP(3),
    "comment" TEXT,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING_MANAGER',
    "workflowInstanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_timesheets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "DepartmentTimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "summaryData" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "deptApprovedByUserId" TEXT,
    "deptApprovedAt" TIMESTAMP(3),
    "rejectionComment" TEXT,
    "generatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_timesheets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "OrganizationTimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "consolidatedByUserId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_timesheet_lines" (
    "id" TEXT NOT NULL,
    "organizationTimesheetId" TEXT NOT NULL,
    "departmentTimesheetId" TEXT NOT NULL,

    CONSTRAINT "organization_timesheet_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_settings_organizationId_key" ON "attendance_settings"("organizationId");

-- CreateIndex
CREATE INDEX "attendance_records_organizationId_date_idx" ON "attendance_records"("organizationId", "date");

-- CreateIndex
CREATE INDEX "attendance_records_employeeId_date_idx" ON "attendance_records"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_organizationId_employeeId_date_key" ON "attendance_records"("organizationId", "employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_corrections_workflowInstanceId_key" ON "attendance_corrections"("workflowInstanceId");

-- CreateIndex
CREATE INDEX "attendance_corrections_organizationId_employeeId_idx" ON "attendance_corrections"("organizationId", "employeeId");

-- CreateIndex
CREATE INDEX "attendance_corrections_status_idx" ON "attendance_corrections"("status");

-- CreateIndex
CREATE INDEX "department_timesheets_organizationId_year_month_idx" ON "department_timesheets"("organizationId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "department_timesheets_organizationId_departmentId_year_mont_key" ON "department_timesheets"("organizationId", "departmentId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "organization_timesheets_organizationId_year_month_key" ON "organization_timesheets"("organizationId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "organization_timesheet_lines_organizationTimesheetId_depart_key" ON "organization_timesheet_lines"("organizationTimesheetId", "departmentTimesheetId");

-- AddForeignKey
ALTER TABLE "attendance_settings" ADD CONSTRAINT "attendance_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "workflow_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_timesheets" ADD CONSTRAINT "department_timesheets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_timesheets" ADD CONSTRAINT "organization_timesheets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_timesheet_lines" ADD CONSTRAINT "organization_timesheet_lines_organizationTimesheetId_fkey" FOREIGN KEY ("organizationTimesheetId") REFERENCES "organization_timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_timesheet_lines" ADD CONSTRAINT "organization_timesheet_lines_departmentTimesheetId_fkey" FOREIGN KEY ("departmentTimesheetId") REFERENCES "department_timesheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
