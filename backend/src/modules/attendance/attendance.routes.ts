import { Router, Request } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '@/middleware/auth';
import { AppError } from '@/common/errors/AppError';
import * as settingsService from './attendanceSettings.service';
import * as recordService from './attendanceRecord.service';
import * as correctionService from './correction.service';
import * as timesheetService from './timesheet.service';
import * as exportService from './export.service';
import { canManageAttendance, canViewDepartmentAttendance } from './rbac';

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);

function requireManageAttendance(req: Request) {
  if (!canManageAttendance(req.auth!.role)) {
    throw AppError.forbidden();
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

// O'qish canViewDepartmentAttendance'ga ochiq (DEPARTMENT_HEAD ham
// standart ish vaqtini ko'ra oladi — kunlik jadvalda foydalanish
// uchun), o'zgartirish esa faqat canManageAttendance'da qoladi.
attendanceRouter.get('/settings', async (req, res) => {
  if (!canViewDepartmentAttendance(req.auth!.role)) {
    throw AppError.forbidden();
  }
  const settings = await settingsService.getSettings(req.auth!.organizationId);
  res.json(settings);
});

const updateSettingsSchema = z.object({
  standardStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  standardEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  standardWorkMinutes: z.coerce.number().int().positive().optional(),
  lateThresholdMinutes: z.coerce.number().int().min(0).optional(),
});

attendanceRouter.patch('/settings', async (req, res) => {
  requireManageAttendance(req);
  const input = updateSettingsSchema.parse(req.body);
  const settings = await settingsService.updateSettings(req.auth!.organizationId, input);
  res.json(settings);
});

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

const upsertRecordSchema = z.object({
  employeeId: z.string().min(1),
  date: z.coerce.date(),
  checkInTime: z.coerce.date().nullable().optional(),
  checkOutTime: z.coerce.date().nullable().optional(),
  status: z.enum(['PRESENT', 'LATE', 'EARLY_LEAVE', 'ABSENT', 'ON_LEAVE', 'BUSINESS_TRIP', 'REMOTE', 'SICK']).optional(),
  note: z.string().optional(),
});

attendanceRouter.post('/records', async (req, res) => {
  requireManageAttendance(req);
  const input = upsertRecordSchema.parse(req.body);
  const record = await recordService.upsertAttendanceRecord({
    organizationId: req.auth!.organizationId,
    editedByUserId: req.auth!.userId,
    ...input,
  });
  res.status(201).json(record);
});

const listDailyQuerySchema = z.object({
  date: z.coerce.date(),
  departmentId: z.string().optional(),
  branchId: z.string().optional(),
  status: z.enum(['ALL', 'LATE', 'ABSENT']).optional(),
});

attendanceRouter.get('/records/daily', async (req, res) => {
  const query = listDailyQuerySchema.parse(req.query);
  const result = await recordService.listDailyAttendance({ auth: req.auth!, ...query });
  res.json(result);
});

const exportDailyQuerySchema = z.object({
  date: z.coerce.date(),
  departmentId: z.string().optional(),
});

attendanceRouter.get('/records/daily/export', async (req, res) => {
  const { date, departmentId } = exportDailyQuerySchema.parse(req.query);
  const buffer = await exportService.exportDailyAttendanceToExcel(req.auth!, date, departmentId);
  const fileName = `davomat_${date.toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
});

const monthlyStatisticsQuerySchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
  departmentId: z.string().optional(),
  branchId: z.string().optional(),
});

attendanceRouter.get('/records/statistics', async (req, res) => {
  const query = monthlyStatisticsQuerySchema.parse(req.query);
  const result = await recordService.getMonthlyStatistics({ auth: req.auth!, ...query });
  res.json(result);
});

attendanceRouter.get('/records/me/today', async (req, res) => {
  const record = await recordService.getMyAttendanceToday(req.auth!);
  res.json(record);
});

const monthlyQuerySchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

attendanceRouter.get('/records/me/calendar', async (req, res) => {
  const { year, month } = monthlyQuerySchema.parse(req.query);
  const records = await recordService.getMyMonthlyCalendar(req.auth!, year, month);
  res.json(records);
});

attendanceRouter.get('/records/employee/:employeeId', async (req, res) => {
  const { year, month } = monthlyQuerySchema.parse(req.query);
  const records = await recordService.getEmployeeMonthlyAttendance(req.auth!, req.params.employeeId, year, month);
  res.json(records);
});

// ---------------------------------------------------------------------------
// Corrections
// ---------------------------------------------------------------------------

const submitCorrectionSchema = z.object({
  employeeId: z.string().min(1),
  date: z.coerce.date(),
  reasonType: z.enum(['DEVICE_FAILURE', 'WRONG_CHECK_IN', 'WRONG_CHECK_OUT']),
  requestedCheckIn: z.coerce.date().optional(),
  requestedCheckOut: z.coerce.date().optional(),
  comment: z.string().optional(),
});

attendanceRouter.post('/corrections', requireRole('DEPARTMENT_HEAD'), async (req, res) => {
  const input = submitCorrectionSchema.parse(req.body);
  const correction = await correctionService.submitCorrection({ auth: req.auth!, ...input });
  res.status(201).json(correction);
});

attendanceRouter.get('/corrections/mine', async (req, res) => {
  const corrections = await correctionService.listMyCorrections(req.auth!);
  res.json(corrections);
});

attendanceRouter.get('/corrections/pending', async (req, res) => {
  const corrections = await correctionService.listPendingCorrections(req.auth!);
  res.json(corrections);
});

const finalizeCorrectionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().optional(),
});

attendanceRouter.post('/corrections/:id/finalize', async (req, res) => {
  const { decision, comment } = finalizeCorrectionSchema.parse(req.body);
  const correction = await correctionService.finalizeCorrection(req.auth!, req.params.id, decision, comment);
  res.json(correction);
});

// ---------------------------------------------------------------------------
// Department timesheets
// ---------------------------------------------------------------------------

const generateDeptTimesheetSchema = z.object({
  departmentId: z.string().min(1),
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

attendanceRouter.post('/timesheets/department/generate', async (req, res) => {
  const input = generateDeptTimesheetSchema.parse(req.body);
  const timesheet = await timesheetService.generateDepartmentTimesheet({ auth: req.auth!, ...input });
  res.status(201).json(timesheet);
});

attendanceRouter.post('/timesheets/department/:id/submit', async (req, res) => {
  const timesheet = await timesheetService.submitDepartmentTimesheet(req.auth!, req.params.id);
  res.json(timesheet);
});

const decideTimesheetSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  rejectionComment: z.string().optional(),
});

attendanceRouter.post(
  '/timesheets/department/:id/decide',
  requireRole('SUPER_ADMIN', 'HR_MANAGER', 'TIMEKEEPER'),
  async (req, res) => {
    const { decision, rejectionComment } = decideTimesheetSchema.parse(req.body);
    const timesheet = await timesheetService.decideDepartmentTimesheet(req.auth!, req.params.id, decision, rejectionComment);
    res.json(timesheet);
  },
);

attendanceRouter.get('/timesheets/department', async (req, res) => {
  if (!canViewDepartmentAttendance(req.auth!.role)) {
    throw AppError.forbidden();
  }
  const year = req.query.year ? Number(req.query.year) : undefined;
  const timesheets = await timesheetService.listDepartmentTimesheets(req.auth!, year);
  res.json(timesheets);
});

attendanceRouter.get('/timesheets/department/:id', async (req, res) => {
  if (!canViewDepartmentAttendance(req.auth!.role)) {
    throw AppError.forbidden();
  }
  const timesheet = await timesheetService.getDepartmentTimesheetById(req.auth!, req.params.id);
  res.json(timesheet);
});

// ---------------------------------------------------------------------------
// Organization timesheets
// ---------------------------------------------------------------------------

const consolidateSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

attendanceRouter.post('/timesheets/organization/consolidate', async (req, res) => {
  requireManageAttendance(req);
  const { year, month } = consolidateSchema.parse(req.body);
  const timesheet = await timesheetService.consolidateOrganizationTimesheet(req.auth!, year, month);
  res.status(201).json(timesheet);
});

attendanceRouter.post('/timesheets/organization/:id/submit', async (req, res) => {
  const timesheet = await timesheetService.submitOrganizationTimesheet(req.auth!, req.params.id);
  res.json(timesheet);
});

attendanceRouter.post(
  '/timesheets/organization/:id/decide',
  requireRole('SUPER_ADMIN'),
  async (req, res) => {
    const { decision, rejectionComment } = decideTimesheetSchema.parse(req.body);
    const timesheet = await timesheetService.decideOrganizationTimesheet(req.auth!, req.params.id, decision, rejectionComment);
    res.json(timesheet);
  },
);

attendanceRouter.get('/timesheets/organization', async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const timesheets = await timesheetService.listOrganizationTimesheets(req.auth!, year);
  res.json(timesheets);
});

attendanceRouter.get('/timesheets/organization/:id', async (req, res) => {
  const timesheet = await timesheetService.getOrganizationTimesheetById(req.auth!, req.params.id);
  res.json(timesheet);
});
