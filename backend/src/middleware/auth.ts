import { NextFunction, Request, Response } from 'express';
import type { RoleName } from '@prisma/client';
import { AppError } from '@/common/errors/AppError';
import { verifyAccessToken } from '@/modules/auth/jwt';

// req.auth — har bir himoyalangan so'rovda mavjud bo'ladigan joriy foydalanuvchi
// va tenant konteksti. Barcha keyingi query'lar shu organizationId bilan filtrlanadi.
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        organizationId: string;
        role: RoleName;
      };
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw AppError.unauthorized('Token yuborilmagan');
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyAccessToken(token);
    req.auth = payload;
    next();
  } catch {
    throw AppError.unauthorized("Token yaroqsiz yoki muddati o'tgan");
  }
}

// Faqat ko'rsatilgan rollarga ruxsat beradi. authenticate'dan keyin ishlatiladi.
export function requireRole(...roles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      throw AppError.unauthorized();
    }
    if (!roles.includes(req.auth.role)) {
      throw AppError.forbidden('Bu amal uchun ruxsatingiz yetarli emas');
    }
    next();
  };
}
