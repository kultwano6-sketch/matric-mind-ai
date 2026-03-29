import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Flame, Calendar, Bell, Snowflake, BellOff,
  TrendingUp, CheckCircle2, Clock, Shield
} from 'lucide-react';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string;
  freezeDaysUsed: number;
  weekData: { [date: string]: boolean };
  reminderTime: string | null;
}

const STORAGE_KEY = 'study_streak_data';
const MAX_FREEZE_DAYS = 1;

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7)); // Monday of this week

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-ZA', { weekday: 'short' }); // Mon, Tue, ...
}

function getDefaultData(): StreakData {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: '',
    freezeDaysUsed: 0,
    weekData: {},
    reminderTime: null,
  };
}

function loadData(): StreakData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...getDefaultData(), ...parsed };
    }
  } catch {
    // ignore
  }
  return getDefaultData();
}

function saveData(data: StreakData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function StudyStreak() {
  const [data, setData] = useState<StreakData>(loadData);
  const [reminderInput, setReminderInput] = useState('');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [showFreezeConfirm, setShowFreezeConfirm] = useState(false);

  const weekDates = getWeekDates();
  const today = getToday();

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Persist data on change
  useEffect(() => {
    saveData(data);
  }, [data]);

  // Schedule notification when reminder is set
  useEffect(() => {
    if (!data.reminderTime || notifPermission !== 'granted') return;

    const interval = setInterval(() => {
      const now = new Date();
      const [hh, mm] = data.reminderTime!.split(':').map(Number);
      if (now.getHours() === hh && now.getMinutes() === mm && now.getSeconds() === 0) {
        new Notification('📚 Study Reminder', {
          body: `Time to study! You're on a ${data.currentStreak}-day streak. Keep it going!`,
          icon: '/favicon.ico',
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [data.reminderTime, data.currentStreak, notifPermission]);

  // Public function to mark today as studied (called from parent)
  const markTodayStudied = useCallback(() => {
    setData(prev => {
      if (prev.lastStudyDate === today) return prev; // already marked

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let newStreak: number;
      if (prev.lastStudyDate === yesterdayStr) {
        newStreak = prev.currentStreak + 1;
      } else if (prev.lastStudyDate === today) {
        newStreak = prev.currentStreak;
      } else {
        newStreak = 1; // reset if broken
      }

      const updated: StreakData = {
        ...prev,
        currentStreak: newStreak,
        longestStreak: Math.max(prev.longestStreak, newStreak),
        lastStudyDate: today,
        weekData: { ...prev.weekData, [today]: true },
      };
      saveData(updated);
      return updated;
    });
  }, [today]);

  // Expose markTodayStudied on window so Gamification page can call it
  useEffect(() => {
    (window as any).__markTodayStudied = markTodayStudied;
    return () => { delete (window as any).__markTodayStudied; };
  }, [markTodayStudied]);

  const handleSetReminder = async () => {
    if (!reminderInput) return;

    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm !== 'granted') return;
    }

    setData(prev => ({ ...prev, reminderTime: reminderInput }));
  };

  const handleRemoveReminder = () => {
    setData(prev => ({ ...prev, reminderTime: null }));
    setReminderInput('');
  };

  const handleUseFreeze = (dateStr: string) => {
    if (data.weekData[dateStr]) return; // already studied
    if (data.freezeDaysUsed >= MAX_FREEZE_DAYS) return;
    if (dateStr !== today) return; // can only freeze today

    setShowFreezeConfirm(true);
  };

  const confirmFreeze = () => {
    setData(prev => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let newStreak = prev.currentStreak;
      // If yesterday was studied (or was a freeze), streak continues
      if (prev.lastStudyDate === yesterdayStr || prev.weekData[yesterdayStr]) {
        // streak continues, no change
      } else if (prev.lastStudyDate !== today) {
        // streak was broken, freeze restores it to 1
        newStreak = Math.max(prev.currentStreak, 1);
      }

      const updated: StreakData = {
        ...prev,
        currentStreak: newStreak,
        longestStreak: Math.max(prev.longestStreak, newStreak),
        lastStudyDate: today,
        freezeDaysUsed: prev.freezeDaysUsed + 1,
        weekData: { ...prev.weekData, [today]: true },
      };
      saveData(updated);
      setShowFreezeConfirm(false);
      return updated;
    });
  };

  const canFreeze = data.freezeDaysUsed < MAX_FREEZE_DAYS && !data.weekData[today];

  return (
    <Card className="glass-card border-white/10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-blue-500/5" />
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/30 to-red-500/30">
              <Flame className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Study Streak
                <Badge variant="outline" className="bg-orange-500/20 border-orange-500/30 text-orange-500">
                  {data.currentStreak} day{data.currentStreak !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
              <CardDescription>
                Longest streak: {data.longestStreak} days
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-3xl font-bold text-orange-500">
              <Flame className="h-7 w-7" />
              {data.currentStreak}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-5">
        {/* Weekly Calendar */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">This Week</span>
          </div>
          <div className="flex justify-between gap-2">
            {weekDates.map(dateStr => {
              const studied = data.weekData[dateStr] === true;
              const isToday = dateStr === today;
              const isPast = dateStr < today;
              const isFuture = dateStr > today;

              return (
                <div key={dateStr} className="flex flex-col items-center gap-1.5 flex-1">
                  <span className={`text-xs font-medium ${
                    isToday ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {getDayLabel(dateStr)}
                  </span>
                  <button
                    onClick={() => handleUseFreeze(dateStr)}
                    disabled={!canFreeze || isFuture || isPast}
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      transition-all duration-200 text-sm font-bold
                      ${studied
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25'
                        : isFuture
                          ? 'bg-muted/50 text-muted-foreground/50 cursor-default'
                          : isToday
                            ? 'bg-muted border-2 border-dashed border-primary/50 text-muted-foreground hover:border-primary cursor-pointer'
                            : 'bg-muted/80 text-muted-foreground'
                      }
                    `}
                    title={
                      studied ? 'Studied!' :
                      isToday && canFreeze ? 'Click to use freeze day' :
                      isToday ? 'Study today!' :
                      isFuture ? 'Upcoming' :
                      'Missed'
                    }
                  >
                    {studied ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isFuture ? (
                      <span className="text-xs">{dateStr.split('-')[2]}</span>
                    ) : (
                      <span className="text-xs">{dateStr.split('-')[2]}</span>
                    )}
                  </button>
                  {isToday && (
                    <span className="text-[10px] text-primary font-medium">Today</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Freeze Day */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-2">
            <Snowflake className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-sm font-medium">Streak Freeze</p>
              <p className="text-xs text-muted-foreground">
                {data.freezeDaysUsed}/{MAX_FREEZE_DAYS} used this week
              </p>
            </div>
          </div>
          {canFreeze ? (
            <Button
              size="sm"
              variant="outline"
              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              onClick={() => handleUseFreeze(today)}
            >
              <Shield className="h-4 w-4 mr-1" />
              Use Freeze
            </Button>
          ) : (
            <Badge variant="outline" className="bg-muted/50 text-muted-foreground">
              {data.freezeDaysUsed >= MAX_FREEZE_DAYS ? 'Used up' : 'Active'}
            </Badge>
          )}
        </div>

        {/* Freeze Confirmation Dialog */}
        {showFreezeConfirm && (
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 space-y-3">
            <div className="flex items-center gap-2">
              <Snowflake className="h-5 w-5 text-blue-400" />
              <p className="text-sm font-medium">Use streak freeze for today?</p>
            </div>
            <p className="text-xs text-muted-foreground">
              This will protect your streak for today without studying. You have {MAX_FREEZE_DAYS - data.freezeDaysUsed} freeze day(s) remaining this week.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmFreeze} className="bg-blue-600 hover:bg-blue-700">
                Confirm
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowFreezeConfirm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Reminder Settings */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Daily Reminder</span>
          </div>

          {data.reminderTime ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  Reminder set for <strong>{data.reminderTime}</strong>
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={handleRemoveReminder}
              >
                <BellOff className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="reminder-time" className="sr-only">Reminder time</Label>
                <Input
                  id="reminder-time"
                  type="time"
                  value={reminderInput}
                  onChange={e => setReminderInput(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <Button onClick={handleSetReminder} className="shrink-0">
                <Bell className="h-4 w-4 mr-1" />
                Set Reminder
              </Button>
            </div>
          )}

          {notifPermission === 'denied' && (
            <p className="text-xs text-destructive mt-2">
              Notifications are blocked. Please enable them in your browser settings.
            </p>
          )}
        </div>

        {/* Last studied */}
        {data.lastStudyDate && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-white/5">
            <TrendingUp className="h-3 w-3" />
            <span>Last studied: {data.lastStudyDate === today ? 'Today' : data.lastStudyDate}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
