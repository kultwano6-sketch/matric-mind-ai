// api/predictions.ts — Performance Prediction Engine
// Estimates expected exam scores and improvement potential

import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);
export interface Prediction {
  current_level: number;
  expected_exam_score: number;
  improvement_potential: number;
  target_score: number;
  path_to_improvement: {
    focus_topics: string[];
    required_study_hours: number;
    timeline: string;
  };
  risk_factors: string[];
  confidence: number;
}
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  try {
    const { student_id, target_score = 70 } = await req.json();
    if (!student_id) {
      return new Response(JSON.stringify({ error: 'Student ID required' }), { status: 400 });
    }
    // Get quiz performance
    const { data: quizzes } = await supabase
      .from('quiz_results')
      .select('score, subject, completed_at')
      .eq('student_id', student_id)
      .order('completed_at', { ascending: false })
      .limit(20);
    // Get topic mastery
    const { data: topics } = await supabase
      .from('topic_performance')
      .select('subject, topic, mastery_level')
      .eq('student_id', student_id);
    // Get study consistency
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: sessions } = await supabase
      .from('study_sessions')
      .select('duration_minutes, started_at')
      .gte('started_at', thirtyDaysAgo.toISOString());
    // Calculate current level
    const currentLevel = quizzes && quizzes.length > 0
      ? quizzes.reduce((s, q) => s + q.score, 0) / quizzes.length
      : 0;
    // Identify weak topics to focus on
    const weakTopics = (topics || [])
      .filter(t => t.mastery_level < 60)
      .sort((a, b) => a.mastery_level - b.mastery_level)
      .slice(0, 5);
    // Calculate improvement potential based on:
    // - consistency (more study = more potential)
    // - number of weak topics (fewer = easier to improve)
    // - quiz attempt history
    
    const studyDays = sessions?.length || 0;
    const studyHours = (sessions?.reduce((s, s2) => s + (s2.duration_minutes || 0), 0) || 0) / 60;
    // Base improvement potential (0-30%)
    let improvementPotential = Math.min(studyDays / 30 * 20, 20);
    // Add bonus for high weak topic count (indicates clear areas to improve)
    improvementPotential += Math.min(weakTopics.length * 2, 10);
    // Calculate expected exam score
    const expectedScore = Math.min(currentLevel + improvementPotential, 95);
    // Determine timeline
    const daysToImprove = weakTopics.length > 3 ? '4-6 weeks' : '2-3 weeks';
    const requiredHours = Math.max(20, weakTopics.length * 8 - studyHours);
    // Risk factors
    const riskFactors: string[] = [];
    if (studyDays < 3) riskFactors.push('Low study frequency');
    if (quizzes?.length || 0 < 5) riskFactors.push('Limited quiz history');
    if (weakTopics.length > 4) riskFactors.push('Multiple weak topics need attention');
    // Confidence based on data quality
    let confidence = 50;
    if (quizzes && quizzes.length >= 10) confidence += 20;
    if (topics && topics.length >= 10) confidence += 15;
    if (studyDays >= 10) confidence += 15;
    confidence = Math.min(confidence, 95);
    // Build insight message
    let insight = '';
    if (expectedScore >= target_score) {
      insight = `You're on track! With continued effort, you can reach ${Math.round(expectedScore)}%.`;
    } else {
      const gap = target_score - expectedScore;
      insight = `Focus on ${weakTopics[0]?.topic || 'weak topics'} to close the ${gap}% gap to your target.`;
    const prediction: Prediction = {
      current_level: Math.round(currentLevel),
      expected_exam_score: Math.round(expectedScore),
      improvement_potential: Math.round(improvementPotential),
      target_score,
      path_to_improvement: {
        focus_topics: weakTopics.map(t => `${t.subject}: ${t.topic}`),
        required_study_hours: Math.round(requiredHours),
        timeline: daysToImprove,
      },
      risk_factors: riskFactors,
      confidence,
      insight,
    };
    return new Response(JSON.stringify({
      prediction,
      generated_at: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Prediction error:', error);
      prediction: null,
      error: 'Failed to generate prediction',
    }), { status: 200 });
