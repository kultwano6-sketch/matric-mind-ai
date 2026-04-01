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
