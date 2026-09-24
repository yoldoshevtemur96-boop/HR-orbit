-- Ma'lumotni tuzatish: rahbariyatga haqiqatan yuborilmagan (tashkilot
-- tabeli DRAFT/REJECTED yoki umuman bog'lanmagan) bo'lim tabellari
-- CONSOLIDATED holatida qotib qolgan edi — ularni DEPT_APPROVED'ga qaytaradi.
UPDATE "department_timesheets" dt
SET "status" = 'DEPT_APPROVED'
WHERE dt."status" = 'CONSOLIDATED'
  AND NOT EXISTS (
    SELECT 1
    FROM "organization_timesheet_lines" l
    JOIN "organization_timesheets" o ON o."id" = l."organizationTimesheetId"
    WHERE l."departmentTimesheetId" = dt."id"
      AND o."status" IN ('SUBMITTED', 'APPROVED')
  );
