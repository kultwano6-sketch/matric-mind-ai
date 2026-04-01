// ============================================================
// Matric Mind AI - Analytics Service
// Client-side service for predictive analytics, performance
// trends, and study efficiency metrics
// ============================================================

import { supabase } from '@/integrations/supabase/client';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================
// Types
// ============================================================

export interface PredictiveAnalytics {
  predicted_exam_score: number;
  confidence_level: number;
  improvement_trajectory: 'improving' | 'stable' | 'declining';
  predicted_pass_rate: number;
  ai_insights: string;
  score_range: { low: number; high: number };
  recommended_actions: string[];
}

export interface PerformanceTrend {
  period: string;
  average_score: number;
  quiz_count: number;
  trend_direction: 'up' | 'down' | 'stable';
  trend_percentage: number;
}

export interface TopicMastery {
  topic: string;
  mastery_pct: number;
  error_count: number;
  total_attempts: number;
  last_practiced: string | null;
  status: 'mastered' | 'learning' | 'struggling';
}

export interface StudyEfficiency {
  total_hours: number;
  avg_score_per_hour: number;
  most_productive_time: string;
  best_subject: string;
  efficiency_score: number;
  focus_sessions: number;
  average_focus_score: number;
}

export interface StudyStreak {
  current_streak: number;
  longest_streak: number;
  last_activity: string | null;
  streak_history: Array<{ date: string; active: boolean }>;
}

export interface FormattedAnalytics {
  overall_grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  summary: string;
  top_strengths: string[];
  top_weaknesses: string[];
  next_milestones: string[];
  predicted_score_label: string;
}

// ============================================================
// API Functions
// ============================================================

/**
 * Get predictive exam analytics for a student and subject
 */
