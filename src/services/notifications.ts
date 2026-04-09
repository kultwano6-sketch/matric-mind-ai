// Notification service for Supabase

import { supabase } from '@/integrations/supabase/client';
import type { AppNotification, NotificationSettings, NotificationType } from './notifications';

// Create a new notification
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  actionUrl?: string,
  priority: 'low' | 'medium' | 'high' = 'medium'
): Promise<AppNotification | null> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        action_url: actionUrl,
        priority,
        read: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

// Get notifications for a user
export async function getUserNotifications(
  userId: string,
  limit: number = 20
): Promise<AppNotification[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return [];
  }
}

// Get unread notification count
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Failed to get unread count:', error);
    return 0;
  }
}

// Mark notification as read
export async function markAsRead(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return false;
  }
}

// Mark all notifications as read
export async function markAllAsRead(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to mark all as read:', error);
    return false;
  }
}

// Delete notification
export async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to delete notification:', error);
    return false;
  }
}

// Get notification settings for user
export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  try {
    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data || {
      enabled: true,
      sound_enabled: true,
      study_reminders: true,
      task_alerts: true,
      ai_recommendations: true,
      system_alerts: true,
      announcements: true,
    };
  } catch (error) {
    console.error('Failed to get notification settings:', error);
    return {
      enabled: true,
      sound_enabled: true,
      study_reminders: true,
      task_alerts: true,
      ai_recommendations: true,
      system_alerts: true,
      announcements: true,
    };
  }
}

// Update notification settings
export async function updateNotificationSettings(
  userId: string,
  settings: Partial<NotificationSettings>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notification_settings')
      .upsert({
        user_id: userId,
        ...settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to update notification settings:', error);
    return false;
  }
}

// Subscribe to real-time notifications
export function subscribeToNotifications(
  userId: string,
  callback: (notification: AppNotification) => void
) {
  return supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      callback(payload.new as AppNotification);
    })
    .subscribe();
}

// Create bulk notifications (for announcements)
export async function createBulkNotification(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  priority: 'low' | 'medium' | 'high' = 'medium'
): Promise<number> {
  try {
    const notifications = userIds.map(userId => ({
      user_id: userId,
      type,
      title,
      message,
      priority,
      read: false,
    }));

    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) throw error;
    return userIds.length;
  } catch (error) {
    console.error('Failed to create bulk notifications:', error);
    return 0;
  }
}

// Send study reminder (scheduled notification helper)
export async function sendStudyReminder(
  userId: string,
  subject?: string
): Promise<AppNotification | null> {
  const subjectText = subject ? ` for ${subject}` : '';
  return createNotification(
    userId,
    'study_reminder',
    '📚 Time to Study!',
    `Don't forget to practice today${subjectText}. Keep your streak going!`,
    '/dashboard',
    'medium'
  );
}

// Send AI recommendation notification
export async function sendAIRecommendation(
  userId: string,
  topic: string,
  reason: string
): Promise<AppNotification | null> {
  return createNotification(
    userId,
    'ai_recommendation',
    '🤖 AI Recommendation',
    `Based on your progress, we recommend reviewing: ${topic}. ${reason}`,
    '/dashboard',
    'low'
  );
}

// Send at-risk alert to teachers
export async function sendAtRiskAlert(
  teacherId: string,
  studentName: string,
  subject: string
): Promise<AppNotification | null> {
  return createNotification(
    teacherId,
    'at_risk',
    '🚨 Student At Risk',
    `${studentName} is struggling with ${subject}. Consider intervention.`,
    '/teacher-dashboard',
    'high'
  );
}