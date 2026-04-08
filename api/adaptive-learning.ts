// api/adaptive-learning.ts — AI-powered adaptive learning endpoints

import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
// ============================================================
// GET NEXT STUDY RECOMMENDATION
export async function POST(request: Request) {
  try {
    const { student_id, subject } = await request.json();
    if (!student_id) {
      return Response.json({ error: 'Student ID required' }, { status: 400 });
    }
    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || 'https://example.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Get student's weak topics (mastery < 60%)
    const { data: weakTopics } = await supabase
      .from('topic_performance')
      .select('subject, topic, mastery_level, total_attempts')
      .eq('student_id', student_id)
      .lt('mastery_level', 60)
      .order('mastery_level', { ascending: true })
      .limit(5);
    // Get recent quiz performance for adaptive difficulty
    const { data: recentQuizzes } = await supabase
      .from('quiz_results')
      .select('subject, score')
      .order('completed_at', { ascending: false })
      .limit(10);
    // Calculate average score per subject
    const subjectScores: Record<string, number[]> = {};
    for (const quiz of recentQuizzes || []) {
      if (!subjectScores[quiz.subject]) subjectScores[quiz.subject] = [];
      subjectScores[quiz.subject].push(quiz.score);
    const avgScores = Object.entries(subjectScores).map(([subj, scores]) => ({
      subject: subj,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    }));
    // Generate AI recommendation
    const prompt = `You are a South African Matric study advisor. Based on this student's data:
    
Weak Topics: ${JSON.stringify(weakTopics?.map(t => ({ subject: t.subject, topic: t.topic, mastery: t.mastery_level })) || [])}
Subject Performance: ${JSON.stringify(avgScores)}
Provide a JSON response with exactly this structure:
{
  "recommended_topic": "topic name",
  "recommended_subject": "subject name", 
  "reason": "why this is recommended (max 100 chars)",
  "difficulty": "easy|medium|hard",
  "estimated_time_minutes": 30-60,
  "alternative_topics": [{"topic": "name", "subject": "name", "reason": "why"}]
}
Respond with ONLY valid JSON, no markdown, no explanation.`;
    const { text } = await openai.chat.completions.create({
      model: openai || 'llama-3.3-70b-versatile'),
      messages: [{ role: 'user', content: prompt }],
    });
    let recommendation;
    try {
      recommendation = JSON.parse(text.trim());
    } catch {
      recommendation = {
        recommended_topic: weakTopics?.[0]?.topic || 'General Practice',
        recommended_subject: weakTopics?.[0]?.subject || 'Mathematics',
        reason: 'Continue practicing to improve your weak areas',
        difficulty: 'medium',
        estimated_time_minutes: 30,
        alternative_topics: [],
      };
    return Response.json({
      success: true,
      recommendation,
      weak_topics_count: weakTopics?.length || 0,
      avg_scores: avgScores,
  } catch (error) {
    console.error('Error in adaptive learning API:', error);
    return Response.json({ error: 'Failed to get recommendation' }, { status: 500 });
  }
