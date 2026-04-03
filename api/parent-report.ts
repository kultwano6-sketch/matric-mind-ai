// api/parent-report.ts — Generate parent report (Web API)

import { createClient } from '@supabase/supabase-js';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

interface ReportData {
  study_summary: {
    total_hours: number;
    total_sessions: number;
    completed_sessions: number;
    completion_rate: number;
  };
  quiz_summary: {
    quizzes_taken: number;
    avg_score_this_week: number | null;
    avg_score_last_week: number | null;
    trend: 'improving' | 'declining' | 'stable';
    trend_value: number;
    subject_performance: Array<{ subject: string; avg_score: number; quiz_count: number }>;
  };
  matric_readiness: {
    score: number;
    status: string;
  };
  weak_subjects: Array<{ subject: string; avg_score: number; quiz_count: number }>;
  weak_topics: Array<{ subject: string; topic: string; mastery_pct: number }>;
  recommendations: Array<{ subject: string; topic: string; reason: string; priority: number }>;
  ai_summary: string;
  generated_at: string;
  week_period: {
    from: string;
    to: string;
  };
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { student_id } = body;

  if (!student_id) {
    return new Response(JSON.stringify({ error: 'student_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get student profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', student_id)
      .single();

    const studentName = profile?.full_name || 'Student';

    // Calculate date range for this week and last week
    const now = new Date();
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay());
    startOfThisWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    // Fetch quiz results for this week (using quiz_results table)
    const { data: thisWeekQuizzes } = await supabase
      .from('quiz_results')
      .select('*')
      .eq('student_id', student_id)
      .gte('completed_at', startOfThisWeek.toISOString());

    // Fetch quiz results for last week
    const { data: lastWeekQuizzes } = await supabase
      .from('quiz_results')
      .select('*')
      .eq('student_id', student_id)
      .gte('completed_at', startOfLastWeek.toISOString())
      .lt('completed_at', startOfThisWeek.toISOString());

    // Calculate quiz stats
    const quizzesThisWeek = thisWeekQuizzes?.length || 0;
    const quizzesLastWeek = lastWeekQuizzes?.length || 0;

    const avgScoreThisWeek = thisWeekQuizzes?.length
      ? Math.round(thisWeekQuizzes.reduce((sum: number, q: any) => sum + (parseFloat(q.score) || 0), 0) / thisWeekQuizzes.length)
      : null;

    const avgScoreLastWeek = lastWeekQuizzes?.length
      ? Math.round(lastWeekQuizzes.reduce((sum: number, q: any) => sum + (parseFloat(q.score) || 0), 0) / lastWeekQuizzes.length)
      : null;

    // Determine trend
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    let trendValue = 0;
    if (avgScoreThisWeek !== null && avgScoreLastWeek !== null) {
      trendValue = avgScoreThisWeek - avgScoreLastWeek;
      if (trendValue > 5) trend = 'improving';
      else if (trendValue < -5) trend = 'declining';
    }

    // Calculate subject performance from quiz_results
    const subjectMap = new Map<string, { total: number; count: number }>();
    
    // This week's quizzes by subject
    if (thisWeekQuizzes) {
      thisWeekQuizzes.forEach((q: any) => {
        const existing = subjectMap.get(q.subject) || { total: 0, count: 0 };
        existing.total += parseFloat(q.score) || 0;
        existing.count += 1;
        subjectMap.set(q.subject, existing);
      });
    }

    const subjectPerformance = Array.from(subjectMap.entries()).map(([subject, data]) => ({
      subject,
      avg_score: Math.round(data.total / data.count),
      quiz_count: data.count,
    }));

    // Find weak subjects (below 50%)
    const weakSubjects = subjectPerformance
      .filter(s => s.avg_score < 50)
      .sort((a, b) => a.avg_score - b.avg_score)
      .slice(0, 5);

    // Fetch student weaknesses (topics)
    const { data: weaknesses } = await supabase
      .from('student_weaknesses')
      .select('subject, topic, mastery_pct')
      .eq('student_id', student_id)
      .lt('mastery_pct', 50)
      .order('mastery_pct', { ascending: true })
      .limit(10);

    const weakTopics = (weaknesses || []).map((w: any) => ({
      subject: w.subject,
      topic: w.topic,
      mastery_pct: Math.round(w.mastery_pct || 0),
    }));

    // Fetch study recommendations
    const { data: recommendations } = await supabase
      .from('study_recommendations')
      .select('subject, topic, reason, priority')
      .eq('student_id', student_id)
      .is('dismissed_at', null)
      .order('priority', { ascending: false })
      .limit(5);

    const recommendationsData = (recommendations || []).map((r: any) => ({
      subject: r.subject,
      topic: r.topic,
      reason: r.reason,
      priority: r.priority,
    }));

    // Calculate study streaks
    const { data: streaks } = await supabase
      .from('study_streaks')
      .select('login_date')
      .eq('user_id', student_id)
      .gte('login_date', startOfLastWeek.toISOString())
      .order('login_date', { ascending: false });

    const studyDays = streaks?.length || 0;

    // Calculate matric readiness (based on quiz scores + weaknesses)
    let matricReadinessScore = 50;
    if (avgScoreThisWeek !== null) {
      const baseScore = avgScoreThisWeek;
      const weaknessPenalty = Math.min(20, (weakTopics.length * 2));
      matricReadinessScore = Math.min(100, Math.max(0, baseScore - weaknessPenalty + 20));
    }

    let readinessStatus = 'needs_work';
    if (matricReadinessScore >= 80) readinessStatus = 'excellent';
    else if (matricReadinessScore >= 60) readinessStatus = 'good';

    // Generate AI summary using Groq
    let aiSummary = '';
    try {
      const { text } = await generateText({
        model: groq(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'),
        system: `You are generating a brief parent-friendly summary of a South African matric student's weekly progress. 
Write 2-3 sentences max. Be positive but honest. Focus on highlights and areas for improvement.`,
        prompt: `Student: ${studentName}
This week's quiz average: ${avgScoreThisWeek ?? 'N/A'}%
Last week's average: ${avgScoreLastWeek ?? 'N/A'}%
Quizzes taken: ${quizzesThisWeek}
Study streak days: ${studyDays}
Weak subjects: ${weakSubjects.map(s => s.subject).join(', ') || 'None'}
Weak topics: ${weakTopics.map(t => t.topic).join(', ') || 'None'}
Overall trend: ${trend}`,
        maxTokens: 300,
        temperature: 0.7,
      });
      aiSummary = text || '';
    } catch (aiError) {
      console.error('AI summary generation failed:', aiError);
      aiSummary = `${studentName} has completed ${quizzesThisWeek} quizzes this week with an average score of ${avgScoreThisWeek ?? 'N/A'}%. ${weakSubjects.length > 0 ? `Areas to focus on: ${weakSubjects.map(s => s.subject).join(', ')}.` : ''}`;
    }

    // Build the report
    const report: ReportData = {
      study_summary: {
        total_hours: studyDays * 1.5, // Estimate ~1.5 hours per study day
        total_sessions: quizzesThisWeek,
        completed_sessions: Math.round(quizzesThisWeek * 0.8), // Estimate 80% completion
        completion_rate: quizzesThisWeek > 0 ? 80 : 0,
      },
      quiz_summary: {
        quizzes_taken: quizzesThisWeek,
        avg_score_this_week: avgScoreThisWeek,
        avg_score_last_week: avgScoreLastWeek,
        trend,
        trend_value: trendValue,
        subject_performance: subjectPerformance,
      },
      matric_readiness: {
        score: matricReadinessScore,
        status: readinessStatus,
      },
      weak_subjects: weakSubjects,
      weak_topics: weakTopics,
      recommendations: recommendationsData,
      ai_summary: aiSummary,
      generated_at: new Date().toISOString(),
      week_period: {
        from: startOfLastWeek.toISOString(),
        to: now.toISOString(),
      },
    };

    return new Response(JSON.stringify({
      success: true,
      report,
      student: {
        id: student_id,
        name: studentName,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Parent Report Error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate report',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}