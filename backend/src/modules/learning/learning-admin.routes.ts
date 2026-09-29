import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '@/middleware/auth';
import * as assignmentService from './assignment.service';
import * as ruleService from './rule.service';
import { getOverview } from './overview.service';
import * as catalogService from './catalog.service';

// L&D admin qismi. HR (SUPER_ADMIN/HR_MANAGER) — butun tashkilot;
// DEPARTMENT_HEAD — faqat o'z bo'ysunuvchilari (scope service ichida).
export const learningAdminRouter = Router();
learningAdminRouter.use(authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER', 'DEPARTMENT_HEAD'));

// Bosh sahifa kartalari uchun jonli raqamlar
learningAdminRouter.get('/overview', async (req, res) => {
  res.json(await getOverview(req.auth!));
});

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

// ---------------------------------------------------------------------------
// Katalog (faqat HR — tekshiruv service ichida)
// ---------------------------------------------------------------------------

const materialTypeEnum = z.enum(['AUDIO', 'VIDEO', 'ARTICLE', 'BOOK', 'COURSE']);
const publishStatusEnum = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .url("Havola noto'g'ri — https:// bilan boshlang")
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));

const materialSchema = z.object({
  title: z.string().trim().min(1, 'Nomini kiriting').max(300),
  description: z.string().trim().max(5000).nullable().optional(),
  type: materialTypeEnum,
  coverUrl: optionalUrl,
  contentUrl: optionalUrl,
  durationMinutes: z.coerce.number().int().min(0).max(100000).optional(),
  author: z.string().trim().max(200).nullable().optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  requiresApproval: z.boolean().optional(),
  status: publishStatusEnum.optional(),
});

const catalogListSchema = z.object({
  search: z.string().trim().optional(),
  type: materialTypeEnum.optional(),
  status: publishStatusEnum.optional(),
});

learningAdminRouter.get('/catalog', async (req, res) => {
  const query = catalogListSchema.parse(req.query);
  res.json(await catalogService.listCatalog(req.auth!, query));
});

learningAdminRouter.get('/catalog/:id', async (req, res) => {
  res.json(await catalogService.getCatalogMaterial(req.auth!, req.params.id));
});

learningAdminRouter.post('/catalog', async (req, res) => {
  const input = materialSchema.parse(req.body);
  res.status(201).json(await catalogService.createMaterial(req.auth!, input));
});

learningAdminRouter.patch('/catalog/:id', async (req, res) => {
  const input = materialSchema.partial().parse(req.body);
  res.json(await catalogService.updateMaterial(req.auth!, req.params.id, input));
});
