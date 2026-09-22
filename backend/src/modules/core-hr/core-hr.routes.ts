import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '@/middleware/auth';
import { AppError } from '@/common/errors/AppError';
import * as employeeService from './employee.service';
import * as departmentService from './department.service';
import * as branchService from './branch.service';
import * as positionService from './position.service';
import * as employmentHistoryService from './employmentHistory.service';
import * as educationService from './education.service';
import * as documentService from './document.service';
import * as dashboardService from './dashboard.service';
import * as auditLogService from './auditLog.service';
import { canEditLimited } from './rbac';

export const coreHrRouter = Router();
coreHrRouter.use(authenticate);

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

coreHrRouter.get('/dashboard/summary', async (req, res) => {
  const summary = await dashboardService.getDashboardSummary(req.auth!.organizationId);
  res.json(summary);
});

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

const createEmployeeSchema = z.object({
  employeeCode: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  pinfl: z.string().optional(),
  passportNumber: z.string().optional(),
  personalPhone: z.string().optional(),
  workPhone: z.string().optional(),
  personalEmail: z.string().email().optional(),
  workEmail: z.string().email().optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  departmentId: z.string().optional(),
  branchId: z.string().optional(),
  positionId: z.string().optional(),
  managerId: z.string().optional(),
  status: z.enum(['ACTIVE', 'PROBATION', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'ARCHIVED']).optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'TEMPORARY', 'CONTRACT', 'REMOTE', 'HYBRID']).optional(),
  contractNumber: z.string().optional(),
  contractStartDate: z.coerce.date().optional(),
  contractEndDate: z.coerce.date().optional(),
  workSchedule: z.string().optional(),
  workLocation: z.string().optional(),
  hiredAt: z.coerce.date().optional(),
});

coreHrRouter.post('/employees', requireRole('SUPER_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const input = createEmployeeSchema.parse(req.body);
  const employee = await employeeService.createEmployee({
    organizationId: req.auth!.organizationId,
    actingUserId: req.auth!.userId,
    ...input,
  });
  res.status(201).json(employee);
});

const listEmployeesQuerySchema = z.object({
  search: z.string().optional(),
  departmentId: z.string().optional(),
  branchId: z.string().optional(),
  positionId: z.string().optional(),
  managerId: z.string().optional(),
  status: z.enum(['ACTIVE', 'PROBATION', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'ARCHIVED']).optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'TEMPORARY', 'CONTRACT', 'REMOTE', 'HYBRID']).optional(),
  sortBy: z.enum(['fullName', 'hiredAt', 'employeeCode']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

coreHrRouter.get('/employees', async (req, res) => {
  const query = listEmployeesQuerySchema.parse(req.query);
  const result = await employeeService.listEmployees({ auth: req.auth!, ...query });
  res.json(result);
});

// "/employees/:id" dan OLDIN bo'lishi shart — aks holda Express "me"ni
// employeeId deb qabul qilib, getEmployeeById'ga uzatib yuboradi.
coreHrRouter.get('/employees/me', async (req, res) => {
  const employee = await employeeService.getMyEmployee(req.auth!);
  res.json(employee);
});

coreHrRouter.get('/employees/:id', async (req, res) => {
  const employee = await employeeService.getEmployeeById(req.auth!, req.params.id);
  res.json(employee);
});

const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  middleName: z.string().nullable().optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  gender: z.enum(['MALE', 'FEMALE']).nullable().optional(),
  pinfl: z.string().nullable().optional(),
  passportNumber: z.string().nullable().optional(),
  personalPhone: z.string().nullable().optional(),
  workPhone: z.string().nullable().optional(),
  personalEmail: z.string().email().nullable().optional(),
  workEmail: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  emergencyContactName: z.string().nullable().optional(),
  emergencyContactPhone: z.string().nullable().optional(),
  contractNumber: z.string().nullable().optional(),
  contractStartDate: z.coerce.date().nullable().optional(),
  contractEndDate: z.coerce.date().nullable().optional(),
  workSchedule: z.string().nullable().optional(),
  workLocation: z.string().nullable().optional(),
});

