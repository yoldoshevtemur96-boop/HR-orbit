export type AttendanceDayStatus =
  | 'PRESENT'
  | 'LATE'
  | 'EARLY_LEAVE'
  | 'ABSENT'
  | 'ON_LEAVE'
  | 'BUSINESS_TRIP'
  | 'REMOTE'
  | 'SICK';

export type AttendanceSource = 'MANUAL' | 'DEVICE' | 'IMPORT';

export interface AttendanceSettings {
  id: string;
  organizationId: string;
  standardStartTime: string;
  standardEndTime: string;
  standardWorkMinutes: number;
  lateThresholdMinutes: number;
}

export interface AttendanceRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: AttendanceDayStatus;
  source: AttendanceSource;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  note: string | null;
}

export interface ScopedEmployee {
  id: string;
  fullName: string;
  employeeCode: string;
  departmentId: string | null;
  branchId: string | null;
  managerId: string | null;
}

export interface DailyAttendanceRow {
  employee: ScopedEmployee;
  record: AttendanceRecord | null;
}

export type CorrectionReasonType = 'DEVICE_FAILURE' | 'WRONG_CHECK_IN' | 'WRONG_CHECK_OUT';
export type CorrectionStatus = 'PENDING_MANAGER' | 'PENDING_TIMEKEEPER' | 'APPLIED' | 'REJECTED';

export interface AttendanceCorrection {
  id: string;
  organizationId: string;
  employeeId: string;
  attendanceRecordId: string | null;
  date: string;
  reasonType: CorrectionReasonType;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  comment: string | null;
  status: CorrectionStatus;
  workflowInstanceId: string | null;
  createdAt: string;
}

export type DepartmentTimesheetStatus = 'DRAFT' | 'DEPT_SUBMITTED' | 'DEPT_APPROVED' | 'DEPT_REJECTED' | 'CONSOLIDATED';
export type OrganizationTimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface EmployeeAttendanceSummaryLine {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  presentDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  absentDays: number;
  onLeaveDays: number;
  businessTripDays: number;
  remoteDays: number;
  sickDays: number;
  workedHours: number;
  overtimeHours: number;
}

export interface DepartmentTimesheet {
  id: string;
  organizationId: string;
  departmentId: string;
  month: number;
  year: number;
  status: DepartmentTimesheetStatus;
  summaryData: EmployeeAttendanceSummaryLine[];
  submittedAt: string | null;
  deptApprovedByUserId: string | null;
  deptApprovedAt: string | null;
  rejectionComment: string | null;
  generatedByUserId: string;
}

export interface OrganizationTimesheet {
  id: string;
  organizationId: string;
  month: number;
  year: number;
  status: OrganizationTimesheetStatus;
  consolidatedByUserId: string;
  submittedAt: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  rejectionComment: string | null;
  lines?: { departmentTimesheet: DepartmentTimesheet }[];
}
