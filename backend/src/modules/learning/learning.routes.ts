import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '@/middleware/auth';
import * as learningService from './learning.service';

// Learning & Development — xodim tomoni (har qanday rol, xodim profili
// bo'lsa). Material/tadbir yaratish va tayinlash — alohida admin qismida.
export const learningRouter = Router();
learningRouter.use(authenticate);

learningRouter.get('/summary', async (req, res) => {
  res.json(await learningService.getSummary(req.auth!));
});

// ---------------------------------------------------------------------------
// Katalog va progress
// ---------------------------------------------------------------------------

const listMaterialsSchema = z.object({
  search: z.string().trim().optional(),
  type: z.enum(['AUDIO', 'VIDEO', 'ARTICLE', 'BOOK', 'COURSE']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

learningRouter.get('/materials', async (req, res) => {
  const query = listMaterialsSchema.parse(req.query);
  res.json(await learningService.listMaterials(req.auth!, query));
});

learningRouter.get('/materials/:id', async (req, res) => {
  res.json(await learningService.getMaterial(req.auth!, req.params.id));
});

learningRouter.post('/materials/:id/start', async (req, res) => {
  res.json(await learningService.startMaterial(req.auth!, req.params.id));
});

const progressSchema = z.object({ progress: z.coerce.number().int().min(0).max(100) });

learningRouter.put('/materials/:id/progress', async (req, res) => {
  const { progress } = progressSchema.parse(req.body);
  res.json(await learningService.updateProgress(req.auth!, req.params.id, progress));
});

learningRouter.put('/materials/:id/favorite', async (req, res) => {
  res.json(await learningService.setFavorite(req.auth!, req.params.id, true));
});

learningRouter.delete('/materials/:id/favorite', async (req, res) => {
  res.json(await learningService.setFavorite(req.auth!, req.params.id, false));
});

const myProgressSchema = z.object({ status: z.enum(['IN_PROGRESS', 'COMPLETED']).default('IN_PROGRESS') });

learningRouter.get('/my/progress', async (req, res) => {
  const { status } = myProgressSchema.parse(req.query);
  res.json(await learningService.listMyProgress(req.auth!, status));
});

learningRouter.get('/my/assignments', async (req, res) => {
  res.json(await learningService.listMyAssignments(req.auth!));
});

learningRouter.get('/my/favorites', async (req, res) => {
  res.json(await learningService.listMyFavorites(req.auth!));
});

// ---------------------------------------------------------------------------
// Tadbirlar
// ---------------------------------------------------------------------------

const listEventsSchema = z.object({ scope: z.enum(['upcoming', 'mine', 'past']).default('upcoming') });

learningRouter.get('/events', async (req, res) => {
  const query = listEventsSchema.parse(req.query);
  res.json(await learningService.listEvents(req.auth!, query));
});

learningRouter.post('/events/:id/register', async (req, res) => {
  res.status(201).json(await learningService.registerForEvent(req.auth!, req.params.id));
});

learningRouter.delete('/events/:id/register', async (req, res) => {
  res.json(await learningService.cancelEventRegistration(req.auth!, req.params.id));
});

// ---------------------------------------------------------------------------
// So'rovlar
// ---------------------------------------------------------------------------

learningRouter.get('/my/requests', async (req, res) => {
  res.json(await learningService.listMyRequests(req.auth!));
});

const createRequestSchema = z
  .object({
    materialId: z.string().min(1).optional(),
    eventId: z.string().min(1).optional(),
    title: z.string().trim().max(200).optional(),
    externalUrl: z.string().trim().url("Havola noto'g'ri").optional().or(z.literal('').transform(() => undefined)),
    comment: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.materialId || v.eventId || v.title, { message: "So'rov nomini kiriting" });

learningRouter.post('/requests', async (req, res) => {
  const input = createRequestSchema.parse(req.body);
  res.status(201).json(await learningService.createRequest(req.auth!, input));
});

learningRouter.post('/requests/:id/cancel', async (req, res) => {
  res.json(await learningService.cancelRequest(req.auth!, req.params.id));
});

// ---------------------------------------------------------------------------
// Rivojlanish maqsadlari
// ---------------------------------------------------------------------------

learningRouter.get('/my/goals', async (req, res) => {
  res.json(await learningService.listMyGoals(req.auth!));
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((v) => new Date(`${v}T00:00:00.000Z`));

const createGoalSchema = z.object({
  title: z.string().trim().min(1, 'Maqsad nomini kiriting').max(200),
  description: z.string().trim().max(2000).optional(),
  dueDate: dateSchema.optional(),
  materialIds: z.array(z.string().min(1)).max(50).optional(),
});

learningRouter.post('/goals', async (req, res) => {
  const input = createGoalSchema.parse(req.body);
  res.status(201).json(await learningService.createGoal(req.auth!, input));
});

const updateGoalSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  dueDate: dateSchema.nullable().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  materialIds: z.array(z.string().min(1)).max(50).optional(),
});

learningRouter.patch('/goals/:id', async (req, res) => {
  const input = updateGoalSchema.parse(req.body);
  res.json(await learningService.updateGoal(req.auth!, req.params.id, input));
});
