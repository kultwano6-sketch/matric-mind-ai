// ============================================================
// Matric Mind AI - Progress Tracker Service
// Client-side service for progress tracking and trend analysis
// ============================================================

import { supabase } from '@/integrations/supabase/client';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================
// Types
// ============================================================

export interface ProgressSnapshot {
  id: string;
  student_id: string;
  subject: string;
  overall_score: number;
  topic_scores: Record<string, number>;
  quiz_count: number;
  study_hours: number;
  snapshot_date: string;
}

export interface TrendData {
  date: string;
  score: number;
  hours: number;
  quizzes: number;
}

export interface SnapshotHistoryResponse {
  success: boolean;
  snapshots: ProgressSnapshot[];
  count: number;
}

export interface CreateSnapshotResponse {
  success: boolean;
  snapshots: ProgressSnapshot[];
  ai_insights: string;
  error?: string;
}

// ============================================================
// API Functions
// ============================================================

/**
 * Create a new progress snapshot
 */
export async function createSnapshot(
  studentId: string,
  subject?: string
): Promise<CreateSnapshotResponse> {
  const response = await fetch(`${API_BASE}/api/progress-snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_id: studentId,
      subject,
      action: 'create',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create snapshot');
  }

  return response.json();
}

/**
 * Get snapshot history for a student
 */
export async function getSnapshotHistory(
  studentId: string,
  subject?: string,
  days: number = 30
): Promise<ProgressSnapshot[]> {
  const response = await fetch(`${API_BASE}/api/progress-snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_id: studentId,
      subject,
      action: 'history',
      days,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to get snapshot history');
  }

  const data: SnapshotHistoryResponse = await response.json();
  return data.snapshots || [];
}

/**
 * Get progress trend data for charting
 */
export async function getProgressTrend(
  studentId: string,
  subject?: string,
  days: number = 30
): Promise<TrendData[]> {
  const snapshots = await getSnapshotHistory(studentId, subject, days);

  return snapshots.map(snap => ({
    date: snap.snapshot_date,
    score: snap.overall_score,
    hours: snap.study_hours,
    quizzes: snap.quiz_count,
  }));
}

/**
 * Get improvement rate between two periods
 */
export async function getImprovementRate(
  studentId: string,
  subject?: string
): Promise<{
  current_avg: number;
  previous_avg: number;
  improvement_pct: number;
  trend: 'up' | 'down' | 'stable';
  period_days: number;
}> {
  const currentSnapshots = await getSnapshotHistory(studentId, subject, 7);
  const previousSnapshots = await getSnapshotHistory(studentId, subject, 14);

  // Filter previous to only include dates 7-14 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const oldSnapshots = previousSnapshots.filter(s => {
    const date = new Date(s.snapshot_date);
    return date < sevenDaysAgo && date >= fourteenDaysAgo;
  });

  const currentAvg = currentSnapshots.length > 0
    ? Math.round(currentSnapshots.reduce((sum, s) => sum + s.overall_score, 0) / currentSnapshots.length)
    : 0;

  const previousAvg = oldSnapshots.length > 0
    ? Math.round(oldSnapshots.reduce((sum, s) => sum + s.overall_score, 0) / oldSnapshots.length)
    : 0;

  const improvementPct = previousAvg > 0
    ? Math.round(((currentAvg - previousAvg) / previousAvg) * 100)
    : 0;

  let trend: 'up' | 'down' | 'stable';
  if (improvementPct > 5) trend = 'up';
  else if (improvementPct < -5) trend = 'down';
  else trend = 'stable';

  return {
    current_avg: currentAvg,
    previous_avg: previousAvg,
    improvement_pct: improvementPct,
    trend,
    period_days: 7,
  };
}

// ============================================================
// Formatting Helpers
// ============================================================

/**
 * Format snapshots for Recharts display
 */
export function formatTrendData(snapshots: ProgressSnapshot[]): TrendData[] {
  // Sort by date
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  );

  return sorted.map(snap => ({
    date: formatDateForChart(snap.snapshot_date),
    score: snap.overall_score,
    hours: snap.study_hours,
    quizzes: snap.quiz_count,
  }));
}