coreHrRouter.patch('/employees/:id', async (req, res) => {
  if (!canEditLimited(req.auth!.role)) {
    throw AppError.forbidden();
  }
  const input = updateEmployeeSchema.parse(req.body);
  const employee = await employeeService.updateEmployee(req.auth!.organizationId, req.auth!.userId, req.params.id, input);
  res.json(employee);
});

const employmentChangeSchema = z.object({
  positionId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'PROBATION', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'ARCHIVED']).optional(),
  reason: z.string().min(1),
});

coreHrRouter.patch('/employees/:id/employment', requireRole('SUPER_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const { reason, ...changes } = employmentChangeSchema.parse(req.body);
  const employee = await employmentHistoryService.applyEmploymentChange({
    organizationId: req.auth!.organizationId,
    employeeId: req.params.id,
    changedByUserId: req.auth!.userId,
    changes,
    reason,
  });
  res.json(employee);
});

coreHrRouter.get('/employees/:id/history', async (req, res) => {
  const history = await employmentHistoryService.getEmploymentHistory(req.auth!.organizationId, req.params.id);
  res.json(history);
});

const createEducationSchema = z.object({
  level: z.string().min(1),
  institution: z.string().min(1),
  specialty: z.string().optional(),
  graduationYear: z.coerce.number().int().optional(),
});

coreHrRouter.post('/employees/:id/education', async (req, res) => {
  if (!canEditLimited(req.auth!.role)) {
    throw AppError.forbidden();
  }
  const input = createEducationSchema.parse(req.body);
  const education = await educationService.addEducation({
    organizationId: req.auth!.organizationId,
    employeeId: req.params.id,
    ...input,
  });
  res.status(201).json(education);
});

coreHrRouter.get('/employees/:id/education', async (req, res) => {
  const education = await educationService.listEducation(req.auth!.organizationId, req.params.id);
  res.json(education);
});

// ---------------------------------------------------------------------------
// Documents — skeleton: fileUrl tashqi havola, haqiqiy upload/storage yo'q
// ---------------------------------------------------------------------------

coreHrRouter.get('/employees/:id/documents', async (req, res) => {
  if (!canEditLimited(req.auth!.role)) {
    const self = await employeeService.getMyEmployee(req.auth!).catch(() => null);
    if (!self || self.id !== req.params.id) {
      throw AppError.forbidden();
    }
  }
  const documents = await documentService.listDocuments(req.auth!.organizationId, req.params.id);
  res.json(documents);
});

const addDocumentSchema = z.object({
  name: z.string().min(1),
  fileUrl: z.string().min(1),
});

coreHrRouter.post('/employees/:id/documents', async (req, res) => {
  if (!canEditLimited(req.auth!.role)) {
    throw AppError.forbidden();
  }
  const input = addDocumentSchema.parse(req.body);
  const document = await documentService.addDocument({
    organizationId: req.auth!.organizationId,
    employeeId: req.params.id,
    uploadedByUserId: req.auth!.userId,
    ...input,
  });
  res.status(201).json(document);
});

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

const createDepartmentSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(1),
  parentId: z.string().optional(),
});

coreHrRouter.post('/departments', requireRole('SUPER_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const input = createDepartmentSchema.parse(req.body);
  const department = await departmentService.createDepartment({
    organizationId: req.auth!.organizationId,
    actingUserId: req.auth!.userId,
    ...input,
  });
  res.status(201).json(department);
});

coreHrRouter.get('/departments', async (req, res) => {
  const departments = await departmentService.listDepartments(req.auth!.organizationId);
  res.json(departments);
});

coreHrRouter.get('/departments/:id', async (req, res) => {
  const department = await departmentService.getDepartmentById(req.auth!.organizationId, req.params.id);
  res.json(department);
});

const updateDepartmentSchema = z.object({
  name: z.string().min(2).optional(),
  parentId: z.string().nullable().optional(),
});