export async function getPredictiveAnalytics(
  studentId: string,
  subject: string
): Promise<PredictiveAnalytics> {
  const response = await fetch(`${API_BASE}/api/predictive-analytics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: studentId, subject }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to get predictive analytics');
  }

  const data = await response.json();
  return {
    predicted_exam_score: data.predicted_exam_score,
    confidence_level: data.confidence_level,
    improvement_trajectory: data.improvement_trajectory,
    predicted_pass_rate: data.predicted_pass_rate,
    ai_insights: data.ai_insights,
    score_range: data.score_range,
    recommended_actions: data.recommended_actions || [],
  };
}

/**
 * Get performance trend over a specific period
 */
export async function getPerformanceTrend(
  studentId: string,
  subject: string,
  period: 'week' | 'month' | 'quarter' = 'month'
): Promise<PerformanceTrend> {
  // Calculate date range
  const now = new Date();
  const startDate = new Date();
  switch (period) {
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(now.getMonth() - 3);
      break;
  }

  // Fetch quiz results for the period
  const { data: quizzes } = await supabase
    .from('quiz_results')
    .select('score, completed_at')
    .eq('student_id', studentId)
    .eq('subject', subject)
    .gte('completed_at', startDate.toISOString())
    .order('completed_at', { ascending: true });

  const scores = (quizzes || []).map(q => Number(q.score));

  if (scores.length === 0) {
    return {
      period,
      average_score: 0,
      quiz_count: 0,
      trend_direction: 'stable',
      trend_percentage: 0,
    };
  }

  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  // Calculate trend
  let trendDirection: 'up' | 'down' | 'stable' = 'stable';
  let trendPercentage = 0;

  if (scores.length >= 4) {
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    trendPercentage = Math.round(secondAvg - firstAvg);

    if (trendPercentage > 5) trendDirection = 'up';
    else if (trendPercentage < -5) trendDirection = 'down';
  }

  return {
    period,
    average_score: avgScore,
    quiz_count: scores.length,
    trend_direction: trendDirection,
    trend_percentage: trendPercentage,
  };
}

/**
 * Get topic mastery breakdown for a subject
 */
export async function getTopicMastery(
  studentId: string,
  subject: string
): Promise<TopicMastery[]> {
  const { data: weaknesses } = await supabase
    .from('student_weaknesses')
    .select('*')
    .eq('student_id', studentId)
    .eq('subject', subject)
    .order('mastery_pct', { ascending: false });

  return (weaknesses || []).map(w => {
    const mastery = Number(w.mastery_pct);
    let status: 'mastered' | 'learning' | 'struggling';
    if (mastery >= 70) status = 'mastered';
    else if (mastery >= 40) status = 'learning';
    else status = 'struggling';

    return {
      topic: w.topic,
      mastery_pct: mastery,
      error_count: w.error_count || 0,
      total_attempts: w.total_attempts || 0,
      last_practiced: w.last_error_at || null,
      status,
    };
  });
}

/**
 * Calculate study efficiency metrics
 */
export async function getStudyEfficiency(
  studentId: string,
  period: 'week' | 'month' = 'month'
): Promise<StudyEfficiency> {
  const now = new Date();
  const startDate = new Date();
  startDate.setMonth(now.getMonth() - (period === 'month' ? 1 : 0));
  if (period === 'week') {
    startDate.setDate(now.getDate() - 7);
  }

  // Fetch study sessions
  const { data: sessions } = await supabase
    .from('study_sessions')
    .select('subject, duration_sec, focus_score, started_at')
    .eq('student_id', studentId)
    .gte('started_at', startDate.toISOString())
    .not('ended_at', 'is', null);

  // Fetch quiz results for the same period
  const { data: quizzes } = await supabase
    .from('quiz_results')
    .select('subject, score, completed_at')
    .eq('student_id', studentId)
    .gte('completed_at', startDate.toISOString());

  const totalSeconds = (sessions || []).reduce(
    (sum: number, s: any) => sum + (s.duration_sec || 0), 0
  );
  const totalHours = Math.round(totalSeconds / 3600 * 10) / 10;

  const avgScore = (quizzes || []).length > 0
    ? quizzes.reduce((sum: number, q: any) => sum + Number(q.score), 0) / quizzes.length
    : 0;

  const scorePerHour = totalHours > 0 ? Math.round(avgScore / totalHours * 10) / 10 : 0;

  // Most productive time of day
  const hourCounts: Record<string, number> = {};
  for (const s of (sessions || [])) {
    const hour = new Date(s.started_at).getHours();
    let timeBlock: string;
    if (hour < 6) timeBlock = 'Night (00:00-06:00)';
    else if (hour < 12) timeBlock = 'Morning (06:00-12:00)';
    else if (hour < 17) timeBlock = 'Afternoon (12:00-17:00)';
    else timeBlock = 'Evening (17:00-00:00)';
    hourCounts[timeBlock] = (hourCounts[timeBlock] || 0) + (s.duration_sec || 0);
  }
  const mostProductiveTime = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'No data';

  // Best subject
  const subjectScores: Record<string, number[]> = {};
  for (const q of (quizzes || [])) {
    const subject = q.subject;
    if (!subjectScores[subject]) subjectScores[subject] = [];
    subjectScores[subject].push(Number(q.score));
  }
  const bestSubject = Object.entries(subjectScores)
    .map(([subject, scores]) => ({
      subject,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))
    .sort((a, b) => b.avg - a.avg)[0]?.subject || 'No data';

  // Focus scores
  const focusScores = (sessions || [])
    .filter((s: any) => s.focus_score != null)
    .map((s: any) => Number(s.focus_score));
  const avgFocus = focusScores.length > 0
    ? Math.round(focusScores.reduce((a, b) => a + b, 0) / focusScores.length)
    : 0;

  // Efficiency score (0-100)
  let efficiencyScore = 50;
  if (totalHours > 5) efficiencyScore += 10;
  if (totalHours > 15) efficiencyScore += 10;
  if (avgScore > 60) efficiencyScore += 10;
  if (avgFocus > 70) efficiencyScore += 10;
  if ((sessions || []).length > 10) efficiencyScore += 10;
  efficiencyScore = Math.min(100, efficiencyScore);

  return {
    total_hours: totalHours,
    avg_score_per_hour: scorePerHour,
    most_productive_time: mostProductiveTime,
    best_subject: bestSubject,
    efficiency_score: efficiencyScore,
    focus_sessions: (sessions || []).length,
    average_focus_score: avgFocus,
  };
}

/**
 * Calculate study streak data
 */
export async function calculateStudyStreak(studentId: string): Promise<StudyStreak> {
  // Fetch gamification state for current streak
  const { data: gamification } = await supabase
    .from('gamification_state')
    .select('streak_days, last_activity')
    .eq('user_id', studentId)
    .single();

  // Fetch activity log for streak history
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: activities } = await supabase
    .from('activity_log')
    .select('created_at')
    .eq('user_id', studentId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  // Build daily activity map
  const activeDays = new Set(
    (activities || []).map((a: any) => a.created_at.split('T')[0])
  );

  const streakHistory: Array<{ date: string; active: boolean }> = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    streakHistory.push({
      date: dateStr,
      active: activeDays.has(dateStr),
    });
  }

  // Calculate longest streak from history
  let longestStreak = 0;
  let currentRun = 0;
  for (const day of streakHistory) {
    if (day.active) {
      currentRun++;
      longestStreak = Math.max(longestStreak, currentRun);
    } else {
      currentRun = 0;
    }
  }

  return {
    current_streak: gamification?.streak_days || 0,
    longest_streak: Math.max(longestStreak, gamification?.streak_days || 0),
    last_activity: gamification?.last_activity || null,
    streak_history: streakHistory,
  };
}

/**
 * Format analytics data for display
 */
export function formatAnalyticsForDisplay(data: PredictiveAnalytics): FormattedAnalytics {
  const score = data.predicted_exam_score;

  // Determine grade
  let grade: FormattedAnalytics['overall_grade'];
  if (score >= 80) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 50) grade = 'D';
  else if (score >= 40) grade = 'E';
  else grade = 'F';

  // Generate summary
  let summary = `Based on your performance data, you're predicted to score ${score}% (range: ${data.score_range.low}-${data.score_range.high}%). `;

  if (data.improvement_trajectory === 'improving') {
    summary += 'Your scores are trending upward — great progress!';
  } else if (data.improvement_trajectory === 'declining') {
    summary += 'Your scores have been declining. Let\'s turn this around!';
  } else {
    summary += 'Your performance is steady. Keep pushing for improvement!';
  }

  // Identify strengths and weaknesses from recommendations
  const topStrengths: string[] = [];
  const topWeaknesses: string[] = [];

  if (data.predicted_exam_score >= 70) topStrengths.push('Strong predicted performance');
  if (data.confidence_level >= 70) topStrengths.push('Consistent performance pattern');
  if (data.improvement_trajectory === 'improving') topStrengths.push('Positive learning trajectory');

  if (data.predicted_exam_score < 50) topWeaknesses.push('Predicted score below pass mark');
  if (data.confidence_level < 50) topWeaknesses.push('Inconsistent performance — needs stabilisation');
  if (data.improvement_trajectory === 'declining') topWeaknesses.push('Declining trend needs attention');

  // Next milestones
  const nextMilestones: string[] = [];
  if (score < 30) nextMilestones.push('Target: Reach 30% (pass mark)');
  if (score >= 30 && score < 50) nextMilestones.push('Target: Reach 50% for solid pass');
  if (score >= 50 && score < 60) nextMilestones.push('Target: Reach 60% for good pass');
  if (score >= 60 && score < 70) nextMilestones.push('Target: Reach 70% for distinction');
  if (score >= 70 && score < 80) nextMilestones.push('Target: Reach 80% for higher distinction');
  if (score >= 80) nextMilestones.push('Maintain excellence!');

  if (nextMilestones.length === 0) {
    nextMilestones.push('Keep practising to improve your score');
  }

  // Score label
  let predictedScoreLabel: string;
  if (score >= 80) predictedScoreLabel = 'Excellent';
  else if (score >= 70) predictedScoreLabel = 'Good';
  else if (score >= 60) predictedScoreLabel = 'Above Average';
  else if (score >= 50) predictedScoreLabel = 'Average';
  else if (score >= 40) predictedScoreLabel = 'Below Average';
  else predictedScoreLabel = 'Needs Improvement';

  return {
    overall_grade: grade,
    summary,
    top_strengths: topStrengths.length > 0 ? topStrengths : ['Keep building your skills'],
    top_weaknesses: topWeaknesses.length > 0 ? topWeaknesses : ['No major concerns identified'],
    next_milestones: nextMilestones,
    predicted_score_label: predictedScoreLabel,
  };
}

/**
 * Format time duration for display
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

/**
 * Get color for mastery percentage
 */
export function getMasteryColor(pct: number): string {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 60) return 'text-blue-600';
  if (pct >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Get status badge variant for mastery
 */
export function getMasteryVariant(pct: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (pct >= 70) return 'default';
  if (pct >= 40) return 'secondary';
  return 'destructive';
}
// ============================================================
// Matric Mind AI - Analytics Service Additions
// Additional methods to add to the existing analytics.ts
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import type { ProgressSnapshot, TrendData } from './progressTracker';

// ============================================================
// New Functions to Add to analytics.ts
// ============================================================

/**
 * Get progress snapshots from the new progress_snapshots table
 */
export async function getProgressSnapshots(
  studentId: string,
  subject?: string,
  days: number = 30
): Promise<ProgressSnapshot[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from('progress_snapshots')
    .select('*')
    .eq('student_id', studentId)
    .gte('snapshot_date', startDate.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true });

  if (subject) {
    query = query.eq('subject', subject);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((s: any) => ({
    id: s.id,
    student_id: s.student_id,
    subject: s.subject,
    overall_score: Number(s.overall_score),
    topic_scores: s.topic_scores_json || {},
    quiz_count: s.quiz_count,
    study_hours: Number(s.study_hours),
    snapshot_date: s.snapshot_date,
  }));
}

/**
 * Get topic mastery over time for trend charts
 */
export async function getTopicMasteryOverTime(
  studentId: string,
  subject: string,
  topic: string,
  days: number = 30
): Promise<Array<{ date: string; mastery_pct: number }>> {
  const snapshots = await getProgressSnapshots(studentId, subject, days);

  return snapshots.map(snap => ({
    date: snap.snapshot_date,
    mastery_pct: snap.topic_scores[topic] || 0,
  }));
}

/**
 * Get study efficiency trend over a period
 */
export async function getStudyEfficiencyTrend(
  studentId: string,
  period: 'week' | 'month' | 'quarter' = 'month'
): Promise<Array<{
  date: string;
  efficiency_score: number;
  hours_studied: number;
  avg_score: number;
}>> {
  const now = new Date();
  const daysMap = { week: 7, month: 30, quarter: 90 };
  const days = daysMap[period];

  // Get quiz results in the period
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: quizzes } = await supabase
    .from('quiz_results')
    .select('score, subject, completed_at')
    .eq('student_id', studentId)
    .gte('completed_at', startDate.toISOString())
    .order('completed_at', { ascending: true });

  // Get study sessions in the period
  const { data: sessions } = await supabase
    .from('study_sessions')
    .select('duration_sec, subject, started_at')
    .eq('student_id', studentId)
    .gte('started_at', startDate.toISOString())
    .order('started_at', { ascending: true });

  // Group by day
  const dailyData: Record<string, {
    hours: number;
    scores: number[];
  }> = {};

  for (const session of (sessions || [])) {
    const date = (session as any).started_at.split('T')[0];
    if (!dailyData[date]) dailyData[date] = { hours: 0, scores: [] };
    dailyData[date].hours += ((session as any).duration_sec || 0) / 3600;
  }

  for (const quiz of (quizzes || [])) {
    const date = (quiz as any).completed_at.split('T')[0];
    if (!dailyData[date]) dailyData[date] = { hours: 0, scores: [] };
    dailyData[date].scores.push(Number((quiz as any).score));
  }

  // Convert to trend data
  return Object.entries(dailyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => {
      const avgScore = data.scores.length > 0
        ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
        : 0;

      // Efficiency = how productive per hour
      const efficiencyScore = data.hours > 0
        ? Math.round((avgScore / data.hours) * 10) / 10
        : 0;

      return {
        date,
        efficiency_score: efficiencyScore,
        hours_studied: Math.round(data.hours * 10) / 10,
        avg_score: Math.round(avgScore),
      };
    });
}

/**
 * Get combined analytics dashboard data
 */
export async function getAnalyticsDashboard(
  studentId: string,
  subject?: string
): Promise<{
  snapshots: ProgressSnapshot[];
  currentMastery: Array<{ topic: string; mastery_pct: number }>;
  efficiencyTrend: Array<{ date: string; efficiency_score: number; hours_studied: number; avg_score: number }>;
}> {
  const [snapshots, efficiencyTrend] = await Promise.all([
    getProgressSnapshots(studentId, subject, 30),
    getStudyEfficiencyTrend(studentId, 'month'),
  ]);

  // Get current topic mastery
  const { data: weaknesses } = await supabase
    .from('student_weaknesses')
    .select('topic, mastery_pct')
    .eq('student_id', studentId)
    .eq('subject', subject || '')
    .order('mastery_pct', { ascending: true });

  const currentMastery = (weaknesses || []).map((w: any) => ({
    topic: w.topic,
    mastery_pct: Number(w.mastery_pct),
  }));

  return {
    snapshots,
    currentMastery,
    efficiencyTrend,
  };
}
