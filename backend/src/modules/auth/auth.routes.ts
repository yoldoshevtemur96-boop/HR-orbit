import { Router } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';

export const authRouter = Router();

const registerSchema = z.object({
  organizationName: z.string().min(2),
  organizationSlug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug faqat kichik harf, raqam va '-' bo'lishi mumkin"),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8, "Parol kamida 8 belgidan iborat bo'lishi kerak"),
  adminFullName: z.string().min(2),
});

authRouter.post('/register', async (req, res) => {
  const input = registerSchema.parse(req.body);
  const tokens = await authService.registerOrganization(input);
  res.status(201).json(tokens);
});

const loginSchema = z.object({
  organizationSlug: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res) => {
  const { organizationSlug, email, password } = loginSchema.parse(req.body);
  const tokens = await authService.login(email, password, organizationSlug);
  res.json(tokens);
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

authRouter.post('/refresh', async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const tokens = await authService.refreshAccessToken(refreshToken);
  res.json(tokens);
});
