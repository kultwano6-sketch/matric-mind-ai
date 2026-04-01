// ============================================================
// Matric Mind AI - Progress Tracker Page
// Advanced progress tracking with trends and insights
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  TrendingUp, TrendingDown, Minus, Clock, BookOpen, Brain,
  Camera, RefreshCw, BarChart3, Target, Sparkles,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import ProgressChart from '@/components/ProgressChart';
import TopicMasteryGrid from '@/components/TopicMasteryGrid';
import { useAuth } from '@/hooks/useAuth';
import { ALL_SUBJECTS, SUBJECT_LABELS } from '@/lib/subjects';
import {
  createSnapshot,
  getSnapshotHistory,
  getProgressTrend,
  getImprovementRate,
  formatTrendData,
  getOverallStats,
  getImprovementDescription,
  type ProgressSnapshot,
  type TrendData,
} from '@/services/progressTracker';

export default function ProgressTrackerPage() {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [dateRange, setDateRange] = useState('30');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [snapshots, setSnapshots] = useState<ProgressSnapshot[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [improvement, setImprovement] = useState<{
    current_avg: number;
    previous_avg: number;
    improvement_pct: number;
    trend: 'up' | 'down' | 'stable';
  } | null>(null);
  const [aiInsights, setAiInsights] = useState('');

  // Load data
  const loadData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const [history, trend, imp] = await Promise.all([
        getSnapshotHistory(user.id, subject || undefined, parseInt(dateRange)),
        getProgressTrend(user.id, subject || undefined, parseInt(dateRange)),
        getImprovementRate(user.id, subject || undefined),
      ]);

      setSnapshots(history);
      setTrendData(formatTrendData(history));
      setImprovement(imp);
    } catch (error) {
      console.error('Failed to load progress data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, subject, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create new snapshot
  const handleCreateSnapshot = async () => {
    if (!user?.id) return;

    setCreating(true);
    try {
      const result = await createSnapshot(user.id, subject || undefined);
      setAiInsights(result.ai_insights);
      await loadData();
    } catch (error) {
      console.error('Failed to create snapshot:', error);
    } finally {
      setCreating(false);
    }
  };

  // Calculate overall stats
  const stats = getOverallStats(snapshots);
  const improvementInfo = improvement
    ? getImprovementDescription(improvement.improvement_pct)
    : null;

  // Get latest topic scores for mastery grid
  const latestSnapshot = snapshots[snapshots.length - 1];
  const topicMastery = latestSnapshot
    ? Object.entries(latestSnapshot.topic_scores).map(([topic, pct]) => ({
        topic,
        mastery_pct: pct,
        status: pct >= 70 ? 'mastered' as const : pct >= 40 ? 'learning' as const : 'struggling' as const,
      }))
    : [];

  // Trend icon
  const TrendIcon = improvement?.trend === 'up' ? TrendingUp
    : improvement?.trend === 'down' ? TrendingDown
    : Minus;

  const trendColor = improvement?.trend === 'up' ? 'text-green-600'
    : improvement?.trend === 'down' ? 'text-red-600'
    : 'text-gray-600';

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Progress Tracker</h1>
            <p className="text-muted-foreground mt-1">
              Track your study progress and identify areas for improvement
            </p>
          </div>
          <Button onClick={handleCreateSnapshot} disabled={creating}>
            {creating ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Take Snapshot
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {ALL_SUBJECTS.map(s => (
                <SelectItem key={s} value={s}>
                  {SUBJECT_LABELS[s as keyof typeof SUBJECT_LABELS] || s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">All time</SelectItem>
            </SelectContent>
          </Select>

          {loading && (
            <div className="flex items-center text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Loading...
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Overall Score</p>
                    <p className="text-2xl font-bold">{stats.avg_score}%</p>
                  </div>
                  <div className={`flex items-center gap-1 ${trendColor}`}>
                    <TrendIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {improvement?.improvement_pct ?? 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Study Hours</p>
                    <p className="text-2xl font-bold">{stats.total_hours}h</p>
                  </div>
                  <Clock className="w-8 h-8 text-blue-500/20" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Quizzes</p>
                    <p className="text-2xl font-bold">{stats.total_quizzes}</p>
                  </div>
                  <BookOpen className="w-8 h-8 text-purple-500/20" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Best Score</p>
                    <p className="text-2xl font-bold">{stats.highest_score}%</p>
                  </div>
                  <Target className="w-8 h-8 text-green-500/20" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <Card className="glass-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" /> Score Trend
              </CardTitle>
              <CardDescription>
                Your performance over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProgressChart
                data={trendData}
                type="combined"
                height={300}
                showLegend
              />
            </CardContent>
          </Card>

          {/* Insights */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" /> AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiInsights ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-muted-foreground leading-relaxed"
                >
                  {aiInsights}
                </motion.div>
              ) : improvementInfo ? (
                <div className="space-y-3">
                  <div className={`p-3 rounded-lg ${
                    improvementInfo.sentiment === 'positive'
                      ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300'
                      : improvementInfo.sentiment === 'negative'
                      ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                      : 'bg-gray-50 dark:bg-gray-900/30'
                  }`}>
                    <p className="text-sm">{improvementInfo.text}</p>
                  </div>

                  {stats.highest_score > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium mb-1">Highlights:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Highest score: {stats.highest_score}%</li>
                        <li>Studied {stats.days_studied} days</li>
                        <li>{stats.total_quizzes} quizzes completed</li>
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Take a snapshot to see your progress insights!
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Topic Mastery */}
        {topicMastery.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" /> Topic Mastery
              </CardTitle>
              <CardDescription>
                Your understanding of individual topics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TopicMasteryGrid topics={topicMastery} />
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {snapshots.length === 0 && !loading && (
          <Card className="glass-card">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">No progress data yet</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-md">
                Take your first progress snapshot to start tracking your improvement.
                The system will analyse your quiz results, study sessions, and weaknesses.
              </p>
              <Button onClick={handleCreateSnapshot} disabled={creating}>
                <Sparkles className="w-4 h-4 mr-2" />
                Take Your First Snapshot
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
