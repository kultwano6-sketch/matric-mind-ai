import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const maxDuration = 60;
export const runtime = 'edge';

/**
 * POST /api/matric-readiness
 * 
 * Calculates a "Matric Readiness Score" (0-100%) based on:
 * - Subject coverage (how many topics mastered)
 * - Weakness severity
 * - Recent quiz trends (improving or declining?)
 * - Study consistency
 * 
 * Body:
 * {
 *   student_id: string
 * }
 * 
 * Returns score + breakdown per subject + actionable advice.
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
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

    // Fetch student profile for subjects
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('grade, subjects')
      .eq('user_id', student_id)
      .single();

    const studentSubjects: string[] = profile?.subjects || [];

    // Fetch weaknesses
    const { data: weaknesses } = await supabase
      .from('student_weaknesses')
      .select('*')
      .eq('student_id', student_id);

    // Fetch recent quiz results (last 20 for trend analysis)
    const { data: quizResults } = await supabase
      .from('quiz_results')
      .select('*')
      .eq('student_id', student_id)
      .order('completed_at', { ascending: false })
      .limit(20);

    // Fetch study plan entries (last 30 days for consistency)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: studyEntries } = await supabase
      .from('study_plan_entries')
      .select('*')
      .eq('student_id', student_id)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

    // ========================================
    // Calculate Subject Coverage Score
    // ========================================
    const subjectWeaknessMap = new Map<string, any[]>();
    for (const w of (weaknesses || [])) {
      const list = subjectWeaknessMap.get(w.subject) || [];
      list.push(w);
      subjectWeaknessMap.set(w.subject, list);
    }

    const subjectBreakdown: Record<string, {
      score: number;
      topics_mastered: number;
      topics_total: number;
      avg_mastery: number;
      status: 'excellent' | 'good' | 'needs_work' | 'critical';
    }> = {};

    for (const subject of studentSubjects) {
      const subs = subjectWeaknessMap.get(subject) || [];
      if (subs.length === 0) {
        subjectBreakdown[subject] = {
          score: 0,
          topics_mastered: 0,
          topics_total: 0,
          avg_mastery: 0,
          status: 'critical',
        };
        continue;
      }

      const avgMastery = subs.reduce((sum, w) => sum + Number(w.mastery_pct), 0) / subs.length;
      const topicsMastered = subs.filter(w => Number(w.mastery_pct) >= 70).length;
      const score = Math.round(avgMastery);

      let status: 'excellent' | 'good' | 'needs_work' | 'critical';
      if (score >= 80) status = 'excellent';
      else if (score >= 60) status = 'good';
      else if (score >= 40) status = 'needs_work';
      else status = 'critical';

      subjectBreakdown[subject] = {
        score,
        topics_mastered: topicsMastered,
        topics_total: subs.length,
        avg_mastery: Math.round(avgMastery),
        status,
      };
    }

    const coverageScores = Object.values(subjectBreakdown).map(s => s.score);
    const subjectCoverageScore = coverageScores.length > 0
      ? Math.round(coverageScores.reduce((a, b) => a + b, 0) / coverageScores.length)
      : 0;

    // ========================================
    // Calculate Weakness Severity Score
    // ========================================
    const criticalWeaknesses = (weaknesses || []).filter(w => Number(w.mastery_pct) < 30);
    const warningWeaknesses = (weaknesses || []).filter(w => Number(w.mastery_pct) >= 30 && Number(w.mastery_pct) < 60);

    let weaknessSeverityScore = 100;
    weaknessSeverityScore -= criticalWeaknesses.length * 15; // Heavy penalty for critical
    weaknessSeverityScore -= warningWeaknesses.length * 5;   // Moderate penalty for warning
    weaknessSeverityScore = Math.max(0, weaknessSeverityScore);

    // ========================================
    // Calculate Quiz Trend Score
    // ========================================
    let quizTrendScore = 50; // Default neutral
    if (quizResults && quizResults.length >= 3) {
      const recent = quizResults.slice(0, Math.min(5, quizResults.length));
      const older = quizResults.slice(Math.min(5, quizResults.length));

      const recentAvg = recent.reduce((sum: number, q: any) => sum + Number(q.score), 0) / recent.length;
      
      if (older.length > 0) {
        const olderAvg = older.reduce((sum: number, q: any) => sum + Number(q.score), 0) / older.length;
        const trend = recentAvg - olderAvg;
        // Trend ranges from -100 to +100, map to 0-100
        quizTrendScore = Math.round(Math.min(100, Math.max(0, 50 + trend)));
      } else {
        quizTrendScore = Math.round(recentAvg);
      }
    } else if (quizResults && quizResults.length > 0) {
      quizTrendScore = Math.round(
        quizResults.reduce((sum: number, q: any) => sum + Number(q.score), 0) / quizResults.length
      );
    }

    // ========================================
    // Calculate Study Consistency Score
    // ========================================
    const studyDays = new Set((studyEntries || []).map((e: any) => e.date));
    const completedEntries = (studyEntries || []).filter((e: any) => e.completed);
    const consistencyScore = Math.min(100, Math.round((studyDays.size / 30) * 100));
    const completionRate = (studyEntries || []).length > 0
      ? Math.round((completedEntries.length / (studyEntries || []).length) * 100)
      : 0;

    // ========================================
    // Overall Matric Readiness Score
    // ========================================
    // Weighted average: coverage 40%, weakness 25%, trend 20%, consistency 15%
    const overallScore = Math.round(
      subjectCoverageScore * 0.40 +
      weaknessSeverityScore * 0.25 +
      quizTrendScore * 0.20 +
      consistencyScore * 0.15
    );

    // ========================================
    // Generate AI Advice
    // ========================================
    let aiAdvice = '';
    try {
      const weakTopicsList = (weaknesses || [])
        .filter(w => Number(w.mastery_pct) < 60)
        .sort((a, b) => Number(a.mastery_pct) - Number(b.mastery_pct))
        .slice(0, 5)
        .map(w => `${w.subject} > ${w.topic}: ${w.mastery_pct}%`)
        .join('\n') || 'No critical weak topics identified yet.';

      const trendDescription = quizTrendScore > 60 
        ? 'improving' 
        : quizTrendScore < 40 
          ? 'declining' 
          : 'stable';

      const { text } = await generateText({
        model: groq('llama-3.1-8b-instant'),
        system: 'You are a concise Matric exam advisor for South African students. Be direct, encouraging, and actionable.',
        prompt: `Student Matric Readiness Analysis:

Overall Score: ${overallScore}%
Subject Coverage: ${subjectCoverageScore}%
Quiz Trend: ${trendDescription} (${quizTrendScore}%)
Study Consistency: ${consistencyScore}% (studied ${studyDays.size}/30 days)
Completion Rate: ${completionRate}%

Critical Weak Topics:
${weakTopicsList}

Provide 3 short, actionable tips (1 sentence each) to improve their Matric readiness. Be encouraging but honest.`,
        maxOutputTokens: 256,
        temperature: 0.4,
      });

      aiAdvice = text;
    } catch (aiError) {
      console.error('AI advice error:', aiError);
      // Fallback advice
      const tips: string[] = [];
      if (subjectCoverageScore < 50) tips.push('Focus on building topic mastery in your weakest subjects first.');
      if (quizTrendScore < 50) tips.push('Your recent scores are trending down - review the topics you got wrong in recent quizzes.');
      if (consistencyScore < 30) tips.push('Study a little every day. Even 20 minutes of focused practice helps build lasting knowledge.');
      if (criticalWeaknesses.length > 3) tips.push('You have several critical weak areas. Prioritize the most important ones for your exam.');
      aiAdvice = tips.length > 0 ? tips.join(' ') : 'Keep up the consistent effort and review your weak areas regularly.';
    }

    return new Response(JSON.stringify({
      success: true,
      overall_score: overallScore,
      breakdown: {
        subject_coverage: subjectCoverageScore,
        weakness_severity: weaknessSeverityScore,
        quiz_trend: quizTrendScore,
        study_consistency: consistencyScore,
      },
      subject_breakdown: subjectBreakdown,
      quiz_trend_direction: quizTrendScore > 60 ? 'improving' : quizTrendScore < 40 ? 'declining' : 'stable',
      study_stats: {
        days_studied: studyDays.size,
        total_sessions: (studyEntries || []).length,
        completed_sessions: completedEntries.length,
        completion_rate: completionRate,
      },
      critical_weaknesses: criticalWeaknesses.length,
      ai_advice: aiAdvice,
      quizzes_taken: (quizResults || []).length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Matric readiness error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to calculate matric readiness',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
