import 'express-async-errors'; // async route'lardagi throw'larni avtomatik next(err) ga aylantiradi
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from '@/config/env';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { authRouter } from '@/modules/auth/auth.routes';
import { coreHrRouter } from '@/modules/core-hr/core-hr.routes';
import { workflowRouter } from '@/modules/workflow/workflow.routes';
import { recruitmentRouter } from '@/modules/recruitment/recruitment.routes';
import { notificationRouter } from '@/modules/notifications/notification.routes';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hr-orbit-backend' });
});

app.use('/api/auth', authRouter);
app.use('/api/hr', coreHrRouter);
app.use('/api/workflow', workflowRouter);
app.use('/api/recruitment', recruitmentRouter);
app.use('/api/notifications', notificationRouter);

app.use(notFoundHandler);
app.use(errorHandler);
