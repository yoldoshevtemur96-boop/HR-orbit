import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '@/middleware/auth';
import { AppError } from '@/common/errors/AppError';
import * as templateService from './template.service';
import * as instanceService from './instance.service';

export const workflowRouter = Router();
workflowRouter.use(authenticate);

// ---------------------------------------------------------------------------
// KONSTRUKTOR — faqat SUPER_ADMIN / HR_MANAGER yangi ariza turi va zanjir quradi
// ---------------------------------------------------------------------------

const formFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'select', 'textarea']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

const stepSchema = z.object({
  order: z.number().int().positive(),
  name: z.string().min(1),
  approverType: z.enum(['SPECIFIC_USER', 'ROLE', 'DIRECT_MANAGER', 'DEPARTMENT_HEAD']),
  approverRole: z.enum(['SUPER_ADMIN', 'HR_MANAGER', 'RECRUITER', 'DEPARTMENT_HEAD', 'EMPLOYEE']).optional(),
  approverUserId: z.string().optional(),
  actionType: z.enum(['APPROVE', 'ACKNOWLEDGE']).optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  formSchema: z.array(formFieldSchema).min(1),
  documentBody: z.string().optional(),
  steps: z.array(stepSchema).min(1),
});

workflowRouter.post(
  '/templates',
  requireRole('SUPER_ADMIN', 'HR_MANAGER'),
  async (req, res) => {
    const input = createTemplateSchema.parse(req.body);
    const template = await templateService.createTemplate({
      organizationId: req.auth!.organizationId,
      ...input,
    });
    res.status(201).json(template);
  },
);

workflowRouter.get('/templates', async (req, res) => {
  const templates = await templateService.listTemplates(req.auth!.organizationId);
  res.json(templates);
});

workflowRouter.get('/templates/:id', async (req, res) => {
  const template = await templateService.getTemplateById(req.auth!.organizationId, req.params.id);
  res.json(template);
});

workflowRouter.delete(
  '/templates/:id',
  requireRole('SUPER_ADMIN', 'HR_MANAGER'),
  async (req, res) => {
    await templateService.deactivateTemplate(req.auth!.organizationId, req.params.id);
    res.status(204).send();
  },
);

// ---------------------------------------------------------------------------
// IJRO — xodim ariza yuboradi, zanjir ishtirokchilari tasdiqlaydi/rad etadi
// ---------------------------------------------------------------------------

const createInstanceSchema = z.object({
  templateId: z.string().min(1),
  employeeId: z.string().min(1),
  formData: z.record(z.unknown()),
});

workflowRouter.post('/instances', async (req, res) => {
  const input = createInstanceSchema.parse(req.body);
  const instance = await instanceService.createInstance({
    organizationId: req.auth!.organizationId,
    initiatorUserId: req.auth!.userId,
    ...input,
  });
  res.status(201).json(instance);
});

// Xodimning o'z arizalarini kuzatishi
workflowRouter.get('/instances/mine', async (req, res) => {
  const instances = await instanceService.listMyInstances(req.auth!.organizationId, req.auth!.userId);
  res.json(instances);
});

// HR/admin uchun — tashkilotdagi barcha arizalar ("kimda turibdi" nazorati)
workflowRouter.get(
  '/instances',
  requireRole('SUPER_ADMIN', 'HR_MANAGER', 'DEPARTMENT_HEAD'),
  async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const instances = await instanceService.listOrganizationInstances(req.auth!.organizationId, status);
    res.json(instances);
  },
);

// Joriy foydalanuvchiga tayinlangan, javob kutayotgan arizalar ("mening navbatim")
workflowRouter.get('/instances/pending-for-me', async (req, res) => {
  const pending = await instanceService.listPendingForUser(req.auth!.organizationId, req.auth!.userId);
  res.json(pending);
});

workflowRouter.get('/instances/:id', async (req, res) => {
  const instance = await instanceService.getInstanceById(req.auth!.organizationId, req.params.id);
  res.json(instance);
});

const decideSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().optional(),
});

workflowRouter.post('/instances/:id/decide', async (req, res) => {
  const { decision, comment } = decideSchema.parse(req.body);
  if (!req.auth) throw AppError.unauthorized();
  const instance = await instanceService.decideStep({
    organizationId: req.auth.organizationId,
    instanceId: req.params.id,
    actingUserId: req.auth.userId,
    decision,
    comment,
  });
  res.json(instance);
});
