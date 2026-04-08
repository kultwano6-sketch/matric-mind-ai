// services/notifications.ts — Client-side notification system with sound

import { toast, Toaster, toast as sonner } from 'sonner';

// Notification sound URL (free notification sound)
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

// Play notification sound
export function playNotificationSound(): void {
  try {
    const audio = new Audio(NOTIFICATION_SOUND);
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Silently fail if audio can't play (e.g., browser restrictions)
    });
  } catch {
    // Ignore audio errors
  }
}

// Show notification with optional sound
export interface NotificationOptions {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'default';
  playSound?: boolean;
  duration?: number;
}

export function showNotification(options: NotificationOptions): void {
  const { title, message, type = 'default', playSound = true, duration = 4000 } = options;
  
  if (playSound) {
    playNotificationSound();
  }
  
  const toastOptions = {
    duration,
    style: {
      background: type === 'success' ? '#22c55e' : 
                 type === 'error' ? '#ef4444' : 
                 type === 'warning' ? '#f59e0b' : 
                 type === 'info' ? '#3b82f6' : '',
      color: '#fff',
      borderRadius: '12px',
    },
  };
  
  switch (type) {
    case 'success':
      sonner.success(message, { ...toastOptions, title });
      break;
    case 'error':
      sonner.error(message, { ...toastOptions, title });
      break;
    case 'warning':
      sonner.warning(message, { ...toastOptions, title });
      break;
    case 'info':
      sonner.info(message, { ...toastOptions, title });
      break;
    default:
      sonner(message, { ...toastOptions, title });
  }
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
}

// Send browser push notification (if permission granted)
export function sendPushNotification(title: string, body: string, icon?: string): void {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
    });
  }
}

// Notification types for the app
export const NOTIFICATION_TYPES = {
  STUDY_REMINDER: 'study_reminder',
  QUIZ_RESULT: 'quiz_result',
  STREAK_ALERT: 'streak_alert',
  ACHIEVEMENT: 'achievement',
  DAILY_CHALLENGE: 'daily_challenge',
  EXAM_REMINDER: 'exam_reminder',
} as const;

// Check if we're in quiet hours
export function isQuietHours(start: string, end: string): boolean {
  if (!start || !end) return false;
  
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;
  
  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // Quiet hours span midnight
    return currentTime >= startTime || currentTime <= endTime;
  }
}
