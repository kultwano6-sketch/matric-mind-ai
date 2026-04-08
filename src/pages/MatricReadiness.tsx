import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Brain, Target, BookOpen, AlertTriangle, CheckCircle, RefreshCw, Loader2, TrendingUp, Zap, Clock, Award
} from 'lucide-react';

interface SubjectScore {
  subject: string;
  score: number;
  total: number;
  average: number;
}

interface LearnerReadiness {
  overall_score: number;
  subjects: SubjectScore[];
  quiz_count: number;
  total_study_time_minutes: number;
  strong_areas: string[];
  weak_areas: string[];
  recommendations: string[];
}

const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: '#3b82f6',
  'Physical Sciences': '#22c55e',
  'Life Sciences': '#8b5cf6',
  English: '#f59e0b',
  Accounting: '#ef4444',
  Geography: '#14b8a6',
  History: '#ec4899',
  Economics: '#f97316',
};

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-blue-500';
  if (score >= 40) return 'text-yellow-500';
  return 'text-red-500';
};

const getScoreGradient = (score: number) => {
  if (score >= 80) return 'from-green-500 to-emerald-600';
  if (score >= 60) return 'from-blue-500 to-cyan-600';
  if (score >= 40) return 'from-yellow-500 to-orange-600';
  return 'from-red-500 to-rose-600';
};

export default function MatricReadiness() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [readiness, setReadiness] = useState<LearnerReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch student progress from Supabase
        const { data: progressData, error: progressError } = await supabase
          .from('student_progress')
          .select('subject, topic, mastery_level, attempts, last_activity')
          .eq('student_id', user.id);

        if (progressError) throw progressError;

        if (!progressData || progressData.length === 0) {
          setReadiness({
            overall_score: 0,
            subjects: [],
            quiz_count: 0,
            total_study_time_minutes: 0,
            strong_areas: [],
            weak_areas: [],
            recommendations: ['Complete some quizzes to see your readiness data'],
          });
          setLoading(false);
          return;
        }

        // Calculate subject averages from mastery_level
        const subjectScores: Record<string, number[]> = {};
        progressData.forEach((prog: any) => {
          if (!subjectScores[prog.subject]) {
            subjectScores[prog.subject] = [];
          }
          // mastery_level is 0-100
          subjectScores[prog.subject].push(prog.mastery_level || 0);
        });

        const subjectData: SubjectScore[] = Object.entries(subjectScores).map(([subject, scores]) => {
          const average = scores.reduce((a, b) => a + b, 0) / scores.length;
          return {
            subject,
            score: Math.round(average),
            total: 100,
            average: Math.round(average),
          };
        });

        // Calculate overall score
        const allScores = Object.values(subjectScores).flat();
        const overallScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);

        // Identify strong and weak areas
        const strongAreas = subjectData.filter(s => s.average >= 60).map(s => s.subject);
        const weakAreas = subjectData.filter(s => s.average < 60).map(s => s.subject);

        // Generate recommendations
        const recommendations: string[] = [];
        if (weakAreas.length > 0) {
          recommendations.push(`Focus on improving ${weakAreas.join(', ')}`);
        }
        if (overallScore < 50) {
          recommendations.push('Start with foundational topics to build confidence');
        } else if (overallScore < 70) {
          recommendations.push('Practice more questions to improve mastery');
        } else {
          recommendations.push('Keep up the great work! Focus on exam-style practice');
        }

        setReadiness({
          overall_score: overallScore,
          subjects: subjectData,
          quiz_count: progressData.length,
          total_study_time_minutes: progressData.length * 20,
          strong_areas: strongAreas,
          weak_areas: weakAreas,
          recommendations,
        });
      } catch (err: any) {
        console.error('Error fetching readiness:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  const handleRefresh = () => {
    window.location.reload();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <p className="text-red-500">Error: {error}</p>
          <Button onClick={handleRefresh}>Retry</Button>
        </div>
      </DashboardLayout>
    );
  }


