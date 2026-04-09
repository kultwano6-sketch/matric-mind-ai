// Notification system types and helpers

export type NotificationType = 
  | 'study_reminder'
  | 'task_completed'
  | 'test_failed'
  | 'announcement'
  | 'ai_recommendation'
  | 'system_alert'
  | 'achievement'
  | 'streak_reminder'
  | 'at_risk';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  user_id: string;
  action_url?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface NotificationSettings {
  enabled: boolean;
  sound_enabled: boolean;
  study_reminders: boolean;
  task_alerts: boolean;
  ai_recommendations: boolean;
  system_alerts: boolean;
  announcements: boolean;
}

// Default notification settings
export const defaultNotificationSettings: NotificationSettings = {
  enabled: true,
  sound_enabled: true,
  study_reminders: true,
  task_alerts: true,
  ai_recommendations: true,
  system_alerts: true,
  announcements: true,
};

// Notification type to icon mapping
export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  study_reminder: '📚',
  task_completed: '✅',
  test_failed: '❌',
  announcement: '📢',
  ai_recommendation: '🤖',
  system_alert: '⚠️',
  achievement: '🏆',
  streak_reminder: '🔥',
  at_risk: '🚨',
};

// Priority colors
export const PRIORITY_COLORS: Record<string, string> = {
  low: 'border-l-gray-400',
  medium: 'border-l-yellow-400',
  high: 'border-l-red-500',
};