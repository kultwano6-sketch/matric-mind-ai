import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress as ProgressBar } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { TrendingUp, Target, AlertCircle, BookOpen, ChevronRight, Loader2, Settings, Brain, Lightbulb } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

// Color for readiness score
function getScoreColor(score: number): string {
  if (score <= 40) return 'text-red-500';
  if (score <= 60) return 'text-orange-500';
  if (score <= 75) return 'text-yellow-500';
  return 'text-green-500';
}

function getScoreBg(score: number): string {
  if (score <= 40) return 'from-red-500 to-red-600';
  if (score <= 60) return 'from-orange-500 to-orange-600';
  if (score <= 75) return 'from-yellow-500 to-yellow-600';
  return 'from-green-500 to-emerald-600';
}

export default function ProgressPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: studentProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('student_profiles').select('subjects').eq('user_id', user!.id).maybeSingle();
      if (error) console.error('Profile error:', error);
      return data;
    },
    enabled: !!user,
  });

  const { data: progress, isLoading: progressLoading } = useQuery({
    queryKey: ['student-progress', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('student_progress').select('*').eq('student_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Get readiness score
  const { data: readinessData } = useQuery({
    queryKey: ['readiness-score', user?.id],
    queryFn: async () => {
      try {
        const res = await fetch('/api/readiness-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: user!.id }),
        });
        return res.json();
      } catch (e) {
        return null;
      }
    },
    enabled: !!user,
  });

  // Get weak topics for recommendations
  const { data: recommendations } = useQuery({
    queryKey: ['recommendations', user?.id],
    queryFn: async () => {
      try {
        const res = await fetch('/api/adaptive-learning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: user!.id }),
        });
        return res.json();
      } catch (e) {
        return null;
      }
    },
    enabled: !!user,
  });

  const subjects = (studentProfile?.subjects as MatricSubject[]) || [];
  const isLoading = profileLoading || progressLoading;

  // Calculate stats from progress data
  const allProgress = progress || [];
  const totalTopics = allProgress.length;
  const masteredTopics = allProgress.filter(p => p.mastery_level >= 80).length;
  const learningTopics = allProgress.filter(p => p.mastery_level >= 50 && p.mastery_level < 80).length;
  const needsWorkTopics = allProgress.filter(p => p.mastery_level < 50).length;
  const overallMastery = totalTopics > 0 
    ? Math.round(allProgress.reduce((a, p) => a + p.mastery_level, 0) / totalTopics) 
    : 0;

  const readinessScore = readinessData?.overall_score || 0;
  const readinessColor = readinessData?.color || 'red';
  const aiTip = readinessData?.ai_tip || 'Complete quizzes to see your readiness score.';

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in p-4 md:p-6">
        {/* Header with gradient */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-500/20 via-blue-500/10 to-purple-500/20 p-6 md:p-8"
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-50" />
          <div className="relative z-10">
            <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              My Progress
            </h1>
            <p className="text-muted-foreground mt-1">Track your performance across all subjects</p>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Matric Readiness Score Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.1 }}
              className="grid md:grid-cols-2 gap-6"
            >
              {/* Readiness Score */}
              <Card className={`border-2 ${readinessColor === 'red' ? 'border-red-200' : readinessColor === 'orange' ? 'border-orange-200' : readinessColor === 'yellow' ? 'border-yellow-200' : 'border-green-200'} shadow-lg`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Target className={`w-5 h-5 ${getScoreColor(readinessScore)}`} />
                    Matric Readiness Score
                  </CardTitle>
                  <CardDescription>Your overall exam preparation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getScoreBg(readinessScore)} flex items-center justify-center shadow-lg`}>
                        <span className="text-3xl font-bold text-white">{readinessScore}%</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Quiz Performance</span>
                        <span className="font-medium">{readinessData?.quiz_performance || 0}%</span>
                      </div>
                      <ProgressBar value={readinessData?.quiz_performance || 0} className="h-2" />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Study Consistency</span>
                        <span className="font-medium">{readinessData?.study_consistency || 0}%</span>
                      </div>
                      <ProgressBar value={readinessData?.study_consistency || 0} className="h-2" />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Topic Mastery</span>
                        <span className="font-medium">{readinessData?.topic_completion || 0}%</span>
                      </div>
                      <ProgressBar value={readinessData?.topic_completion || 0} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Insight */}
              <Card className="border-2 border-border/50 shadow-lg bg-gradient-to-br from-purple-500/5 to-blue-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-500" />
                    AI Study Tip
                  </CardTitle>
                  <CardDescription>Personalized recommendation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <p className="text-purple-700 dark:text-purple-300">{aiTip}</p>
                  </div>
                  {recommendations?.recommendation && (
                    <div className="mt-4 p-3 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium">Recommended Next:</p>
                      <p className="text-sm text-muted-foreground">
                        {recommendations.recommendation.recommended_subject} - {recommendations.recommendation.recommended_topic}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Overall Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="border-2 border-border/50 shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                      <Target className="w-6 h-6 text-green-600" />
                    </div>
                    <p className="text-3xl font-bold">{masteredTopics}</p>
                    <p className="text-xs text-muted-foreground">Topics Mastered</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="border-2 border-border/50 shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                      <BookOpen className="w-6 h-6 text-blue-600" />
                    </div>
                    <p className="text-3xl font-bold">{learningTopics}</p>
                    <p className="text-xs text-muted-foreground">Learning</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="border-2 border-border/50 shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-3">
                      <AlertCircle className="w-6 h-6 text-yellow-600" />
                    </div>
                    <p className="text-3xl font-bold">{needsWorkTopics}</p>
                    <p className="text-xs text-muted-foreground">Need Work</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="border-2 border-border/50 shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                      <TrendingUp className="w-6 h-6 text-purple-600" />
                    </div>
                    <p className="text-3xl font-bold">{overallMastery}%</p>
                    <p className="text-xs text-muted-foreground">Overall</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Subject Cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {subjects.map((subject, index) => {
                const subjectProgress = (progress || [])?.filter(p => p.subject === subject) || [];
                const avgMastery = subjectProgress.length > 0
                  ? Math.round(subjectProgress.reduce((a, p) => a + p.mastery_level, 0) / subjectProgress.length)
                  : 0;
                const mastered = subjectProgress.filter(p => p.mastery_level >= 80).length;
                const needsWork = subjectProgress.filter(p => p.mastery_level < 50).length;

                return (
                  <motion.div
                    key={subject}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 + index * 0.05 }}
                  >
                    <Card className="border-2 border-border/50 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 h-full">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <span className="text-2xl">{SUBJECT_ICONS[subject]}</span>
                            <span>{SUBJECT_LABELS[subject]}</span>
                          </CardTitle>
                          <Badge variant={avgMastery >= 60 ? 'default' : avgMastery >= 40 ? 'secondary' : 'destructive'} 
                            className={avgMastery >= 60 ? 'bg-green-500/20 text-green-700' : ''}>
                            {avgMastery}%
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="text-muted-foreground">Overall Mastery</span>
                            <span className="font-medium">{avgMastery}%</span>
                          </div>
                          <ProgressBar 
                            value={avgMastery} 
                            className="h-3"
                          />
                        </div>
                        <div className="flex gap-4 text-sm pt-2 border-t">
                          <div className="flex items-center gap-1.5">
                            <Target className="w-4 h-4 text-green-500" />
                            <span className="text-green-600 font-medium">{mastered}</span>
                            <span className="text-muted-foreground text-xs">mastered</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <span className="text-red-600 font-medium">{needsWork}</span>
                            <span className="text-muted-foreground text-xs">needs work</span>
                          </div>
                        </div>
                        {subjectProgress.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-2">Start studying to track progress</p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {subjects.length === 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className="border-2 border-border/50 shadow-sm">
                  <CardContent className="p-12 text-center">
                    <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No Subjects Configured</h3>
                    <p className="text-muted-foreground mb-6">Update your profile to see progress across your subjects.</p>
                    <Button 
                      className="bg-gradient-to-r from-green-500 to-blue-500 hover:shadow-lg transition-all"
                      onClick={() => navigate('/settings')}
                    >
                      Configure Subjects <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}