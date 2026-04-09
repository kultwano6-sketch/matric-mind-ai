import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, Trash2, Settings, Volume2, VolumeX } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { NOTIFICATION_ICONS, PRIORITY_COLORS } from '@/lib/notifications';
import type { AppNotification, NotificationSettings } from '@/lib/notifications';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface NotificationBellProps {
  className?: string;
}

export default function NotificationBell({ className = '' }: NotificationBellProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowSettings(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ['notification-settings', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Mark as read mutation
  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Mark all as read mutation
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Delete notification mutation
  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').delete().eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<NotificationSettings>) => {
      if (!user) return;
      await supabase
        .from('notification_settings')
        .upsert({ user_id: user.id, ...newSettings, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-settings'] }),
  });

  // Play notification sound
  const playSound = () => {
    if (settings?.sound_enabled !== false) {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleBQqH4LQ6K+MWB4kH4LU66+SWR8hG4HW7bKPXBwBdujb2LxWHBkVbtjN0LpaHRl02szQtVkeF3LY0c67WBwYctnT0r1XHRl02tPUvlgfF3LZ1NK/WB4YctnT0r5YHxdy2dTSvlgfGHLY');
      audio.volume = 0.3;
      audio.play().catch(() => {}); // Ignore errors
    }
  };

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        playSound();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (showSettings) {
    return (
      <div ref={dropdownRef} className={`relative ${className}`}>
        <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)} className="relative">
          <Settings className="h-5 w-5" />
        </Button>
        
        {isOpen && (
          <div className="absolute right-0 top-12 w-80 bg-background border rounded-lg shadow-lg z-50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Notification Settings</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span>Enable Notifications</span>
                <input
                  type="checkbox"
                  checked={settings?.enabled ?? true}
                  onChange={(e) => updateSettings.mutate({ enabled: e.target.checked })}
                  className="toggle"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <span>Sound</span>
                <button
                  onClick={() => updateSettings.mutate({ sound_enabled: !settings?.sound_enabled })}
                  className="p-1"
                >
                  {settings?.sound_enabled !== false ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4" />
                  )}
                </button>
              </label>
              
              <label className="flex items-center justify-between">
                <span>Study Reminders</span>
                <input
                  type="checkbox"
                  checked={settings?.study_reminders ?? true}
                  onChange={(e) => updateSettings.mutate({ study_reminders: e.target.checked })}
                  className="toggle"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <span>AI Recommendations</span>
                <input
                  type="checkbox"
                  checked={settings?.ai_recommendations ?? true}
                  onChange={(e) => updateSettings.mutate({ ai_recommendations: e.target.checked })}
                  className="toggle"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <span>System Alerts</span>
                <input
                  type="checkbox"
                  checked={settings?.system_alerts ?? true}
                  onChange={(e) => updateSettings.mutate({ system_alerts: e.target.checked })}
                  className="toggle"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)} className="relative">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-red-500">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-80 max-h-96 bg-background border rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold">Notifications</h3>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => markAllAsRead.mutate()}>
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-72">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">No notifications</div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 border-b hover:bg-muted/50 cursor-pointer transition-colors ${
                    !notif.read ? 'bg-muted/30' : ''
                  } ${PRIORITY_COLORS[notif.priority || 'low']}`}
                  onClick={() => markAsRead.mutate(notif.id)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{NOTIFICATION_ICONS[notif.type] || '📢'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{notif.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatTime(notif.created_at)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-50 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification.mutate(notif.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}