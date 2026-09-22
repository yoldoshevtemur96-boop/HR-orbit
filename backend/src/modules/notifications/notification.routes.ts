import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import * as notificationService from './notification.service';

export const notificationRouter = Router();
notificationRouter.use(authenticate);

notificationRouter.get('/', async (req, res) => {
  const items = await notificationService.listMyNotifications(req.auth!.organizationId, req.auth!.userId);
  res.json(items);
});

notificationRouter.patch('/:id/read', async (req, res) => {
  await notificationService.markAsRead(req.auth!.organizationId, req.auth!.userId, req.params.id);
  res.status(204).send();
});

notificationRouter.patch('/read-all', async (req, res) => {
  await notificationService.markAllAsRead(req.auth!.organizationId, req.auth!.userId);
  res.status(204).send();
});
