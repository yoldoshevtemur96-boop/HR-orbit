export type StepActionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
export type WorkflowInstanceStatus = 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface TimelineStep {
  order: number;
  stepName: string;
  status: StepActionStatus;
  assignedUser: { id: string; email: string } | null;
  comment: string | null;
  actedAt: string | null;
  isCurrent: boolean;
}

export interface WorkflowInstanceDetail {
  id: string;
  status: WorkflowInstanceStatus;
  currentStepOrder: number;
  formData: Record<string, unknown>;
  generatedDocument: string | null;
  createdAt: string;
  employee: { id: string; fullName: string; position: string };
  template: { id: string; name: string };
  timeline: TimelineStep[];
}