coreHrRouter.patch('/departments/:id', requireRole('SUPER_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const input = updateDepartmentSchema.parse(req.body);
  const department = await departmentService.updateDepartment(req.auth!.organizationId, req.auth!.userId, req.params.id, input);
  res.json(department);
});

const setHeadSchema = z.object({ headEmployeeId: z.string().min(1) });

coreHrRouter.patch('/departments/:id/head', requireRole('SUPER_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const { headEmployeeId } = setHeadSchema.parse(req.body);
  const department = await departmentService.setDepartmentHead(req.auth!.organizationId, req.auth!.userId, req.params.id, headEmployeeId);
  res.json(department);
});

coreHrRouter.patch('/departments/:id/archive', requireRole('SUPER_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const department = await departmentService.archiveDepartment(req.auth!.organizationId, req.auth!.userId, req.params.id);
  res.json(department);
});

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

const createBranchSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(1),
  region: z.string().optional(),
  address: z.string().optional(),
});

coreHrRouter.post('/branches', requireRole('SUPER_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const input = createBranchSchema.parse(req.body);
  const branch = await branchService.createBranch({
    organizationId: req.auth!.organizationId,
    actingUserId: req.auth!.userId,
    ...input,
  });
  res.status(201).json(branch);
});

coreHrRouter.get('/branches', async (req, res) => {
  const branches = await branchService.listBranches(req.auth!.organizationId);
  res.json(branches);
});

coreHrRouter.get('/branches/:id', async (req, res) => {
  const branch = await branchService.getBranchById(req.auth!.organizationId, req.params.id);
  res.json(branch);
});

const updateBranchSchema = z.object({
  name: z.string().min(2).optional(),
  region: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
});

coreHrRouter.patch('/branches/:id', requireRole('SUPER_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const input = updateBranchSchema.parse(req.body);
  const branch = await branchService.updateBranch(req.auth!.organizationId, req.auth!.userId, req.params.id, input);
  res.json(branch);
});

coreHrRouter.patch('/branches/:id/archive', requireRole('SUPER_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const branch = await branchService.archiveBranch(req.auth!.organizationId, req.auth!.userId, req.params.id);
  res.json(branch);
});

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

const createPositionSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(1),
  departmentId: z.string().min(1),
  branchId: z.string().optional(),
  grade: z.string().optional(),
  approvedHeadcount: z.coerce.number().int().positive().optional(),
});

coreHrRouter.post('/positions', requireRole('SUPER_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const input = createPositionSchema.parse(req.body);
  const position = await positionService.createPosition({
    organizationId: req.auth!.organizationId,
    actingUserId: req.auth!.userId,
    ...input,
  });
  res.status(201).json(position);
});

coreHrRouter.get('/positions', async (req, res) => {
  const positions = await positionService.listPositions(req.auth!.organizationId);
  res.json(positions);
});

coreHrRouter.get('/positions/:id', async (req, res) => {
  const position = await positionService.getPositionById(req.auth!.organizationId, req.params.id);
  res.json(position);
});

const updatePositionSchema = z.object({
  name: z.string().min(2).optional(),
  grade: z.string().nullable().optional(),
  approvedHeadcount: z.coerce.number().int().positive().optional(),
  branchId: z.string().nullable().optional(),
});

coreHrRouter.patch('/positions/:id', requireRole('SUPER_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const input = updatePositionSchema.parse(req.body);
  const position = await positionService.updatePosition(req.auth!.organizationId, req.auth!.userId, req.params.id, input);
  res.json(position);
});

coreHrRouter.patch('/positions/:id/archive', requireRole('SUPER_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const position = await positionService.archivePosition(req.auth!.organizationId, req.auth!.userId, req.params.id);
  res.json(position);
});

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

const auditLogQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

coreHrRouter.get('/audit-log', requireRole('SUPER_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const query = auditLogQuerySchema.parse(req.query);
  const result = await auditLogService.listAuditLog({ organizationId: req.auth!.organizationId, ...query });
  res.json(result);
});
