import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '@/middleware/auth';
import * as employeeService from './employee.service';
import * as departmentService from './department.service';

export const coreHrRouter = Router();
coreHrRouter.use(authenticate);

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

const createEmployeeSchema = z.object({
  fullName: z.string().min(2),
  position: z.string().min(1),
  departmentId: z.string().optional(),
  managerId: z.string().optional(),
  userId: z.string().optional(),
});

coreHrRouter.post(
  '/employees',
  requireRole('SUPER_ADMIN', 'HR_MANAGER'),
  async (req, res) => {
    const input = createEmployeeSchema.parse(req.body);
    const employee = await employeeService.createEmployee({
      organizationId: req.auth!.organizationId,
      ...input,
    });
    res.status(201).json(employee);
  },
);

coreHrRouter.get('/employees', async (req, res) => {
  const employees = await employeeService.listEmployees(req.auth!.organizationId);
  res.json(employees);
});

coreHrRouter.get('/employees/:id', async (req, res) => {
  const employee = await employeeService.getEmployeeById(req.auth!.organizationId, req.params.id);
  res.json(employee);
});

const updateEmployeeSchema = z.object({
  fullName: z.string().min(2).optional(),
  position: z.string().min(1).optional(),
  departmentId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED']).optional(),
});

coreHrRouter.patch(
  '/employees/:id',
  requireRole('SUPER_ADMIN', 'HR_MANAGER'),
  async (req, res) => {
    const input = updateEmployeeSchema.parse(req.body);
    const employee = await employeeService.updateEmployee(req.auth!.organizationId, req.params.id, input);
    res.json(employee);
  },
);

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

const createDepartmentSchema = z.object({
  name: z.string().min(2),
  parentId: z.string().optional(),
});

coreHrRouter.post(
  '/departments',
  requireRole('SUPER_ADMIN', 'HR_MANAGER'),
  async (req, res) => {
    const { name, parentId } = createDepartmentSchema.parse(req.body);
    const department = await departmentService.createDepartment(req.auth!.organizationId, name, parentId);
    res.status(201).json(department);
  },
);

coreHrRouter.get('/departments', async (req, res) => {
  const departments = await departmentService.listDepartments(req.auth!.organizationId);
  res.json(departments);
});

const setHeadSchema = z.object({ headEmployeeId: z.string().min(1) });

coreHrRouter.patch(
  '/departments/:id/head',
  requireRole('SUPER_ADMIN', 'HR_MANAGER'),
  async (req, res) => {
    const { headEmployeeId } = setHeadSchema.parse(req.body);
    const department = await departmentService.setDepartmentHead(req.auth!.organizationId, req.params.id, headEmployeeId);
    res.json(department);
  },
);
