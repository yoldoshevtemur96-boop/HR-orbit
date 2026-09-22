import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Ilova bo'ylab bitta ulanish — hot-reload paytida bir nechta client
// yaratilib ketmasligi uchun global'ga keshlanadi.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.nodeEnv === 'development') {
  global.__prisma = prisma;
}
