import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '@/config/env';
import type { RoleName } from '@prisma/client';

export interface AccessTokenPayload {
  userId: string;
  organizationId: string;
  role: RoleName;
}

// .env'dan keladigan "15m" / "7d" kabi qiymatlar runtime'da string —
// jsonwebtoken'ning SignOptions turi buni StringValue deb kutadi,
// shuning uchun aniq cast qilamiz.
export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: env.jwt.accessExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwt.accessSecret, options);
}

export function signRefreshToken(payload: { userId: string }): string {
  const options: SignOptions = { expiresIn: env.jwt.refreshExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwt.refreshSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, env.jwt.refreshSecret) as { userId: string };
}
