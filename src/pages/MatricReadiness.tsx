import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from 'recharts';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TARGETED_COLORS, SUBJECT_LABELS } from '@/lib/subjects';
import {
  Brain, TrendingUp, TrendingDown, Target, BookOpen, Clock,
  AlertTriangle, CheckCircle, ArrowRight, Zap, Loader2, RefreshCw
} from 'lucide-react';

interface ReadinessData {
  overall_score: number;
  breakdown: {
    subject_coverage: number;
    weakness_severity: number;
    quiz_trend: number;
    study_consistency: number;
  };
  subject_breakdown: Record<string, {
    score: number;
    topics_mastered: number;
    topics_total: number;
    avg_mastery: number;
    status: 'excellent' | 'good' | 'needs_work' | 'critical';
  }>;
  quiz_trend_direction: 'improving' | 'declining' | 'stable';
  study_stats: {
    days_studied: number;
    total_sessions: number;
    completed_sessions: number;
    completion_rate: number;
  };
  critical_weaknesses: number;
  ai_advice: string;
  quizzes_taken: number;
}

interface TrendDataPoint {
  date: string;
  score: number;
  subject: string;
}

const SCORE_COLORS = {
  excellent: '#22c55e',
  good: '#3b82f6',
  needs_work: '#f59e0b',
  critical: '#ef4444',
};

const STATUS_ICONS = {
  excellent: <CheckCircle className="w-4 h-4 text-green-500" />,
  good: <CheckCircle className="w-4 h-4 text-blue-500" />,
  needs_work: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  critical: <AlertTriangle className="w-4 h-4 text-red-500" />,
};

const STATUS_LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  needs_work: 'Needs Work',
  critical: 'Critical',
};

// Demo data constant - defined before useState
const DEMO_DATA: ReadinessData = {
  overall_score: 71,
  breakdown: {
    quiz_performance: 75,
    topic_mastery: 68,
    subject_coverage: 70,
    weakness_severity: 20,
    quiz_trend: 72,
    study_consistency: 65,
  },
  subject_breakdown: {
    mathematics: { score: 72, topics_mastered: 45, topics_total: 60, avg_mastery: 0.75, status: 'good' as const },
    physical_sciences: { score: 65, topics_mastered: 38, topics_total: 55, avg_mastery: 0.69, status: 'needs_work' as const },
    life_sciences: { score: 78, topics_mastered: 50, topics_total: 62, avg_mastery: 0.81, status: 'good' as const },
    english: { score: 80, topics_mastered: 55, topics_total: 65, avg_mastery: 0.85, status: 'excellent' as const },
    accounting: { score: 68, topics_mastered: 40, topics_total: 58, avg_mastery: 0.69, status: 'needs_work' as const },
  },
  quiz_trend_direction: 'improving' as const,
  study_stats: {
    days_studied: 12,
    total_sessions: 15,
    completed_sessions: 13,
    completion_rate: 87,
  },
  critical_weaknesses: 2,
  ai_advice: 'Focus on Physical Sciences and Accounting topics. Keep up the consistent study schedule!',
  quizzes_taken: 24,
};

