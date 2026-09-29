export type LearningMaterialType = 'AUDIO' | 'VIDEO' | 'ARTICLE' | 'BOOK' | 'COURSE' | 'INSTRUCTION' | 'PRESENTATION';
export type LearningContentSource = 'LINK' | 'FILE';
export type LearningDisplayMode = 'EMBED' | 'NEW_TAB';
export type LearningCompletionRule = 'MANUAL' | 'ON_OPEN' | 'ON_FINISH';
export type LearningLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type LearningVisibility = 'ALL' | 'AUDIENCE' | 'HIDDEN';

export const LEVEL_LABEL: Record<LearningLevel, string> = {
  BEGINNER: "Boshlang'ich",
  INTERMEDIATE: "O'rta",
  ADVANCED: 'Yuqori',
};

export const LANGUAGE_LABEL: Record<string, string> = { uz: "O'zbekcha", ru: 'Ruscha', en: 'Inglizcha' };
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
  assignment: {
    dueDate: string | null;
    note: string | null;
    reason: 'LEGAL' | 'POSITION' | 'ONBOARDING' | 'DEVELOPMENT' | 'OTHER';
    reasonText: string | null;
    createdAt: string;
  } | null;
}

export interface LearningMaterialDetail extends LearningMaterial {
  contentSource: LearningContentSource;
  displayMode: LearningDisplayMode;
  completionRule: LearningCompletionRule;
  allowDownload: boolean;
  level: LearningLevel | null;
  language: string | null;
  downloadUrl: string | null;
  contentFile: { fileName: string; mimeType: string; sizeBytes: number } | null;
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

export interface LearningRecommendedMaterial extends LearningMaterial {
  recommendedBy: { fullName: string; comment: string | null; createdAt: string }[];
}

export interface Colleague {
  id: string;
  fullName: string;
  department: string | null;
  position: string | null;
}

export interface LearningSummary {
  recommended: number;
  favorites: number;
  pendingRequests: number;
  activeGoals: number;
  upcomingEvents: number;
  inProgress: number;
  assigned: number;
}
