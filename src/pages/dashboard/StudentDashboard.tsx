import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SUBJECT_LABELS, SUBJECT_ICONS, normalizeSubject } from '@/lib/subjects';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { 
  MessageSquare, TrendingUp, BookOpen, Flame, Brain, Trophy, 
  Mic, Camera, Calendar, Sparkles, ChevronRight, Clock, Target,
  Zap, Star, Award, Download
} from 'lucide-react';
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

  const { data: progress } = useQuery({
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

  const subjects = ((studentProfile?.subjects as MatricSubject[]) || []).map(s => normalizeSubject(s));

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getSubjectProgress = (subject: MatricSubject) => {
    const subjectProgress = progress?.filter(p => p.subject === subject) || [];
    if (subjectProgress.length === 0) return 0;
    return Math.round(subjectProgress.reduce((acc, p) => acc + p.mastery_level, 0) / subjectProgress.length);
  };

  const avgProgress = subjects.length > 0 
    ? Math.round(subjects.reduce((acc, s) => acc + getSubjectProgress(s), 0) / subjects.length) 
    : 0;

  // AI Features data
  const aiFeatures = [
    {
      id: 'tutor',
      title: 'AI Tutor',
      description: 'Chat with an expert AI tutor for any subject. Get instant explanations and help with your studies.',
      icon: MessageSquare,
      path: '/tutor',
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-500/20 to-cyan-500/20',
      stats: 'All 23 Subjects'
    },
    {
      id: 'voice',
      title: 'Voice Tutor',
      description: 'Talk to your AI tutor using your voice. Perfect for hands-free learning and pronunciation.',
      icon: Mic,
      path: '/voice-tutor',
      gradient: 'from-purple-500 to-pink-500',
      bgGradient: 'from-purple-500/20 to-pink-500/20',
      stats: 'Speak & Learn'
    },
    {
      id: 'snapsolve',
      title: 'SnapSolve',
      description: 'Take a photo of any question and get step-by-step solutions with detailed explanations.',
      icon: Camera,
      path: '/snap-solve',
      gradient: 'from-orange-500 to-red-500',
      bgGradient: 'from-orange-500/20 to-red-500/20',
      stats: 'Photo to Solution'
    },
    {
      id: 'planner',
      title: 'Study Planner',
      description: 'Create personalized study schedules with AI. Track your progress and stay on track for matric.',
      icon: Calendar,
      path: '/study-planner',
      gradient: 'from-emerald-500 to-teal-500',
      bgGradient: 'from-emerald-500/20 to-teal-500/20',
      stats: 'Plan & Achieve'
    },
    {
      id: 'notes',
      title: 'Study Notes',
      description: 'Comprehensive topic summaries for every subject. Study smarter with AI-powered notes.',
      icon: Download,
      path: '/study-notes',
      gradient: 'from-amber-500 to-yellow-500',
      bgGradient: 'from-amber-500/20 to-yellow-500/20',
      stats: 'All Topics'
    }
  ];

  const quickActions = [
    { label: 'Take Quiz', icon: Brain, path: '/quiz', color: 'text-purple-500' },
    { label: 'View Progress', icon: TrendingUp, path: '/progress', color: 'text-blue-500' },
    { label: 'Gamification', icon: Trophy, path: '/gamification', color: 'text-yellow-500' },
    { label: 'Resources', icon: BookOpen, path: '/study-notes', color: 'text-green-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Compact Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl gradient-hero p-5 md:p-6">
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-display font-bold text-white">
                {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'Learner'}!
              </h1>
              <p className="text-white/70 text-sm mt-1">Ready to ace matric?</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2">
                <Flame className="w-5 h-5 text-orange-400" />
                <span className="text-white font-semibold">{currentStreak} day streak</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row - Compact */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-3 text-center">
            <BookOpen className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xl font-bold">{subjects.length}</p>
            <p className="text-[10px] text-muted-foreground">Subjects</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
            <p className="text-xl font-bold">{avgProgress}%</p>
            <p className="text-[10px] text-muted-foreground">Progress</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 text-center">
            <Star className="w-5 h-5 mx-auto mb-1 text-purple-500" />
            <p className="text-xl font-bold">{progress?.filter(p => p.mastery_level >= 80).length || 0}</p>
            <p className="text-[10px] text-muted-foreground">Mastered</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 text-center">
            <Flame className="w-5 h-5 mx-auto mb-1 text-orange-500" />
            <p className="text-xl font-bold">{currentStreak}</p>
            <p className="text-[10px] text-muted-foreground">Day Streak</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Start - Main Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card 
          className="glass-card cursor-pointer hover:shadow-lg transition-all group overflow-hidden"
          onClick={() => navigate('/tutor')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center group-hover:scale-105 transition-transform">
                <MessageSquare className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">AI Tutor</h3>
                <p className="text-xs text-muted-foreground">Get instant help</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="glass-card cursor-pointer hover:shadow-lg transition-all group overflow-hidden"
          onClick={() => navigate('/quiz')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">Take Quiz</h3>
                <p className="text-xs text-muted-foreground">Test your knowledge</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Subjects - Horizontal scroll on mobile */}
      {subjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-display font-semibold">My Subjects</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/progress')}>
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {subjects.slice(0, 6).map(subject => {
              const prog = getSubjectProgress(subject);
              return (
                <Card key={subject} className="glass-card group hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">{SUBJECT_ICONS[subject]}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{SUBJECT_LABELS[subject]}</h3>
                        <p className="text-xs text-muted-foreground">{prog}%</p>
                      </div>
                    </div>
                    <Progress value={prog} className="h-1.5 mb-3" />
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 h-7 text-xs"
                        onClick={() => navigate(`/tutor?subject=${subject}`)}
                      >
                        Chat
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 h-7 text-xs"
                        onClick={() => navigate(`/quiz?subject=${subject}`)}
                      >
                        Quiz
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Study Streak - Compact Calendar */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" /> Study Streak
            </h3>
            <span className="text-xs text-muted-foreground">{currentStreak} day{currentStreak !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <div key={i} className="text-[10px] text-muted-foreground text-center">{day}</div>
            ))}
            {Array.from({ length: 28 }).map((_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (27 - i));
              const dateStr = d.toISOString().split('T')[0];
              const isActive = streakDays?.some(s => s.login_date === dateStr);
              return (
                <div
                  key={dateStr}
                  title={dateStr}
                  className={`aspect-square rounded-md flex items-center justify-center text-[10px] font-medium transition-colors ${
                    isActive
                      ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {d.getDate()}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Study Notes Quick Access */}
      <Card className="glass-card cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/study-notes')}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Study Notes</h3>
              <p className="text-xs text-muted-foreground">CAPS-aligned downloadable notes</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Getting Started for new users */}
      {subjects.length === 0 && (
        <Card className="glass-card border-dashed border-2">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Set Up Your Subjects</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Add your matric subjects to unlock AI tutoring and progress tracking.
            </p>
            <Button onClick={() => navigate('/settings')} size="sm">
              Setup Subjects
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
