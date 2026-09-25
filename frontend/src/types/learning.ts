export type LearningMaterialType = 'AUDIO' | 'VIDEO' | 'ARTICLE' | 'BOOK' | 'COURSE';
export type LearningProgressStatus = 'IN_PROGRESS' | 'COMPLETED';
export type LearningRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type DevelopmentGoalStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface LearningMaterial {
  id: string;
  title: string;
  description: string | null;
  type: LearningMaterialType;
  coverUrl: string | null;
  durationMinutes: number;
  author: string | null;
  tags: string[];
  requiresApproval: boolean;
  publishedAt: string;
  isFavorite: boolean;
  myProgress: {
    progress: number;
    status: LearningProgressStatus;
    lastOpenedAt: string;
    completedAt: string | null;
  } | null;
  assignment: { dueDate: string | null; note: string | null; createdAt: string } | null;
}

export interface LearningMaterialDetail extends LearningMaterial {
  contentUrl: string | null;
  hasAccess: boolean;
  request: { id: string; status: LearningRequestStatus } | null;
}

export interface LearningEvent {
  id: string;
  title: string;
  description: string | null;
  format: 'ONLINE' | 'OFFLINE';
  location: string | null;
  meetingUrl: string | null;
  speaker: string | null;
  coverUrl: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  requiresApproval: boolean;
  registeredCount: number;
  myRegistration: { status: 'REGISTERED' | 'CANCELLED' | 'ATTENDED' } | null;
  myRequest: { id: string; status: LearningRequestStatus } | null;
}

export interface LearningRequest {
  id: string;
  title: string;
  externalUrl: string | null;
  comment: string | null;
  status: LearningRequestStatus;
  decisionComment: string | null;
  decidedAt: string | null;
  createdAt: string;
  material: { id: string; title: string; type: LearningMaterialType } | null;
  event: { id: string; title: string; startsAt: string } | null;
}

export interface DevelopmentGoal {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: DevelopmentGoalStatus;
  createdAt: string;
  materials: (Pick<LearningMaterial, 'id' | 'title' | 'type' | 'durationMinutes' | 'coverUrl'> & { isCompleted: boolean })[];
  completedCount: number;
}

export interface LearningSummary {
  favorites: number;
  pendingRequests: number;
  activeGoals: number;
  upcomingEvents: number;
  inProgress: number;
  assigned: number;
}
