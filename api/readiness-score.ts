// api/readiness-score.ts — Matric Readiness Score Calculator
// Weighted: 40% quiz, 30% consistency, 30% topic completion

import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  try {
    const { student_id } = await req.json();
    if (!student_id) {
      return new Response(JSON.stringify({ error: 'Student ID required' }), { status: 400 });
    }
    // 1. Quiz Performance (40%)
    const { data: quizData } = await supabase
      .from('quiz_results')
      .select('score')
      .eq('student_id', student_id);
    const quizPerformance = quizData && quizData.length > 0
      ? quizData.reduce((sum, r) => sum + r.score, 0) / quizData.length
      : 50;
    // 2. Study Consistency (30%) - last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: recentActivity } = await supabase
      .from('study_sessions')
      .select('duration_minutes')
      .eq('student_id', student_id)
      .gte('started_at', thirtyDaysAgo.toISOString());
    const studyDays = recentActivity?.length || 0;
    const studyConsistency = Math.min((studyDays / 30) * 100, 100);
    // 3. Topic Completion (30%)
    const { data: topicsData } = await supabase
      .from('topic_performance')
      .select('mastery_level')
      .gte('mastery_level', 60);
    const topicCompletion = topicsData ? Math.min((topicsData.length / 20) * 100, 100) : 0;
    // Calculate weighted overall
    const overallScore = Math.round(
      (quizPerformance * 0.4) + 
      (studyConsistency * 0.3) + 
      (topicCompletion * 0.3)
    );
    // Determine color
    let color: 'red' | 'orange' | 'yellow' | 'green';
    if (overallScore <= 40) color = 'red';
    else if (overallScore <= 60) color = 'orange';
    else if (overallScore <= 75) color = 'yellow';
    else color = 'green';
    // Generate AI insight
    const insights: Record<string, string> = {
      red: 'Focus on mastering one subject at a time. Start with your weakest topic and build a strong foundation.',
      orange: 'You\'re making progress! Increase your study sessions to 45 minutes daily and focus on practice questions.',
      yellow: 'Good progress! Keep up the consistent study schedule and try some exam-style practice questions.',
      green: 'Excellent! You\'re well prepared. Focus on maintaining your knowledge and practicing under exam conditions.',
    };
    const ai_tip = insights[color];
    return new Response(JSON.stringify({
      overall_score: overallScore,
      quiz_performance: Math.round(quizPerformance),
      study_consistency: Math.round(studyConsistency),
      topic_completion: Math.round(topicCompletion),
      color,
      ai_tip,
      quiz_count: quizData?.length || 0,
      topics_mastered: topicsData?.length || 0,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Readiness score error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to calculate readiness',
      overall_score: 0,
      ai_tip: 'Complete some quizzes to see your readiness score.',
    }), { status: 200 });
}
