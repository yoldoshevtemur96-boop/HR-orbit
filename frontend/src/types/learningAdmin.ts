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
  unmatchedCodes?: string[]; // qoida preview'i: tashkilotda topilmagan tabel raqamlari
}

export interface AssignmentRow {
  id: string;
  employee: PreviewEmployee;
  material: { id: string; title: string; type: LearningMaterialType };
  reason: AssignmentReason;
  reasonText: string | null;
  note: string | null;
  source: AssignmentSource;
  rule: { id: string; name: string } | null;
  batch: { id: string; name: string } | null;
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

export type RuleType = 'ONE_TIME' | 'PERMANENT';
export type RuleScope = 'GLOBAL' | 'LOCAL';

export const RULE_SCOPE_LABEL: Record<RuleScope, string> = {
  GLOBAL: 'Global',
  LOCAL: 'Lokal',
};

export const RULE_TYPE_LABEL: Record<RuleType, string> = {
  ONE_TIME: 'Bir martalik',
  PERMANENT: 'Doimiy',
};

export type RuleStatus = 'DRAFT' | 'ACTIVE' | 'STOPPED' | 'COMPLETED' | 'ARCHIVED';

export const RULE_STATUS_LABEL: Record<RuleStatus, string> = {
  DRAFT: 'Qoralama',
  ACTIVE: 'Faol',
  STOPPED: "To'xtatilgan",
  COMPLETED: 'Bajarildi',
  ARCHIVED: 'Arxivda',
};

export const RULE_STATUS_STYLE: Record<RuleStatus, string> = {
  DRAFT: 'bg-stone-100 text-stone-600',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  STOPPED: 'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-sky-50 text-sky-700',
  ARCHIVED: 'bg-stone-100 text-stone-400',
};

export interface AssignmentRuleRow {
  id: string;
  name: string;
  description: string | null;
  tag: string | null;
  type: RuleType;
  status: RuleStatus;
  scope: RuleScope;
  materialId: string | null;
  // GLOBAL — biriktirilgan kurslar, LOCAL — o'z kursi
  materials: { id: string; title: string; type: LearningMaterialType; status?: string }[];
  audience: {
    allOrganization: boolean;
    departments: string[];
    positions: string[];
    branches: string[];
    hiredWithinDays: number | null;
  };
  reason: AssignmentReason;
  reasonText: string | null;
  dueInDays: number | null;
  dueDate: string | null;
  skipIfCompletedWithinDays: number | null;
  cancelOutOfScope: boolean;
  employeeCodes: string[];
  hiredFrom: string | null;
  hiredTo: string | null;
  notifyOnAssign: boolean;
  remindBeforeDays: number | null;
  remindAfterDays: number | null;
  resetProgress: boolean;
  lastRunAt: string | null;
  createdAt: string;
  activeAssignments: number;
  completedAssignments: number;
  cancelledAssignments: number;
  completionPercent: number;
}

export type BatchState = 'IN_PROGRESS' | 'COMPLETED' | 'HAS_OVERDUE' | 'CANCELLED';

export const BATCH_STATE_LABEL: Record<BatchState, string> = {
  IN_PROGRESS: 'Jarayonda',
  HAS_OVERDUE: "Muddati o'tganlar bor",
  COMPLETED: 'Bajarildi',
  CANCELLED: 'Bekor qilingan',
};

export const BATCH_STATE_STYLE: Record<BatchState, string> = {
  IN_PROGRESS: 'bg-sky-50 text-sky-700',
  HAS_OVERDUE: 'bg-rose-50 text-rose-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-stone-100 text-stone-400',
};

export interface BatchRow {
  id: string;
  name: string;
  source: AssignmentSource;
  material: { id: string; title: string; type: LearningMaterialType };
  rule: { id: string; name: string; status: RuleStatus } | null;
  reason: AssignmentReason;
  reasonText: string | null;
  dueDate: string | null;
  dueInDays: number | null;
  audienceSummary: string | null;
  createdAt: string;
  createdBy: string | null;
  total: number;
  completed: number;
  overdue: number;
  cancelled: number;
  completionPercent: number;
  state: BatchState;
}

export interface BatchList {
  counts: Record<BatchState, number>;
  rows: BatchRow[];
}
