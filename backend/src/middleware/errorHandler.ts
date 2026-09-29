import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { AppError } from '@/common/errors/AppError';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { message: `Yo'l topilmadi: ${req.method} ${req.originalUrl}` },
  });
}

// express-async-errors tufayli async route'lardagi throw ham shu yerga keladi.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: "Kiritilgan ma'lumotlar noto'g'ri",
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }

  if (err instanceof MulterError) {
    return res.status(400).json({
      error: { message: err.code === 'LIMIT_FILE_SIZE' ? 'Fayl juda katta' : "Faylni yuklab bo'lmadi" },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, details: err.details },
    });
  }

  // Kutilmagan xato — to'liq stackni faqat serverga log qilamiz
  console.error('[unhandled_error]', err);
  return res.status(500).json({
    error: { message: 'Serverda kutilmagan xatolik yuz berdi' },
  });
}