/**
 * Format date for chart display (e.g., "Mon", "Tue" or "1 Apr", "2 Apr")
 */
function formatDateForChart(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff < 7) {
    return date.toLocaleDateString('en-ZA', { weekday: 'short' });
  }

  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

/**
 * Calculate topic mastery trend from snapshots
 */
export function calculateTopicMasteryTrend(
  snapshots: ProgressSnapshot[],
  topic: string
): TrendData[] {
  return snapshots.map(snap => ({
    date: snap.snapshot_date,
    score: snap.topic_scores[topic] || 0,
    hours: 0,
    quizzes: 0,
  }));
}

/**
 * Get overall statistics from snapshots
 */
export function getOverallStats(snapshots: ProgressSnapshot[]): {
  avg_score: number;
  total_hours: number;
  total_quizzes: number;
  highest_score: number;
  lowest_score: number;
  days_studied: number;
} {
  if (snapshots.length === 0) {
    return { avg_score: 0, total_hours: 0, total_quizzes: 0, highest_score: 0, lowest_score: 0, days_studied: 0 };
  }

  const scores = snapshots.map(s => s.overall_score);
  const uniqueDays = new Set(snapshots.map(s => s.snapshot_date)).size;

  return {
    avg_score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    total_hours: Math.round(snapshots.reduce((sum, s) => sum + s.study_hours, 0) * 10) / 10,
    total_quizzes: snapshots.reduce((sum, s) => sum + s.quiz_count, 0),
    highest_score: Math.max(...scores),
    lowest_score: Math.min(...scores),
    days_studied: uniqueDays,
  };
}

/**
 * Get improvement description text
 */
export function getImprovementDescription(improvementPct: number): {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
} {
  if (improvementPct > 20) {
    return {
      text: `Excellent improvement of ${improvementPct}%! Your hard work is really paying off.`,
      sentiment: 'positive',
    };
  }

  if (improvementPct > 5) {
    return {
      text: `Good progress with ${improvementPct}% improvement. Keep going!`,
      sentiment: 'positive',
    };
  }

  if (improvementPct > -5) {
    return {
      text: `Your scores are stable. Try focusing on your weaker topics to boost improvement.`,
      sentiment: 'neutral',
    };
  }

  if (improvementPct > -20) {
    return {
      text: `A slight dip of ${Math.abs(improvementPct)}%. Don't worry — review your recent mistakes and try again.`,
      sentiment: 'negative',
    };
  }

  return {
    text: `Your scores dropped by ${Math.abs(improvementPct)}%. Let's identify weak areas and create a focused study plan.`,
    sentiment: 'negative',
  };
}

/**
 * Compare two snapshots and return difference details
 */
export function compareSnapshots(
  current: ProgressSnapshot,
  previous: ProgressSnapshot | null
): {
  score_change: number;
  hours_change: number;
  quizzes_change: number;
  topics_improved: string[];
  topics_declined: string[];
} {
  if (!previous) {
    return {
      score_change: current.overall_score,
      hours_change: current.study_hours,
      quizzes_change: current.quiz_count,
      topics_improved: Object.keys(current.topic_scores),
      topics_declined: [],
    };
  }

  const topicsImproved: string[] = [];
  const topicsDeclined: string[] = [];

  const allTopics = new Set([
    ...Object.keys(current.topic_scores),
    ...Object.keys(previous.topic_scores),
  ]);

  for (const topic of allTopics) {
    const currentScore = current.topic_scores[topic] || 0;
    const previousScore = previous.topic_scores[topic] || 0;

    if (currentScore > previousScore + 5) topicsImproved.push(topic);
    else if (currentScore < previousScore - 5) topicsDeclined.push(topic);
  }

  return {
    score_change: Math.round(current.overall_score - previous.overall_score),
    hours_change: Math.round((current.study_hours - previous.study_hours) * 10) / 10,
    quizzes_change: current.quiz_count - previous.quiz_count,
    topics_improved: topicsImproved,
    topics_declined: topicsDeclined,
  };
}
