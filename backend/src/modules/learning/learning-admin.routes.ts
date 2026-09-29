import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '@/middleware/auth';
import * as assignmentService from './assignment.service';
import * as ruleService from './rule.service';

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

// ---------------------------------------------------------------------------
// Qoidalar (faqat HR — tekshiruv service ichida)
// ---------------------------------------------------------------------------

const ruleSchema = z
  .object({
    name: z.string().trim().min(1, 'Qoida nomini kiriting').max(200),
    materialId: z.string().min(1),
    type: z.enum(['ONE_TIME', 'PERMANENT']),
    allOrganization: z.boolean().optional(),
    departmentIds: idList,
    positionIds: idList,
    branchIds: idList,
    hiredWithinDays: z.coerce.number().int().min(1).max(3650).nullable().optional(),
    reason: z.enum(['LEGAL', 'POSITION', 'ONBOARDING', 'DEVELOPMENT', 'OTHER']),
    reasonText: z.string().trim().max(300).optional(),
    note: z.string().trim().max(1000).optional(),
    dueInDays: z.coerce.number().int().min(1).max(730).nullable().optional(),
    dueDate: dateSchema.nullable().optional(),
    skipIfCompletedWithinDays: z.coerce.number().int().min(1).max(3650).nullable().optional(),
    cancelOutOfScope: z.boolean().optional(),
  })
  .refine((v) => !(v.dueDate && v.dueInDays), { message: 'Muddatni bitta usulda kiriting' });

learningAdminRouter.get('/rules', async (req, res) => {
  res.json(await ruleService.listRules(req.auth!));
});

learningAdminRouter.post('/rules/preview', async (req, res) => {
  const input = ruleSchema.parse(req.body);
  res.json(await ruleService.previewRule(req.auth!, input));
});

learningAdminRouter.post('/rules', async (req, res) => {
  const input = ruleSchema.parse(req.body);
  res.status(201).json(await ruleService.createRule(req.auth!, input));
});

learningAdminRouter.post('/rules/:id/run', async (req, res) => {
  res.json(await ruleService.runRuleNow(req.auth!, req.params.id));
});

const deactivateSchema = z.object({ cancelAssignments: z.boolean().default(false) });

learningAdminRouter.post('/rules/:id/deactivate', async (req, res) => {
  const { cancelAssignments } = deactivateSchema.parse(req.body ?? {});
  res.json(await ruleService.deactivateRule(req.auth!, req.params.id, cancelAssignments));
});

learningAdminRouter.post('/rules/:id/activate', async (req, res) => {
  res.json(await ruleService.activateRule(req.auth!, req.params.id));
});
