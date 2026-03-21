import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { MessageSquare, TrendingUp, BookOpen, Flame, Brain, Trophy, Zap, Award } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

interface StudentDashboardProps {
  readinessScore?: number;
}

export default function StudentDashboard({ readinessScore = 0 }: StudentDashboardProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Record today's login for streak
  useEffect(() => {
    if (!user) return;
    supabase.from('study_streaks').upsert(
      { user_id: user.id, login_date: new Date().toISOString().split('T')[0] },
      { onConflict: 'user_id,login_date' }
    ).then(() => {});
  }, [user]);

  const { data: studentProfile } = useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('student_profiles').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: progress, refetch: refetchProgress } = useQuery({
    queryKey: ['student-progress', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('student_progress').select('*').eq('student_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: streakDays } = useQuery({
    queryKey: ['study-streaks', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('study_streaks')
        .select('login_date')
        .eq('user_id', user!.id)
        .order('login_date', { ascending: false })
        .limit(60);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: recentSubmissions } = useQuery({
    queryKey: ['recent-submissions', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('assignment_submissions')
        .select('*, assignments(*)')
        .eq('student_id', user!.id)
        .order('submitted_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: announcements } = useQuery({
    queryKey: ['student-announcements'],
    queryFn: async () => {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .or('target_role.is.null,target_role.eq.student')
        .order('created_at', { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('student-progress-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_progress', filter: `student_id=eq.${user.id}` }, () => {
        refetchProgress();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refetchProgress]);

  const currentStreak = useMemo(() => {
    if (!streakDays || streakDays.length === 0) return 0;
    const dates = streakDays.map(d => d.login_date).sort().reverse();
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < dates.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().split('T')[0];
      if (dates[i] === expectedStr) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [streakDays]);

  // Build last 28 days calendar
  const streakCalendar = useMemo(() => {
    const dateSet = new Set(streakDays?.map(d => d.login_date) || []);
    const days = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({ date: dateStr, active: dateSet.has(dateStr), dayLabel: d.toLocaleDateString('en', { weekday: 'narrow' }) });
    }
    return days;
  }, [streakDays]);

  const subjects = (studentProfile?.subjects as MatricSubject[]) || [];

  const getSubjectProgress = (subject: MatricSubject) => {
    const subjectProgress = progress?.filter(p => p.subject === subject) || [];
    if (subjectProgress.length === 0) return 0;
    return Math.round(subjectProgress.reduce((acc, p) => acc + p.mastery_level, 0) / subjectProgress.length);
  };

  const totalTopics = progress?.length || 0;
  const masteredTopics = progress?.filter(p => p.mastery_level >= 80).length || 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold">
          Welcome back, {profile?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-muted-foreground mt-1">Ready to ace your matric? Let's get started.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--student-accent))]/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5" style={{ color: 'hsl(var(--student-accent))' }} />
              </div>
              <div>
                <p className="text-2xl font-bold">{subjects.length}</p>
                <p className="text-xs text-muted-foreground">Subjects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{subjects.length > 0 ? Math.round(subjects.reduce((acc, s) => acc + getSubjectProgress(s), 0) / subjects.length) : 0}%</p>
                <p className="text-xs text-muted-foreground">Avg Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--teacher-accent))]/10 flex items-center justify-center">
                <Trophy className="w-5 h-5" style={{ color: 'hsl(var(--teacher-accent))' }} />
              </div>
              <div>
                <p className="text-2xl font-bold">{masteredTopics}</p>
                <p className="text-xs text-muted-foreground">Mastered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalTopics}</p>
                <p className="text-xs text-muted-foreground">Topics</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{currentStreak}</p>
                <p className="text-xs text-muted-foreground">Day Streak 🔥</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Award className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{readinessScore}%</p>
                <p className="text-xs text-muted-foreground">Matric Readiness</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Study Streak Calendar */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <h3 className="text-sm font-display font-semibold mb-3 flex items-center gap-2">
            <Flame className="w-4 h-4 text-destructive" /> Study Calendar (Last 28 Days)
          </h3>
          <div className="grid grid-cols-7 gap-1.5">
            {streakCalendar.map((day, i) => (
              <div
                key={day.date}
                title={day.date}
                className={`aspect-square rounded-md flex items-center justify-center text-[10px] font-medium transition-colors ${
                  day.active
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {new Date(day.date).getDate()}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => navigate('/tutor')} size="lg">
          <MessageSquare className="w-4 h-4 mr-2" /> AI Tutor
        </Button>
        <Button onClick={() => navigate('/quiz')} variant="outline" size="lg">
          <Brain className="w-4 h-4 mr-2" /> Take a Quiz
        </Button>
        <Button onClick={() => navigate('/progress')} variant="outline" size="lg">
          <TrendingUp className="w-4 h-4 mr-2" /> My Progress
        </Button>
      </div>

      {/* Announcements */}
      {announcements && announcements.length > 0 && (
        <div>
          <h2 className="text-xl font-display font-semibold mb-3">📢 Announcements</h2>
          <div className="space-y-2">
            {announcements.map(a => (
              <Card key={a.id} className="glass-card border-accent/20">
                <CardContent className="p-4">
                  <h3 className="font-medium">{a.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">{new Date(a.created_at).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Subjects Grid */}
      <div>
        <h2 className="text-xl font-display font-semibold mb-4">My Subjects</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map(subject => {
            const prog = getSubjectProgress(subject);
            return (
              <Card key={subject} className="glass-card hover:shadow-xl transition-shadow cursor-pointer group" onClick={() => navigate(`/tutor?subject=${subject}`)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="text-2xl">{SUBJECT_ICONS[subject]}</span>
                      <h3 className="font-semibold mt-2">{SUBJECT_LABELS[subject]}</h3>
                    </div>
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <MessageSquare className="w-4 h-4 mr-1" /> Chat
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{prog}%</span>
                    </div>
                    <Progress value={prog} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Results */}
      {recentSubmissions && recentSubmissions.length > 0 && (
        <div>
          <h2 className="text-xl font-display font-semibold mb-4">Recent Results</h2>
          <div className="space-y-2">
            {recentSubmissions.map(sub => (
              <Card key={sub.id} className="glass-card">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{(sub.assignments as any)?.title || 'Quiz'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(sub.submitted_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-lg font-bold ${(sub.score || 0) >= 70 ? 'text-[hsl(var(--teacher-accent))]' : 'text-destructive'}`}>
                    {sub.score}%
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {subjects.length === 0 && (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No subjects configured yet. Please update your profile with your matric subjects.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
