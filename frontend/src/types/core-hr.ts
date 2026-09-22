export type EmploymentStatus = 'ACTIVE' | 'PROBATION' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'ARCHIVED';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'TEMPORARY' | 'CONTRACT' | 'REMOTE' | 'HYBRID';
export type Gender = 'MALE' | 'FEMALE';
export type OrgUnitStatus = 'ACTIVE' | 'ARCHIVED';

export interface RefName {
  id: string;
  name: string;
  code?: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  fullName: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  pinfl?: string | null;
  passportNumber?: string | null;
  personalPhone: string | null;
  workPhone: string | null;
  personalEmail: string | null;
  workEmail: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  departmentId: string | null;
  branchId: string | null;
  positionId: string | null;
  managerId: string | null;
  status: EmploymentStatus;
  employmentType: EmploymentType | null;
  contractNumber: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  workSchedule: string | null;
  workLocation: string | null;
  hiredAt: string;
  createdAt: string;
  updatedAt: string;
  position: RefName | null;
  department: RefName | null;
  branch: RefName | null;
  manager: { id: string; fullName: string; employeeCode: string } | null;
  directReports?: { id: string; fullName: string; employeeCode: string }[];
}

export interface EmployeeListResult {
  items: Employee[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  headEmployeeId: string | null;
  status: OrgUnitStatus;
  headEmployee: { id: string; fullName: string } | null;
  employeeCount: number;
  positionCount: number;
  vacantPositionCount: number;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  region: string | null;
  address: string | null;
  managerId: string | null;
  status: OrgUnitStatus;
  manager: { id: string; fullName: string } | null;
  employeeCount: number;
  positionCount: number;
}

export interface Position {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  branchId: string | null;
  grade: string | null;
  approvedHeadcount: number;
  occupiedHeadcount: number;
  vacantHeadcount: number;
  status: OrgUnitStatus;
  department: RefName | null;
  branch: RefName | null;
}

export interface EmploymentRecord {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string | null;
  reason: string | null;
  position: RefName | null;
  department: RefName | null;
  branch: RefName | null;
  manager: { id: string; fullName: string } | null;
  changedByUser: { id: string; email: string } | null;
}

export interface EmployeeEducation {
  id: string;
  level: string;
  institution: string;
  specialty: string | null;
  graduationYear: number | null;
}

export interface DashboardSummary {
  kpi: {
    totalEmployees: number;
    activeEmployees: number;
    onLeaveEmployees: number;
    newEmployees: number;
    terminatedEmployees: number;
    vacantPositions: number;
  };
  byDepartment: { departmentId: string | null; departmentName: string; count: number }[];
  byBranch: { branchId: string | null; branchName: string; count: number }[];
  byStatus: { status: EmploymentStatus; count: number }[];
}
