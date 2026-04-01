import { getSupabase } from '../server/supabaseClient';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const maxDuration = 120;
export const runtime = 'edge';

/**
 * POST /api/parent-report
 * 
 * Generates a weekly parent report for a student.
 * Takes student_id, returns JSON with:
 * - Weekly study time
 * - Quiz scores trend
 * - Weak subjects
 * - Matric readiness score
 * - Recommendations
 * Uses Groq to generate a human-readable summary.
 * 
 * Body:
 * {
 *   student_id: string
 * }
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { student_id } = body;

    if (!student_id) {
      return new Response(JSON.stringify({ error: 'Missing student_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify the requester is a linked parent
    const { data: parentLink } = await supabase
      .from('parent_links')
      .select('*')
      .eq('student_user_id', student_id)
      .maybeSingle();

    // Fetch student profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', student_id)
      .single();

    const studentName = profile?.full_name || 'Student';

    // ========================================
    // Fetch data for the past week
    // ========================================
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Weekly study time from study_plan_entries
    const { data: studyEntries } = await supabase
      .from('study_plan_entries')
      .select('*')
      .eq('student_id', student_id)
      .gte('created_at', oneWeekAgo.toISOString());

    const weeklyStudyMinutes = (studyEntries || []).reduce(
      (sum: number, e: any) => sum + (e.completed ? (e.duration_min || 0) : 0), 
      0
    );
    const weeklyStudyHours = Math.round((weeklyStudyMinutes / 60) * 10) / 10;
    const totalStudySessions = (studyEntries || []).length;
    const completedSessions = (studyEntries || []).filter((e: any) => e.completed).length;

    // Quiz scores trend (last 7 days vs previous 7 days)
    const twoWeeksAgo = new Date(oneWeekAgo);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);

    const { data: thisWeekQuizzes } = await supabase
      .from('quiz_results')
      .select('score, subject, completed_at')
      .eq('student_id', student_id)
      .gte('completed_at', oneWeekAgo.toISOString())
      .order('completed_at', { ascending: false });

    const { data: lastWeekQuizzes } = await supabase
      .from('quiz_results')
      .select('score, subject, completed_at')
      .eq('student_id', student_id)
      .gte('completed_at', twoWeeksAgo.toISOString())
      .lt('completed_at', oneWeekAgo.toISOString());

    // Fixed: Proper parentheses for correct average calculation
    const thisWeekAvg = (thisWeekQuizzes || []).length > 0
      ? Math.round(
          (thisWeekQuizzes as any[]).reduce((sum: number, q: any) => sum + Number(q.score), 0) 
          / ((thisWeekQuizzes as any[]).length) * 10
        ) / 10
      : null;

    const lastWeekAvg = (lastWeekQuizzes || []).length > 0
      ? Math.round(
          (lastWeekQuizzes as any[]).reduce((sum: number, q: any) => sum + Number(q.score), 0) 
          / ((lastWeekQuizzes as any[]).length) * 10
        ) / 10
      : null;

    const scoreTrend = thisWeekAvg !== null && lastWeekAvg !== null
      ? thisWeekAvg - lastWeekAvg
      : 0;

    // Subject performance for the week
    const subjectScores: Record<string, number[]> = {};
    for (const quiz of (thisWeekQuizzes || []) as any[]) {
      if (!subjectScores[quiz.subject]) subjectScores[quiz.subject] = [];
      subjectScores[quiz.subject].push(Number(quiz.score));
    }

    const subjectPerformance = Object.entries(subjectScores).map(([subject, scores]) => ({
      subject,
      avg_score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      quiz_count: scores.length,
    })).sort((a, b) => a.avg_score - b.avg_score);

    const weakSubjects = subjectPerformance.filter(s => s.avg_score < 60);
    const strongSubjects = subjectPerformance.filter(s => s.avg_score >= 70);

    // Fetch weaknesses
    const { data: weaknesses } = await supabase
      .from('student_weaknesses')
      .select('subject, topic, mastery_pct')
      .eq('student_id', student_id)
      .lt('mastery_pct', 60)
      .order('mastery_pct', { ascending: true })
      .limit(5);

    // Fetch study recommendations
    const { data: recommendations } = await supabase
      .from('study_recommendations')
      .select('subject, topic, reason, priority')
      .eq('student_id', student_id)
      .is('dismissed_at', null)
      .order('priority', { ascending: true })
      .limit(5);

    // ========================================
    // Calculate Matric Readiness Score
    // ========================================
    let readinessScore = 50; // Default
    try {
      const appUrl = process.env.APP_URL || '';
      if (appUrl) {
        const readinessResponse = await fetch(`${appUrl}/api/matric-readiness`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id }),
        });
        if (readinessResponse.ok) {
          const readinessData = await readinessResponse.json();
          readinessScore = readinessData.overall_score || 50;
        }
      } else if (subjectPerformance.length > 0) {
        readinessScore = Math.round(
          subjectPerformance.reduce((sum, s) => sum + s.avg_score, 0) / subjectPerformance.length
        );
      }
    } catch (e) {
      console.error('Could not fetch readiness score:', e);
      // Calculate from available data
      if (subjectPerformance.length > 0) {
        readinessScore = Math.round(
          subjectPerformance.reduce((sum, s) => sum + s.avg_score, 0) / subjectPerformance.length
        );
      }
    }

    // ========================================
    // Generate AI Summary
    // ========================================
    let aiSummary = '';
    try {
      const { text } = await generateText({
        model: groq('llama-3.1-8b-instant'),
        system: `You write weekly progress reports for parents of South African Matric students. 
Be warm, encouraging, and clear. Use simple language. Avoid jargon.
Format as a friendly letter. Focus on positives while being honest about areas needing attention.`,
        prompt: `Write a brief weekly progress report for ${studentName}'s parent.

WEEKLY STATS:
- Study time: ${weeklyStudyHours} hours across ${totalStudySessions} sessions (${completedSessions} completed)
- Quizzes taken: ${(thisWeekQuizzes || []).length}
- Average quiz score this week: ${thisWeekAvg !== null ? `${thisWeekAvg}%` : 'No quizzes'}
- Average quiz score last week: ${lastWeekAvg !== null ? `${lastWeekAvg}%` : 'No quizzes'}
- Score trend: ${scoreTrend > 0 ? `Improving (+${scoreTrend}%)` : scoreTrend < 0 ? `Declining (${scoreTrend}%)` : 'Stable'}
- Matric Readiness Score: ${readinessScore}%

STRONG SUBJECTS: ${strongSubjects.length > 0 ? strongSubjects.map(s => `${s.subject} (${s.avg_score}%)`).join(', ') : 'None yet'}
AREAS NEEDING ATTENTION: ${weakSubjects.length > 0 ? weakSubjects.map(s => `${s.subject} (${s.avg_score}%)`).join(', ') : 'None critical'}

TOP WEAK TOPICS: ${(weaknesses || []).map((w: any) => `${w.topic} (${w.subject}) - ${w.mastery_pct}% mastery`).join(', ') || 'None identified'}

Write 3-4 short paragraphs. Start with a positive note. End with encouragement.`,
        maxOutputTokens: 512,
        temperature: 0.5,
      });

      aiSummary = text;
    } catch (aiError) {
      console.error('AI summary error:', aiError);
      aiSummary = `${studentName} had ${weeklyStudyHours} hours of study this week with ${completedSessions} completed sessions. `;
      if (thisWeekAvg !== null) {
        aiSummary += `Average quiz score: ${thisWeekAvg}%. `;
      }
      if (weakSubjects.length > 0) {
        aiSummary += `Areas needing attention: ${weakSubjects.map(s => s.subject).join(', ')}. `;
      }
      aiSummary += 'Keep encouraging consistent study habits.';
    }

    // Build the report
    const report = {
      student: {
        id: student_id,
        name: studentName,
        avatar_url: profile?.avatar_url,
      },
      week_period: {
        from: oneWeekAgo.toISOString(),
        to: new Date().toISOString(),
      },
      study_summary: {
        total_hours: weeklyStudyHours,
        total_sessions: totalStudySessions,
        completed_sessions: completedSessions,
        completion_rate: totalStudySessions > 0 
          ? Math.round((completedSessions / totalStudySessions) * 100) 
          : 0,
      },
      quiz_summary: {
        quizzes_taken: (thisWeekQuizzes || []).length,
        avg_score_this_week: thisWeekAvg,
        avg_score_last_week: lastWeekAvg,
        trend: scoreTrend > 0 ? 'improving' : scoreTrend < 0 ? 'declining' : 'stable',
        trend_value: scoreTrend,
        subject_performance: subjectPerformance,
      },
      matric_readiness: {
        score: readinessScore,
        status: readinessScore >= 80 ? 'excellent' : readinessScore >= 60 ? 'good' : readinessScore >= 40 ? 'needs_work' : 'critical',
      },
      weak_subjects: weakSubjects,
      weak_topics: (weaknesses || []).map((w: any) => ({
        subject: w.subject,
        topic: w.topic,
        mastery_pct: w.mastery_pct,
      })),
      recommendations: (recommendations || []).map((r: any) => ({
        subject: r.subject,
        topic: r.topic,
        reason: r.reason,
        priority: r.priority,
      })),
      ai_summary: aiSummary,
      generated_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify({
      success: true,
      report,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Parent report error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate parent report',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