const hasData = readiness && readiness.quiz_count > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header with gradient */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/20 via-purple-500/10 to-primary/20 p-6 md:p-8"
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Learner Readiness
              </h1>
              <p className="text-muted-foreground mt-1">Track your exam preparation progress</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2 bg-background/50">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </motion.div>

        {!hasData ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-16">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-6">
              <Brain className="w-12 h-12 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Start Your Journey</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">Complete quizzes to build your readiness profile.</p>
            <Button size="lg" onClick={() => window.location.href = '/quiz'} className="gap-2">
              <Target className="w-5 h-5" />
              Take Your First Quiz
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Score Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-1">
              <Card className="relative overflow-hidden h-full">
                <div className={`absolute inset-0 bg-gradient-to-br ${getScoreGradient(readiness!.overall_score)} opacity-5`} />
                <CardHeader className="text-center relative z-10">
                  <CardTitle className="flex items-center justify-center gap-2">
                    <Award className="w-5 h-5 text-yellow-500" />
                    Overall Score
                  </CardTitle>
                  <CardDescription>Based on {readiness!.quiz_count} topics</CardDescription>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="relative w-40 h-40 mx-auto">
                    <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${getScoreGradient(readiness!.overall_score)} opacity-20 blur-xl`} />
                    <svg className="w-full h-full relative z-10" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/10" />
                      <circle cx="50" cy="50" r="45" fill="none" stroke={readiness!.overall_score >= 60 ? '#22c55e' : '#f59e0b'} strokeWidth="6" strokeDasharray={`${(readiness!.overall_score / 100) * 283} 283`} strokeLinecap="round" transform="rotate(-90 50 50)" className="transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold">{readiness!.overall_score}%</span>
                      <span className={`text-sm font-medium ${getScoreColor(readiness!.overall_score)}`}>{readiness!.overall_score >= 60 ? 'Good' : 'Needs Work'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
                    <div className="text-center">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2"><Target className="w-5 h-5 text-primary" /></div>
                      <p className="text-xl font-bold">{readiness!.quiz_count}</p>
                      <p className="text-xs text-muted-foreground">Topics</p>
                    </div>
                    <div className="text-center">
                      <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-2"><BookOpen className="w-5 h-5 text-purple-500" /></div>
                      <p className="text-xl font-bold">{readiness!.subjects.length}</p>
                      <p className="text-xs text-muted-foreground">Subjects</p>
                    </div>
                    <div className="text-center">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-2"><Clock className="w-5 h-5 text-green-500" /></div>
                      <p className="text-xl font-bold">{Math.round(readiness!.total_study_time_minutes / 60)}h</p>
                      <p className="text-xs text-muted-foreground">Studied</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Subject Chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Subject Performance</CardTitle>
                  <CardDescription>Your mastery level across subjects</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={readiness!.subjects} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="subject" width={110} tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} formatter={(value: number) => [`${value}%`, 'Score']} />
                        <Bar dataKey="average" radius={[0, 8, 8, 0]} animationDuration={1000}>
                          {readiness!.subjects.map((entry, index) => (<Cell key={index} fill={SUBJECT_COLORS[entry.subject] || '#3b82f6'} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Strong Areas */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="h-full border-green-500/20">
                <CardHeader className="bg-green-500/5"><CardTitle className="flex items-center gap-2 text-green-700"><CheckCircle className="w-5 h-5" />Strong Areas</CardTitle></CardHeader>
                <CardContent className="pt-4">
                  {readiness!.strong_areas.length > 0 ? (
                    <div className="space-y-3">
                      {readiness!.strong_areas.map(area => {
                        const subjectData = readiness!.subjects.find(s => s.subject === area);
                        return (<div key={area} className="flex items-center justify-between p-3 rounded-xl bg-green-500/5"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center"><CheckCircle className="w-4 h-4 text-green-600" /></div><span className="font-medium">{area}</span></div><Badge className="bg-green-500/20 text-green-700">{subjectData?.average || 0}%</Badge></div>);
                      })}
                    </div>
                  ) : (<div className="text-center py-8 text-muted-foreground"><Zap className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Keep practicing!</p></div>)}
                </CardContent>
              </Card>
            </motion.div>

            {/* Areas to Improve */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="lg:col-span-2">
              <Card className="h-full border-yellow-500/20">
                <CardHeader className="bg-yellow-500/5"><CardTitle className="flex items-center gap-2 text-yellow-700"><AlertTriangle className="w-5 h-5" />Areas to Improve</CardTitle></CardHeader>
                <CardContent className="pt-4">
                  {readiness!.weak_areas.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {readiness!.weak_areas.map(area => {
                        const subjectData = readiness!.subjects.find(s => s.subject === area);
                        const progress = subjectData?.average || 0;
                        return (<div key={area} className="p-4 rounded-xl bg-yellow-500/5 space-y-2"><div className="flex items-center justify-between"><span className="font-medium">{area}</span><span className="text-sm text-muted-foreground">{progress}%</span></div><Progress value={progress} className="h-2" /></div>);
                      })}
                    </div>
                  ) : (<div className="text-center py-8 text-muted-foreground"><Award className="w-12 h-12 mx-auto mb-3 opacity-50" /><p className="font-medium">All subjects doing well!</p></div>)}
                </CardContent>
              </Card>
            </motion.div>

            {/* Recommendations */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="lg:col-span-3">
              <Card className="bg-gradient-to-r from-primary/5 to-purple-500/5 border-primary/10">
                <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="w-5 h-5 text-primary" />Personalized Recommendations</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {readiness!.recommendations.map((rec, i) => (<motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.1 }} className="flex items-start gap-3 p-4 rounded-xl bg-background/50"><div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><span className="text-primary font-bold">{i + 1}</span></div><p className="text-sm leading-relaxed">{rec}</p></motion.div>))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}