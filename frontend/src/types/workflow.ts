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

export interface WorkflowInstanceSummary {
  id: string;
  status: WorkflowInstanceStatus;
  currentStepOrder: number;
  createdAt: string;
  template: { id: string; name: string };
  employee?: { id: string; fullName: string };
}

export interface WorkflowInstanceDetail extends WorkflowInstanceSummary {
  formData: Record<string, unknown>;
  generatedDocument: string | null;
  employee: { id: string; fullName: string };
  timeline: TimelineStep[];
}

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
}

export interface WorkflowStepDef {
  id: string;
  order: number;
  name: string;
  approverType: 'SPECIFIC_USER' | 'ROLE' | 'DIRECT_MANAGER' | 'DEPARTMENT_HEAD';
  approverRole: string | null;
  approverUserId: string | null;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  formSchema: FormField[];
  documentBody: string | null;
  steps: WorkflowStepDef[];
}

// "Menga kelgan, javob kutayotgan" bosqich yozuvi
export interface PendingStepAction {
  id: string;
  status: StepActionStatus;
  step: { id: string; name: string; order: number };
  instance: WorkflowInstanceSummary;
}
