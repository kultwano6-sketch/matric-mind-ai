// api/adaptive-learning.ts — AI-powered adaptive learning (FIXED: Uses Groq)

import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 30;
export const runtime = 'nodejs';

const FALLBACK_RECOMMENDATION = {
  recommended_topic: 'General Practice',
  recommended_subject: 'Mathematics',
  reason: 'Continue practicing to improve your weak areas',
  difficulty: 'medium',
  estimated_time_minutes: 30,
  alternative_topics: [],
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { student_id, subject } = await req.json();
    if (!student_id) {
      return new Response(JSON.stringify({ 
        error: 'Student ID required',
        recommendation: FALLBACK_RECOMMENDATION
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
      .eq('student_id', student_id)
      .order('completed_at', { ascending: false })
      .limit(10);

    // Calculate average score per subject
    const subjectScores: Record<string, number[]> = {};
    for (const quiz of recentQuizzes || []) {
      if (!subjectScores[quiz.subject]) subjectScores[quiz.subject] = [];
      subjectScores[quiz.subject].push(quiz.score);
    }

    const avgScores = Object.entries(subjectScores).map(([subj, scores]) => ({
      subject: subj,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));

    // Generate AI recommendation using Groq
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
Respond with ONLY valid JSON, no markdown.`;

    let recommendation = FALLBACK_RECOMMENDATION;
    
    if (process.env.GROQ_API_KEY) {
      try {
        const { text } = await generateText({
          model: groq('llama-3.3-70b-versatile'),
          messages: [{ role: 'user', content: prompt }],
          maxTokens: 500,
        });
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          recommendation = { ...FALLBACK_RECOMMENDATION, ...JSON.parse(jsonMatch[0]) };
        }
      } catch (aiError) {
        console.error('AI generation error:', aiError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      recommendation,
      weak_topics_count: weakTopics?.length || 0,
      avg_scores: avgScores,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in adaptive learning API:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get recommendation',
      recommendation: FALLBACK_RECOMMENDATION
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}