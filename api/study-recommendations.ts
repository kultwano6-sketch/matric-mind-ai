import { getSupabase } from '../server/supabaseClient';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const maxDuration = 60;
export const runtime = 'edge';

interface StudyRecommendation {
  subject: string;
  topic: string;
  reason: string;
  priority: number;
}

/**
 * POST /api/study-recommendations
 * 
 * Reads student weaknesses and recent quiz results, generates
 * personalized study recommendations using Groq AI.
 * 
 * Body:
 * {
 *   student_id: string
 * }
 * 
 * Returns ordered list of (subject, topic, reason) sorted by priority.
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

    // Fetch student weaknesses
    const { data: weaknesses, error: weaknessError } = await supabase
      .from('student_weaknesses')
      .select('*')
      .eq('student_id', student_id)
      .order('mastery_pct', { ascending: true });

    if (weaknessError) {
      throw new Error(`Failed to fetch weaknesses: ${weaknessError.message}`);
    }

    // Fetch recent quiz results (last 10)
    const { data: quizResults, error: quizError } = await supabase
      .from('quiz_results')
      .select('*')
      .eq('student_id', student_id)
      .order('completed_at', { ascending: false })
      .limit(10);

    if (quizError) {
      throw new Error(`Failed to fetch quiz results: ${quizError.message}`);
    }

    // If no data, return default recommendations
    if (!weaknesses || weaknesses.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        recommendations: [
          {
            subject: 'mathematics',
            topic: 'Algebra',
            reason: 'Start with foundational algebra concepts to build a strong base.',
            priority: 1,
          },
          {
            subject: 'english_home_language',
            topic: 'Essay Writing',
            reason: 'Practice essay writing for better communication skills.',
            priority: 2,
          },
        ],
        message: 'No weakness data yet. Here are starter recommendations.',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Use Groq to generate prioritized recommendations
    const weaknessesText = weaknesses.map((w: any) => 
      `- ${w.subject} > ${w.topic}: ${w.mastery_pct}% mastery, ${w.error_count} errors out of ${w.total_attempts} attempts`
    ).join('\n');

    const quizTrend = quizResults && quizResults.length > 0
      ? quizResults.map((q: any) => `Score: ${q.score}% on ${q.subject} (${new Date(q.completed_at).toLocaleDateString()})`).join('\n')
      : 'No quiz history available.';

    const prompt = `You are a South African Matric study advisor for Matric Mind AI. Based on the student's data, generate prioritized study recommendations.

STUDENT WEAKNESSES:
${weaknessesText}

RECENT QUIZ RESULTS (newest first):
${quizTrend}

Generate 5-8 study recommendations. For each, provide:
- subject: the subject name (use the same format as in weaknesses)
- topic: the specific topic to study
- reason: a personalized, encouraging reason why this topic needs attention (1 sentence)
- priority: 1 (most urgent) to 10 (least urgent)

Consider:
1. Topics with lowest mastery get highest priority
2. Recurring weak topics across quizzes should be prioritized
3. Build from foundations - recommend foundational topics before advanced ones
4. Balance between subjects to avoid burnout

Return ONLY a JSON array of objects, no markdown fences:
[{"subject":"...", "topic":"...", "reason":"...", "priority": 1}, ...]`;

    const { text } = await generateText({
      model: groq('llama-3.1-8b-instant'),
      system: 'You are a JSON-only response system. Return valid JSON arrays only. No markdown, no explanation.',
      prompt,
      maxOutputTokens: 1024,
      temperature: 0.3,
    });

    // Parse AI response
    let recommendations: StudyRecommendation[] = [];
    try {
      // Clean any potential markdown fences
      const cleanedText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      recommendations = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse AI recommendations:', parseError);
      // Fallback: generate recommendations from weaknesses directly
      recommendations = (weaknesses as any[])
        .filter(w => w.mastery_pct < 70)
        .sort((a, b) => a.mastery_pct - b.mastery_pct)
        .slice(0, 8)
        .map((w, idx) => ({
          subject: w.subject,
          topic: w.topic,
          reason: `You scored ${w.mastery_pct}% on this topic. Practicing more will improve your understanding.`,
          priority: idx + 1,
        }));
    }

    // Save recommendations to database (clear old ones first)
    await supabase
      .from('study_recommendations')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('student_id', student_id)
      .is('dismissed_at', null);

    if (recommendations.length > 0) {
      const inserts = recommendations.map(rec => ({
        student_id,
        subject: rec.subject,
        topic: rec.topic,
        reason: rec.reason,
        priority: rec.priority,
      }));

      const { error: insertError } = await supabase
        .from('study_recommendations')
        .insert(inserts);

      if (insertError) {
        console.error('Error saving recommendations:', insertError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      recommendations,
      total_weaknesses: weaknesses.length,
      quizzes_analyzed: quizResults?.length || 0,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Study recommendations error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate study recommendations',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
