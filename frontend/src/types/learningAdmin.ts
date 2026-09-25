import type { LearningMaterialType } from './learning';

export type AssignmentReason = 'LEGAL' | 'POSITION' | 'ONBOARDING' | 'DEVELOPMENT' | 'OTHER';
export type AssignmentSource = 'MANUAL' | 'RULE' | 'FILE';
export type AssignmentState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';

export const ASSIGNMENT_REASON_LABEL: Record<AssignmentReason, string> = {
  LEGAL: 'Qonunchilik talabi',
  POSITION: 'Lavozim talabi',
  ONBOARDING: 'Ishga moslashish',
  DEVELOPMENT: 'Rivojlanish rejasi',
  OTHER: 'Boshqa',
};

export const ASSIGNMENT_SOURCE_LABEL: Record<AssignmentSource, string> = {
  MANUAL: "Qo'lda",
  RULE: 'Qoida',
  FILE: 'Fayl',
};

export const ASSIGNMENT_STATE_LABEL: Record<AssignmentState, string> = {
  NOT_STARTED: 'Boshlanmagan',
  IN_PROGRESS: 'Jarayonda',
  COMPLETED: 'Tugatgan',
  OVERDUE: "Muddati o'tgan",
  CANCELLED: 'Bekor qilingan',
};

export const ASSIGNMENT_STATE_STYLE: Record<AssignmentState, string> = {
  NOT_STARTED: 'bg-stone-100 text-stone-600',
  IN_PROGRESS: 'bg-sky-50 text-sky-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  OVERDUE: 'bg-rose-50 text-rose-700',
  CANCELLED: 'bg-stone-100 text-stone-400',
};

export interface AssignableMaterial {
  id: string;
  title: string;
  type: LearningMaterialType;
  durationMinutes: number;
  coverUrl: string | null;
  activeAssignments: number;
}

export interface AudienceOption {
  id: string;
  name: string;
  employeeCount: number;
}

export interface AudienceOptions {
  canAssignWholeOrganization: boolean;
  departments: AudienceOption[];
  positions: AudienceOption[];
  branches: AudienceOption[];
  employees: { id: string; fullName: string; employeeCode: string; departmentId: string | null }[];
}

export interface Audience {
  allOrganization: boolean;
  departmentIds: string[];
  positionIds: string[];
  branchIds: string[];
  employeeIds: string[];
}

export interface PreviewEmployee {
  id: string;
  fullName: string;
  employeeCode: string;
  department: string | null;
}

export interface AssignmentPreview {
  total: number;
  toAssignCount: number;
  skippedActiveCount: number;
  skippedCompletedCount: number;
  toAssign: PreviewEmployee[];
  skippedActive: PreviewEmployee[];
  skippedCompleted: PreviewEmployee[];
}

export interface AssignmentRow {
  id: string;
  employee: PreviewEmployee;
  material: { id: string; title: string; type: LearningMaterialType };
  reason: AssignmentReason;
  reasonText: string | null;
  note: string | null;
  source: AssignmentSource;
  dueDate: string | null;
  createdAt: string;
  cancelledAt: string | null;
  progress: { progress: number; completedAt: string | null } | null;
  state: AssignmentState;
}

export interface AssignmentList {
  counts: Record<AssignmentState, number>;
  rows: AssignmentRow[];
}
