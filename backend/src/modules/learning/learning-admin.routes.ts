import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '@/middleware/auth';
import * as assignmentService from './assignment.service';

// L&D admin qismi. HR (SUPER_ADMIN/HR_MANAGER) — butun tashkilot;
// DEPARTMENT_HEAD — faqat o'z bo'ysunuvchilari (scope service ichida).
export const learningAdminRouter = Router();
learningAdminRouter.use(authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER', 'DEPARTMENT_HEAD'));

// ---------------------------------------------------------------------------
// Ma'lumotnomalar
// ---------------------------------------------------------------------------

learningAdminRouter.get('/materials', async (req, res) => {
  res.json(await assignmentService.listAssignableMaterials(req.auth!));
});

learningAdminRouter.get('/audience-options', async (req, res) => {
  res.json(await assignmentService.getAudienceOptions(req.auth!));
});

// ---------------------------------------------------------------------------
// Qo'lda tayinlash
// ---------------------------------------------------------------------------

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((v) => new Date(`${v}T18:59:59.000Z`)); // Toshkent 23:59

const idList = z.array(z.string().min(1)).max(5000).optional();

const assignSchema = z
  .object({
    materialId: z.string().min(1),
    audience: z.object({
      allOrganization: z.boolean().optional(),
      departmentIds: idList,
      positionIds: idList,
      branchIds: idList,
      employeeIds: idList,
    }),
    reason: z.enum(['LEGAL', 'POSITION', 'ONBOARDING', 'DEVELOPMENT', 'OTHER']),
    reasonText: z.string().trim().max(300).optional(),
    note: z.string().trim().max(1000).optional(),
    dueDate: dateSchema.optional(),
    dueInDays: z.coerce.number().int().min(1).max(730).optional(),
    skipIfCompletedWithinDays: z.coerce.number().int().min(1).max(3650).optional(),
  })
  .refine((v) => !(v.dueDate && v.dueInDays), { message: 'Muddatni bitta usulda kiriting' });

learningAdminRouter.post('/assignments/preview', async (req, res) => {
  const input = assignSchema.parse(req.body);
  res.json(await assignmentService.previewAssignment(req.auth!, input));
});

learningAdminRouter.post('/assignments', async (req, res) => {
  const input = assignSchema.parse(req.body);
  res.status(201).json(await assignmentService.createAssignments(req.auth!, input));
});

const listSchema = z.object({
  materialId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  state: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED']).optional(),
  search: z.string().trim().optional(),
});

learningAdminRouter.get('/assignments', async (req, res) => {
  const query = listSchema.parse(req.query);
  res.json(await assignmentService.listAssignments(req.auth!, query));
});

learningAdminRouter.post('/assignments/:id/cancel', async (req, res) => {
  res.json(await assignmentService.cancelAssignment(req.auth!, req.params.id));
});

const dueSchema = z.object({ dueDate: dateSchema.nullable() });

learningAdminRouter.patch('/assignments/:id', async (req, res) => {
  const { dueDate } = dueSchema.parse(req.body);
  res.json(await assignmentService.updateAssignmentDueDate(req.auth!, req.params.id, dueDate));
});
