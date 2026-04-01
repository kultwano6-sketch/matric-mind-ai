// ============================================================
// Matric Mind AI - Progress Snapshot API
// Periodic progress snapshots for trend analysis
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const maxDuration = 30;
export const runtime = 'edge';

interface SnapshotRequest {
  student_id: string;
  subject?: string;
  action?: 'create' | 'history';
  days?: number;
}

interface ProgressSnapshot {
  id: string;
  student_id: string;
  subject: string;
  overall_score: number;
  topic_scores: Record<string, number>;
  quiz_count: number;
  study_hours: number;
  snapshot_date: string;
}

interface SnapshotComparison {
  current: ProgressSnapshot;
  previous: ProgressSnapshot | null;
  improvement_pct: number;
  score_change: number;
  hours_change: number;
  quizzes_change: number;
}

/**
 * POST /api/progress-snapshot
 *
 * Creates periodic progress snapshots and provides trend analysis.
 *
 * Body:
 * {
 *   student_id: string,
 *   subject?: string,
 *   action?: 'create' | 'history',
 *   days?: number
 * }
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: SnapshotRequest = await req.json();
    const { student_id, subject, action = 'create', days = 30 } = body;

    if (!student_id) {
      return new Response(JSON.stringify({ error: 'Missing student_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'history') {
      return await handleHistory(student_id, subject, days);
    }

    return await handleCreateSnapshot(student_id, subject);
  } catch (error: any) {
    console.error('Progress snapshot error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Progress snapshot failed',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Create a new progress snapshot
 */
async function handleCreateSnapshot(student_id: string, subject?: string) {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Determine subjects to snapshot
  let subjects: string[] = [];
  if (subject) {
    subjects = [subject];
  } else {
    // Get all subjects the student has quizzes for
    const { data: quizSubjects } = await supabase
      .from('quiz_results')
      .select('subject')
      .eq('student_id', student_id)
      .not('subject', 'is', null);

    const uniqueSubjects = new Set((quizSubjects || []).map((q: any) => q.subject as string));
    subjects = Array.from(uniqueSubjects);
  }

  const snapshots: ProgressSnapshot[] = [];

  for (const subj of subjects) {
    // Get quiz results for the last 7 days
    const { data: quizzes } = await supabase
      .from('quiz_results')
      .select('score, subject, completed_at')
      .eq('student_id', student_id)
      .eq('subject', subj)
      .gte('completed_at', sevenDaysAgo.toISOString());

    // Get weaknesses data
    const { data: weaknesses } = await supabase
      .from('student_weaknesses')
      .select('topic, mastery_pct, error_count, total_attempts')
      .eq('student_id', student_id)
      .eq('subject', subj);

    // Get study sessions for the last 7 days
    const { data: sessions } = await supabase
      .from('study_sessions')
      .select('duration_sec, started_at')
      .eq('student_id', student_id)
      .eq('subject', subj)
      .gte('started_at', sevenDaysAgo.toISOString());

    // Calculate metrics
    const quizScores = (quizzes || []).map((q: any) => Number(q.score));
    const overallScore = quizScores.length > 0
      ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
      : 0;

    const quizCount = quizScores.length;

    const totalSeconds = (sessions || []).reduce(
      (sum: number, s: any) => sum + (s.duration_sec || 0), 0
    );
    const studyHours = Math.round((totalSeconds / 3600) * 100) / 100;

    // Topic scores from weaknesses
    const topicScores: Record<string, number> = {};
    for (const w of (weaknesses || [])) {
      topicScores[(w as any).topic] = Number((w as any).mastery_pct);
    }

    // Save snapshot
    const { data: savedSnapshot } = await supabase
      .from('progress_snapshots')
      .insert({
        student_id,
        subject: subj,
        overall_score: overallScore,
        topic_scores_json: topicScores,
        quiz_count: quizCount,
        study_hours: studyHours,
        snapshot_date: now.toISOString().split('T')[0],
      })
      .select()
      .single();

    // Get previous snapshot for comparison
    const { data: prevSnapshot } = await supabase
      .from('progress_snapshots')
      .select('*')
      .eq('student_id', student_id)
      .eq('subject', subj)
      .neq('id', savedSnapshot?.id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    const prevScore = prevSnapshot ? Number(prevSnapshot.overall_score) : null;
    const prevHours = prevSnapshot ? Number(prevSnapshot.study_hours) : null;

    const currentSnapshot: ProgressSnapshot = {
      id: savedSnapshot?.id || '',
      student_id,
      subject: subj,
      overall_score: overallScore,
      topic_scores: topicScores,
      quiz_count: quizCount,
      study_hours: studyHours,
      snapshot_date: now.toISOString().split('T')[0],
    };

    snapshots.push(currentSnapshot);
  }

  // Generate AI insights if we have data
  let aiInsights = '';
  if (snapshots.length > 0) {
    const bestSnapshot = snapshots.reduce((a, b) =>
      a.overall_score >= b.overall_score ? a : b
    );

    try {
      const { text } = await generateText({
        model: groq('llama-3.1-8b-instant'),
        system: 'You are a Matric study advisor. Provide brief, encouraging insights about student progress.',
        prompt: `Student progress snapshot for ${bestSnapshot.subject}:
- Overall score: ${bestSnapshot.overall_score}%
- Study hours this week: ${bestSnapshot.study_hours}h
- Quizzes completed: ${bestSnapshot.quiz_count}
- Topic scores: ${JSON.stringify(bestSnapshot.topic_scores)}

Provide 2-3 brief insights (under 100 words total) about their progress and what to focus on next.`,
        maxOutputTokens: 200,
      });
      aiInsights = text;
    } catch {
      aiInsights = 'Keep up the great work! Review your weaker topics regularly.';
    }
  }

  return new Response(JSON.stringify({
    success: true,
    snapshots,
    ai_insights: aiInsights,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Get snapshot history for trend analysis
 */
async function handleHistory(student_id: string, subject?: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from('progress_snapshots')
    .select('*')
    .eq('student_id', student_id)
    .gte('snapshot_date', startDate.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true });

  if (subject) {
    query = query.eq('subject', subject);
  }

  const { data: snapshots, error } = await query;

  if (error) throw error;

  const formattedSnapshots = (snapshots || []).map((s: any) => ({
    id: s.id,
    student_id: s.student_id,
    subject: s.subject,
    overall_score: Number(s.overall_score),
    topic_scores: s.topic_scores_json || {},
    quiz_count: s.quiz_count,
    study_hours: Number(s.study_hours),
    snapshot_date: s.snapshot_date,
  }));

  return new Response(JSON.stringify({
    success: true,
    snapshots: formattedSnapshots,
    count: formattedSnapshots.length,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
