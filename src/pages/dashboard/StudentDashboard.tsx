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
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl gradient-hero p-6 md:p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
                {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'Learner'}!
              </h1>
              <p className="text-white/70 mt-1">Ready to ace your matric? Your AI study tools are ready.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                <Flame className="w-5 h-5 text-orange-400" />
                <span className="text-white font-semibold">{currentStreak} day streak</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                <Target className="w-5 h-5 text-emerald-400" />
                <span className="text-white font-semibold">{readinessScore}% ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main AI Features Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-semibold">AI Study Tools</h2>
          <span className="text-sm text-muted-foreground">Powered by advanced AI</span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {aiFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={feature.id}
                className="group cursor-pointer overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                onClick={() => navigate(feature.path)}
              >
                <CardContent className="p-0">
                  <div className={`bg-gradient-to-br ${feature.bgGradient} p-6`}>
                    <div className="flex items-start justify-between">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-lg`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        <span>Open</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <h3 className="text-lg font-display font-semibold">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{feature.description}</p>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-gradient-to-r ${feature.gradient} text-white`}>
                        <Sparkles className="w-3 h-3" />
                        {feature.stats}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.path}
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-accent/10"
              onClick={() => navigate(action.path)}
            >
              <Icon className={`w-5 h-5 ${action.color}`} />
              <span className="text-sm font-medium">{action.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-500" />
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
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgProgress}%</p>
                <p className="text-xs text-muted-foreground">Avg Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{progress?.filter(p => p.mastery_level >= 80).length || 0}</p>
                <p className="text-xs text-muted-foreground">Mastered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{progress?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Topics</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Subjects with Quick AI Access */}
      {subjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold">My Subjects</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/progress')}>
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.slice(0, 6).map(subject => {
              const prog = getSubjectProgress(subject);
              return (
                <Card key={subject} className="glass-card group hover:shadow-xl transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{SUBJECT_ICONS[subject]}</span>
                        <div>
                          <h3 className="font-semibold text-sm">{SUBJECT_LABELS[subject]}</h3>
                          <p className="text-xs text-muted-foreground">{prog}% complete</p>
                        </div>
                      </div>
                    </div>
                    <Progress value={prog} className="h-1.5 mb-4" />
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 h-8 text-xs"
                        onClick={(e) => { e.stopPropagation(); navigate(`/tutor?subject=${subject}`); }}
                      >
                        <MessageSquare className="w-3 h-3 mr-1" /> Chat
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 h-8 text-xs"
                        onClick={(e) => { e.stopPropagation(); navigate(`/quiz?subject=${subject}`); }}
                      >
                        <Brain className="w-3 h-3 mr-1" /> Quiz
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Study Streak Calendar */}
      <Card className="glass-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" /> Study Streak
            </h3>
            <span className="text-sm text-muted-foreground">Last 28 days</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
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

      {/* Getting Started for new users */}
      {subjects.length === 0 && (
        <Card className="glass-card border-dashed border-2">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-lg font-display font-semibold mb-2">Get Started with Your Subjects</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Add your matric subjects to unlock personalized AI tutoring, progress tracking, and study recommendations.
            </p>
            <Button onClick={() => navigate('/settings')}>
              Setup My Subjects <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
