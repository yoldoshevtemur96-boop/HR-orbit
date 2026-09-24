-- CreateTable
CREATE TABLE "timesheet_cell_edits" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hours" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "editedByUserId" TEXT NOT NULL,
    "editedByRole" "RoleName" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheet_cell_edits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timesheet_cell_edits_organizationId_date_idx" ON "timesheet_cell_edits"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_cell_edits_organizationId_employeeId_date_key" ON "timesheet_cell_edits"("organizationId", "employeeId", "date");

-- AddForeignKey
ALTER TABLE "timesheet_cell_edits" ADD CONSTRAINT "timesheet_cell_edits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
