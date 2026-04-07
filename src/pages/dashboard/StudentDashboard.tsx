import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SUBJECT_LABELS, SUBJECT_ICONS, normalizeSubject } from '@/lib/subjects';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, TrendingUp, BookOpen, Flame, Brain,
  Camera, Calendar, ChevronRight, Sparkles, X, Zap, Image,
  Target
} from 'lucide-react';
import { getLevelForXP, getProgressToNextLevel } from '@/services/gamification';
import { getTodaysChallenges, submitChallengeAnswer } from '@/services/dailyChallenge';
import { getRecommendations, dismissRecommendation } from '@/services/studentMemory';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

interface StudentDashboardProps {
  readinessScore?: number;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 }
  }
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } }
};

export default function StudentDashboard({ readinessScore = 0 }: StudentDashboardProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNewFeatures, setShowNewFeatures] = useState(
    () => !localStorage.getItem('matricmind_new_features_dismissed')
  );
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Record login for streak
  useEffect(() => {
    if (!user) return;
    supabase.from('study_streaks').upsert(
      { user_id: user.id, login_date: new Date().toISOString().split('T')[0] },
      { onConflict: 'user_id,login_date' }
    ).then(() => { /* ok */ }).catch(err => console.error('Streak upsert failed:', err));
  }, [user]);

  // Student profile
  const { data: studentProfile } = useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('student_profiles').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Progress
  const { data: progress } = useQuery({
    queryKey: ['student-progress', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('student_progress').select('*').eq('student_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Streak data
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

  // Gamification state
  const { data: gamification } = useQuery({
    queryKey: ['gamification', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('gamification_state')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Daily challenges - optimized with placeholder data while loading
  const { data: challengeData, isLoading: challengeLoading } = useQuery({
    queryKey: ['daily-challenges', user?.id],
    queryFn: () => getTodaysChallenges(user?.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    placeholderData: previousData => previousData || {
      challenges: [],
      grouped: {},
      next_reset: new Date().toISOString()
    },
  });

  // Study sessions today
  const { data: todaySessions } = useQuery({
    queryKey: ['today-sessions', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('study_sessions')
        .select('duration_sec')
        .eq('student_id', user!.id)
        .gte('started_at', `${today}T00:00:00`)
        .lte('started_at', `${today}T23:59:59`);
      return data || [];
    },
    enabled: !!user,
  });

  // Recommendations
  const { data: recommendations } = useQuery({
    queryKey: ['recommendations', user?.id],
    queryFn: () => getRecommendations(user!.id),
    enabled: !!user,
  });

  // Dismiss recommendation mutation
  const dismissMutation = useMutation({
    mutationFn: dismissRecommendation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendations', user?.id] }),
  });

  // Derive streak
  const currentStreak = useMemo(() => {
    if (!streakDays || streakDays.length === 0) return 0;
    const dates = streakDays.map(d => d.login_date).sort((a, b) => b.localeCompare(a));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < dates.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().split('T')[0];
      if (dates[i] === expectedStr) streak++;
      else break;
    }
    return streak;
  }, [streakDays]);

  // Derive subjects & progress
  const subjects = ((studentProfile?.subjects as MatricSubject[]) || []).map(s => normalizeSubject(s));

  const getSubjectProgress = (subject: MatricSubject) => {
    const sp = progress?.filter(p => p.subject === subject) || [];
    if (sp.length === 0) return 0;
    return Math.round(sp.reduce((acc, p) => acc + p.mastery_level, 0) / sp.length);
  };

  const avgProgress = useMemo(() => {
    if (subjects.length === 0) return 0;
    return Math.round(subjects.reduce((acc, s) => acc + getSubjectProgress(s), 0) / subjects.length);
  }, [subjects, progress]);

  // XP + level
  const xp = gamification?.xp || 0;
  const levelInfo = getLevelForXP(xp);
  const levelProgress = getProgressToNextLevel(xp);

  // Study hours today
  const studyMinutesToday = useMemo(() => {
    if (!todaySessions) return 0;
    return todaySessions.reduce((acc, s) => acc + (s.duration_sec || 0), 0) / 60;
  }, [todaySessions]);

  const studyHoursDisplay = studyMinutesToday >= 60
    ? `${(studyMinutesToday / 60).toFixed(1)}h`
    : `${Math.round(studyMinutesToday)}m`;

  // First challenge (uncompleted)
  const firstChallenge = useMemo(() => {
    if (!challengeData?.challenges) return null;
    return challengeData.challenges.find(c => !c.completed) || challengeData.challenges[0] || null;
  }, [challengeData]);

  const challengeCompleted = firstChallenge?.completed || false;

  // Submit challenge
  const handleChallengeSubmit = async () => {
    if (!user || !firstChallenge) return;
    // For MCQ: send the option VALUE (not key) so backend comparison works
    let answer = selectedOption || challengeAnswer;
    if (selectedOption && firstChallenge.content?.options) {
      // selectedOption is the key (A/B/C/D or 1/2/3/4), get the value
      answer = firstChallenge.content.options[selectedOption] || selectedOption;
    }
    if (!answer.trim()) return;

    try {
      await submitChallengeAnswer(user.id, firstChallenge.id, answer);
      queryClient.invalidateQueries({ queryKey: ['daily-challenges', user.id] });
    } catch (err) {
      console.error('Challenge submit error:', err);
    }
    setChallengeAnswer('');
    setSelectedOption(null);
  };

  // Dismiss new features
  const dismissNewFeatures = () => {
    localStorage.setItem('matricmind_new_features_dismissed', 'true');
    setShowNewFeatures(false);
  };

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning', emoji: '🌅' };
    if (hour < 17) return { text: 'Good afternoon', emoji: '🌤️' };
    return { text: 'Good evening', emoji: '🌙' };
  };
  const greeting = getGreeting();

  // Quick actions config
  const quickActions = [
    { label: 'AI Tutor', desc: 'Get instant help', icon: MessageSquare, path: '/tutor', gradient: 'from-blue-500 to-cyan-500' },
    { label: 'SnapSolve', desc: 'Photo → solution', icon: Camera, path: '/snap-solve', gradient: 'from-orange-500 to-red-500' },
    { label: 'Take Quiz', desc: 'Test yourself', icon: Brain, path: '/quiz', gradient: 'from-purple-500 to-pink-500' },
    { label: 'Study Planner', desc: 'Plan your week', icon: Calendar, path: '/smart-study-plan', gradient: 'from-emerald-500 to-teal-500' },
  ];

  // New features links
  const newFeatures = [
    { label: 'Conversation Tutor', path: '/tutor?mode=conversation', icon: MessageSquare },
    { label: 'Textbook Scan', path: '/textbook-scan', icon: Image },
    { label: 'Exam Simulator', path: '/exam-simulator', icon: Target },
    { label: 'Daily Challenges', path: '/daily-challenges', icon: Flame },
  ];

  // Difficulty label
  const difficultyLabels: Record<number, string> = { 1: 'Easy', 2: 'Standard', 3: 'Moderate', 4: 'Challenging' };
  const difficultyColors: Record<number, string> = {
    1: 'bg-green-100 text-green-700',
    2: 'bg-blue-100 text-blue-700',
    3: 'bg-yellow-100 text-yellow-700',
    4: 'bg-red-100 text-red-700',
  };

  // Streak calendar data (last 4 weeks)
  const calendarDays = useMemo(() => {
    const days: Array<{ date: string; dayNum: number; isActive: boolean }> = [];
    const today = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: dateStr,
        dayNum: d.getDate(),
        isActive: streakDays?.some(s => s.login_date === dateStr) || false,
      });
    }
    return days;
  }, [streakDays]);

  return (
    <motion.div
      className="space-y-4 pb-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* 1. Welcome Header */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl gradient-hero p-5 md:p-6">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold text-white">
              {greeting.emoji} {greeting.text}, {profile?.full_name?.split(' ')[0] || 'Learner'}!
            </h1>
            <p className="text-white/70 text-sm mt-1">Ready to ace matric?</p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="text-white font-semibold">{currentStreak} day{currentStreak !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </motion.div>

      {/* 2. Stats Row */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-card hover:shadow-md transition-shadow">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xl font-bold">{readinessScore || avgProgress}%</p>
            <p className="text-[10px] text-muted-foreground">Readiness</p>
          </CardContent>
        </Card>
        <Card className="glass-card hover:shadow-md transition-shadow">
          <CardContent className="p-3 text-center">
            <Sparkles className="w-5 h-5 mx-auto mb-1 text-purple-500" />
            <p className="text-lg font-bold">{levelInfo.icon} Lvl {levelInfo.level}</p>
            <p className="text-[10px] text-muted-foreground truncate">{levelInfo.name} · {xp} XP</p>
          </CardContent>
        </Card>
        <Card className="glass-card hover:shadow-md transition-shadow">
          <CardContent className="p-3 text-center">
            <Flame className="w-5 h-5 mx-auto mb-1 text-orange-500" />
            <p className="text-xl font-bold">{currentStreak}</p>
            <p className="text-[10px] text-muted-foreground">Day Streak</p>
          </CardContent>
        </Card>
        <Card className="glass-card hover:shadow-md transition-shadow">
          <CardContent className="p-3 text-center">
            <BookOpen className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
            <p className="text-xl font-bold">{studyHoursDisplay}</p>
            <p className="text-[10px] text-muted-foreground">Studied Today</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* 3. Daily Challenge Card */}
      <motion.div variants={item}>
        <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5 hover:shadow-lg transition-shadow">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-display font-bold flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" /> Today's Challenge
              </h2>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/daily-challenges')}>
                See All <ChevronRight className="w-3 h-3 ml-0.5" />
              </Button>
            </div>

            {!firstChallenge ? (
              <p className="text-sm text-muted-foreground">No challenges available right now. Check back soon!</p>
            ) : challengeCompleted ? (
              <div className="text-center py-3">
                <p className="text-2xl mb-2">✅</p>
                <p className="font-semibold text-green-600">
                  {firstChallenge.correct ? 'Correct! Well done!' : 'Completed — keep practising!'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Come back tomorrow for new challenges!</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyColors[firstChallenge.difficulty] || difficultyColors[1]}`}>
                    {difficultyLabels[firstChallenge.difficulty] || 'Easy'}
                  </span>
                  <span className="text-xs text-muted-foreground">+{firstChallenge.xp_reward} XP</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{SUBJECT_LABELS[firstChallenge.subject as MatricSubject] || firstChallenge.subject}</span>
                </div>

                <p className="text-sm font-medium mb-3">{firstChallenge.content?.question}</p>

                {/* MCQ options */}
                {firstChallenge.content?.options && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {Object.entries(firstChallenge.content.options).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedOption(key)}
                        className={`text-left text-sm px-3 py-2 rounded-lg border transition-all ${
                          selectedOption === key
                            ? 'border-primary bg-primary/10 text-primary font-medium'
                            : 'border-border hover:border-primary/40 hover:bg-muted/50'
                        }`}
                      >
                        <span className="font-mono text-xs mr-1.5">{key}.</span> {val}
                      </button>
                    ))}
                  </div>
                )}

                {/* Short answer fallback */}
                {!firstChallenge.content?.options && (
                  <input
                    type="text"
                    value={challengeAnswer}
                    onChange={e => setChallengeAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3"
                    onKeyDown={e => e.key === 'Enter' && handleChallengeSubmit()}
                  />
                )}

                <Button
                  size="sm"
                  onClick={handleChallengeSubmit}
                  disabled={!selectedOption && !challengeAnswer.trim()}
                  className="w-full sm:w-auto"
                >
                  Submit Answer
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* 4. Quick Actions Grid */}
      <motion.div variants={item}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map(action => (
            <Card
              key={action.label}
              className="glass-card cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group"
              onClick={() => navigate(action.path)}
            >
              <CardContent className="p-4 text-center">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform`}>
                  <action.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-sm">{action.label}</h3>
                <p className="text-[11px] text-muted-foreground">{action.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* 5. My Subjects */}
      {subjects.length > 0 && (
        <motion.div variants={item}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-display font-semibold">My Subjects</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/progress')}>
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible">
            {subjects.slice(0, 6).map(subject => {
              const prog = getSubjectProgress(subject);
              const barColor = prog >= 70 ? 'bg-green-500' : prog >= 40 ? 'bg-yellow-500' : 'bg-red-500';
              return (
                <Card key={subject} className="glass-card min-w-[200px] md:min-w-0 hover:shadow-md transition-all group">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{SUBJECT_ICONS[subject]}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{SUBJECT_LABELS[subject]}</h3>
                        <p className="text-xs text-muted-foreground">{prog}% mastery</p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted mb-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all`}
                        style={{ width: `${prog}%` }}
                      />
                    </div>
                    <div className="flex gap-1.5">
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
        </motion.div>
      )}

      {/* 6. Study Streak Calendar */}
      <motion.div variants={item}>
        <Card className="glass-card hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" /> Study Streak
              </h3>
              <span className="text-xs text-muted-foreground">{currentStreak} day{currentStreak !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                <div key={i} className="text-[10px] text-muted-foreground text-center font-medium">{day}</div>
              ))}
              {calendarDays.map(day => (
                <div
                  key={day.date}
                  title={day.date}
                  className={`aspect-square rounded-md flex items-center justify-center text-[10px] font-medium transition-colors ${
                    day.isActive
                      ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {day.dayNum}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 7. AI Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <motion.div variants={item}>
          <h2 className="text-lg font-display font-semibold mb-3">💡 AI Recommendations</h2>
          <div className="space-y-2">
            {recommendations.slice(0, 3).map(rec => (
              <Card key={rec.id} className="glass-card hover:shadow-md transition-shadow">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      Focus on <span className="text-primary">{rec.topic}</span> in {SUBJECT_LABELS[rec.subject as MatricSubject] || rec.subject}
                    </p>
                    {rec.reason && <p className="text-xs text-muted-foreground truncate">{rec.reason}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-7 w-7 p-0"
                    onClick={() => dismissMutation.mutate(rec.id)}
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* 8. New Features Callout */}
      <AnimatePresence>
        {showNewFeatures && (
          <motion.div
            variants={item}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="border-dashed border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-purple-500/5 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" /> Try these new features!
                  </h3>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={dismissNewFeatures}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {newFeatures.map(feat => (
                    <Button
                      key={feat.label}
                      variant="outline"
                      size="sm"
                      className="justify-start h-8 text-xs"
                      onClick={() => navigate(feat.path)}
                    >
                      <feat.icon className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                      {feat.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline empty state for new users */}
      {subjects.length === 0 && (
        <motion.div variants={item}>
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
        </motion.div>
      )}
    </motion.div>
  );
}