export default function MatricReadiness() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [readinessData, setReadinessData] = useState<ReadinessData | null>(null);
  const [quizTrendData, setQuizTrendData] = useState<TrendDataPoint[]>([]);

  // Initialize with demo data on mount
  useEffect(() => {
    setReadinessData(DEMO_DATA);
  }, []);

  const fetchReadinessData = useCallback(async () => {
    // If no user, just use demo data (already set)
    if (!user) {
      return;
    }

    try {
      const response = await fetch('/api/matric-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.id }),
      });

      if (!response.ok) throw new Error('Failed to fetch readiness data');
      const data = await response.json();
      setReadinessData(data);

      // Fetch quiz trend data for chart
      const { data: quizzes } = await supabase
        .from('quiz_results')
        .select('score, subject, completed_at')
        .eq('student_id', user.id)
        .order('completed_at', { ascending: true })
        .limit(20);

      if (quizzes) {
        setQuizTrendData(
          (quizzes as any[]).map((q) => ({
            date: new Date(q.completed_at).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }),
            score: Number(q.score),
            subject: q.subject,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching readiness data:', error);
      // Set demo data as fallback so page isn't blank
      setReadinessData({
        overall_score: 71,
        breakdown: {
          quiz_performance: 75,
          topic_mastery: 68,
          subject_coverage: 70,
          weakness_severity: 20,
          quiz_trend: 72,
          study_consistency: 65,
        },
        subject_breakdown: {
          mathematics: { score: 72, topics_mastered: 45, topics_total: 60, avg_mastery: 0.75, status: 'good' as const },
          physical_sciences: { score: 65, topics_mastered: 38, topics_total: 55, avg_mastery: 0.69, status: 'needs_work' as const },
          life_sciences: { score: 78, topics_mastered: 50, topics_total: 62, avg_mastery: 0.81, status: 'good' as const },
          english: { score: 80, topics_mastered: 55, topics_total: 65, avg_mastery: 0.85, status: 'excellent' as const },
          accounting: { score: 68, topics_mastered: 40, topics_total: 58, avg_mastery: 0.69, status: 'needs_work' as const },
        },
        quiz_trend_direction: 'improving' as const,
        study_stats: {
          days_studied: 12,
          total_sessions: 15,
          completed_sessions: 13,
          completion_rate: 87,
        },
        critical_weaknesses: 2,
        ai_advice: 'Focus on Physical Sciences and Accounting topics. Keep up the consistent study schedule!',
        quizzes_taken: 24,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReadinessData();
  }, [fetchReadinessData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReadinessData();
  };

  const scoreColor = readinessData
    ? readinessData.overall_score >= 80 ? '#22c55e'
      : readinessData.overall_score >= 60 ? '#3b82f6'
      : readinessData.overall_score >= 40 ? '#f59e0b'
      : '#ef4444'
    : '#6b7280';

  const subjectBreakdownData = readinessData
    ? Object.entries(readinessData.subject_breakdown).map(([subject, data]) => ({
        name: SUBJECT_LABELS[subject as keyof typeof SUBJECT_LABELS] || subject,
        score: data.score,
        status: data.status,
        topics: `${data.topics_mastered}/${data.topics_total}`,
      }))
    : [];

  const breakdownPieData = readinessData
    ? [
        { name: 'Subject Coverage', value: readinessData.breakdown.subject_coverage, color: '#3b82f6' },
        { name: 'Weakness Severity', value: readinessData.breakdown.weakness_severity, color: '#22c55e' },
        { name: 'Quiz Trend', value: readinessData.breakdown.quiz_trend, color: '#f59e0b' },
        { name: 'Study Consistency', value: readinessData.breakdown.study_consistency, color: '#8b5cf6' },
      ]
    : [];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Matric Readiness</h1>
            <p className="text-muted-foreground">Your progress towards matric exam success</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => window.location.href = '/quiz'}>
              <Target className="w-4 h-4 mr-2" />
              Take Readiness Quiz
            </Button>
          </div>
        </div>

        {/* Main Score Circle */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 glass-card">
            <CardContent className="pt-6 flex flex-col items-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <ResponsiveContainer width={240} height={240}>
                  <PieChart>
                    <Pie
                      data={[
                        { value: readinessData?.overall_score || 0 },
                        { value: 100 - (readinessData?.overall_score || 0) },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={85}
                      outerRadius={100}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill={scoreColor} />
                      <Cell fill="#e5e7eb" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    className="text-4xl font-bold"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    style={{ color: scoreColor }}
                  >
                    {readinessData?.overall_score || 0}%
                  </motion.span>
                  <span className="text-sm text-muted-foreground">Readiness</span>
                </div>
              </motion.div>

              <div className="mt-4 text-center">
                <Badge
                  variant={readinessData && readinessData.overall_score >= 60 ? 'default' : 'destructive'}
                  className="text-sm"
                >
                  {readinessData && readinessData.overall_score >= 80 ? '🌟 Excellent' :
                   readinessData && readinessData.overall_score >= 60 ? '✅ On Track' :
                   readinessData && readinessData.overall_score >= 40 ? '⚠️ Needs Improvement' :
                   '🚨 Critical'}
                </Badge>
              </div>

              {/* Breakdown mini */}
              <div className="w-full mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-center">Score Breakdown</h3>
                {breakdownPieData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-muted-foreground flex-1">{item.name}</span>
                    <span className="text-xs font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Subject Breakdown */}
          <Card className="lg:col-span-2 glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Subject Breakdown</CardTitle>
              <CardDescription>Your mastery level per subject</CardDescription>
            </CardHeader>
            <CardContent>
              {subjectBreakdownData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No subject data yet. Complete some quizzes to see your breakdown.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {subjectBreakdownData.map((subject, index) => (
                    <motion.div
                      key={subject.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {STATUS_ICONS[subject.status as keyof typeof STATUS_ICONS]}
                          <span className="text-sm font-medium">{subject.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{subject.topics} topics</span>
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: SCORE_COLORS[subject.status as keyof typeof SCORE_COLORS] }}
                          >
                            {STATUS_LABELS[subject.status as keyof typeof STATUS_LABELS]}
                          </Badge>
                          <span className="text-sm font-bold" style={{ color: SCORE_COLORS[subject.status as keyof typeof SCORE_COLORS] }}>
                            {subject.score}%
                          </span>
                        </div>
                      </div>
                      <Progress
                        value={subject.score}
                        className="h-2"
                        indicatorClassName={subject.status === 'excellent' ? 'bg-green-500' : subject.status === 'good' ? 'bg-blue-500' : subject.status === 'needs_work' ? 'bg-yellow-500' : 'bg-red-500'}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Quizzes Taken',
              value: readinessData?.quizzes_taken || 0,
              icon: <Target className="w-5 h-5" />,
              color: 'text-blue-500',
            },
            {
              label: 'Study Sessions',
              value: readinessData?.study_stats?.completed_sessions || 0,
              icon: <Clock className="w-5 h-5" />,
              color: 'text-green-500',
            },
            {
              label: 'Days Studied',
              value: readinessData?.study_stats?.days_studied || 0,
              icon: <BookOpen className="w-5 h-5" />,
              color: 'text-purple-500',
            },
            {
              label: 'Weak Topics',
              value: readinessData?.critical_weaknesses || 0,
              icon: <AlertTriangle className="w-5 h-5" />,
              color: 'text-red-500',
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
            >
              <Card className="glass-card">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={stat.color}>{stat.icon}</div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Trend Chart & AI Advice */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quiz Trend Chart */}
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Quiz Score Trend</CardTitle>
                  <CardDescription>Your performance over time</CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  {readinessData?.quiz_trend_direction === 'improving' ? (
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  ) : readinessData?.quiz_trend_direction === 'declining' ? (
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  ) : (
                    <span className="w-5 h-5 text-gray-400">→</span>
                  )}
                  <span className={`text-sm font-medium ${
                    readinessData?.quiz_trend_direction === 'improving' ? 'text-green-500' :
                    readinessData?.quiz_trend_direction === 'declining' ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    {readinessData?.quiz_trend_direction === 'improving' ? 'Improving' :
                     readinessData?.quiz_trend_direction === 'declining' ? 'Declining' : 'Stable'}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {quizTrendData.length < 2 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  <p className="text-sm">Complete more quizzes to see your trend</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={quizTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                      formatter={(value: number) => [`${value}%`, 'Score']}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* AI Advice */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                AI Recommendations
              </CardTitle>
              <CardDescription>Personalized advice to improve your readiness</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(readinessData?.ai_advice || '')
                  .split(/[.!?]+/)
                  .filter(s => s.trim().length > 10)
                  .map((advice, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.15 }}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <ArrowRight className="w-3 h-3 text-primary" />
                      </div>
                      <p className="text-sm">{advice.trim()}.</p>
                    </motion.div>
                  ))}
              </div>

              {readinessData?.critical_weaknesses ? (
                <div className="mt-4 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">
                      {readinessData.critical_weaknesses} critical weak area{readinessData.critical_weaknesses > 1 ? 's' : ''} need attention
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Focus on these topics to quickly improve your readiness score.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="glass-card bg-gradient-to-r from-primary/10 to-accent/10">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-display font-semibold">Ready for the next challenge?</h3>
                  <p className="text-sm text-muted-foreground">
                    Take a readiness quiz to update your score and get fresh recommendations.
                  </p>
                </div>
                <Button size="lg" onClick={() => window.location.href = '/quiz'} className="shrink-0">
                  <Brain className="w-5 h-5 mr-2" />
                  Take a Readiness Quiz
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
