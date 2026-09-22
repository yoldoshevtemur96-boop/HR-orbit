import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '@/middleware/auth';
import * as vacancyService from './vacancy.service';
import * as candidateService from './candidate.service';

export const recruitmentRouter = Router();
recruitmentRouter.use(authenticate);

// ---------------------------------------------------------------------------
// Vacancies
// ---------------------------------------------------------------------------

const createVacancySchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  departmentId: z.string().optional(),
});

recruitmentRouter.post(
  '/vacancies',
  requireRole('SUPER_ADMIN', 'HR_MANAGER', 'RECRUITER'),
  async (req, res) => {
    const { title, description, departmentId } = createVacancySchema.parse(req.body);
    const vacancy = await vacancyService.createVacancy(req.auth!.organizationId, title, description, departmentId);
    res.status(201).json(vacancy);
  },
);

recruitmentRouter.get('/vacancies', async (req, res) => {
  const vacancies = await vacancyService.listVacancies(req.auth!.organizationId);
  res.json(vacancies);
});

recruitmentRouter.get('/vacancies/:id', async (req, res) => {
  const vacancy = await vacancyService.getVacancyById(req.auth!.organizationId, req.params.id);
  res.json(vacancy);
});

recruitmentRouter.post(
  '/vacancies/:id/close',
  requireRole('SUPER_ADMIN', 'HR_MANAGER', 'RECRUITER'),
  async (req, res) => {
    const vacancy = await vacancyService.closeVacancy(req.auth!.organizationId, req.params.id);
    res.json(vacancy);
  },
);

// ---------------------------------------------------------------------------
// Candidates — ATS kanban
// ---------------------------------------------------------------------------

const createCandidateSchema = z.object({
  vacancyId: z.string().min(1),
  fullName: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  resumeUrl: z.string().url().optional(),
});

recruitmentRouter.post(
  '/candidates',
  requireRole('SUPER_ADMIN', 'HR_MANAGER', 'RECRUITER'),
  async (req, res) => {
    const input = createCandidateSchema.parse(req.body);
    const candidate = await candidateService.createCandidate({
      organizationId: req.auth!.organizationId,
      ...input,
    });
    res.status(201).json(candidate);
  },
);

recruitmentRouter.get('/vacancies/:vacancyId/candidates', async (req, res) => {
  const candidates = await candidateService.listCandidatesByVacancy(req.auth!.organizationId, req.params.vacancyId);
  res.json(candidates);
});

const moveStageSchema = z.object({
  stage: z.enum(['NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED']),
});

recruitmentRouter.patch(
  '/candidates/:id/stage',
  requireRole('SUPER_ADMIN', 'HR_MANAGER', 'RECRUITER'),
  async (req, res) => {
    const { stage } = moveStageSchema.parse(req.body);
    const candidate = await candidateService.moveCandidateStage(req.auth!.organizationId, req.params.id, stage);
    res.json(candidate);
  },
);

const hireSchema = z.object({
  position: z.string().min(1),
  departmentId: z.string().optional(),
  managerId: z.string().optional(),
});

recruitmentRouter.post(
  '/candidates/:id/hire',
  requireRole('SUPER_ADMIN', 'HR_MANAGER'),
  async (req, res) => {
    const input = hireSchema.parse(req.body);
    const employee = await candidateService.hireCandidate(req.auth!.organizationId, req.params.id, input);
    res.status(201).json(employee);
  },
);
