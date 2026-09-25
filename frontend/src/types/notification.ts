export type NotificationType =
  | 'REQUEST_SUBMITTED'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'HR_MESSAGE'
  | 'DOCUMENT_AVAILABLE'
  | 'LEARNING_ASSIGNED'
  | 'LEARNING_REMINDER';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}
