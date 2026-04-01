import { getSupabase } from '../server/supabaseClient';


export const maxDuration = 30;
export const runtime = 'edge';

interface DifficultyRecommendation {
  recommended_difficulty: number;
  challenge_level: 'easy' | 'medium' | 'hard' | 'expert';
  topic_focus_areas: string[];
  reasoning: string;
  xp_multiplier: number;
}

/**
 * POST /api/dynamic-difficulty
 *
 * Adjusts quiz difficulty based on student performance patterns.
 * Uses streak data, recent scores, and topic mastery to recommend
 * the optimal challenge level.
 *
 * Body:
 * {
 *   student_id: string,
 *   subject: string,
 *   recent_scores?: number[],
 *   current_streak?: number
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
    const body = await req.json();
    const { student_id, subject, recent_scores, current_streak } = body;

    if (!student_id || !subject) {
      return new Response(JSON.stringify({ error: 'Missing student_id or subject' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch recent quiz results if scores not provided
    let scores = recent_scores;
    if (!scores || !Array.isArray(scores)) {
      const { data: quizResults } = await supabase
        .from('quiz_results')
        .select('score')
        .eq('student_id', student_id)
        .eq('subject', subject)
        .order('completed_at', { ascending: false })
        .limit(10);

      scores = quizResults?.map(q => Number(q.score)) || [];
    }

    // Fetch streak data if not provided
    let streak = current_streak;
    if (streak === undefined || streak === null) {
      const { data: gamification } = await supabase
        .from('gamification_state')
        .select('streak_days')
        .eq('user_id', student_id)
        .single();

      streak = gamification?.streak_days || 0;
    }

    // Fetch weakness data for topic focus areas
    const { data: weaknesses } = await supabase
      .from('student_weaknesses')
      .select('topic, mastery_pct, error_count')
      .eq('student_id', student_id)
      .eq('subject', subject)
      .order('mastery_pct', { ascending: true });

    const weakTopics = (weaknesses || [])
      .filter(w => Number(w.mastery_pct) < 60)
      .slice(0, 5)
      .map(w => w.topic);

    // Calculate performance metrics
    const avgScore = scores.length > 0
      ? scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length
      : 50;

    const recentTrend = scores.length >= 3
      ? (scores.slice(0, 3).reduce((s: number, v: number) => s + v, 0) / 3) -
        (scores.slice(-3).reduce((s: number, v: number) => s + v, 0) / 3)
      : 0;

    // Calculate consistency (how stable are the scores)
    const consistency = scores.length >= 2
      ? 1 - Math.min(1, standardDeviation(scores) / 30)
      : 0.5;

    // ========================================
    // Difficulty Calculation Algorithm
    // ========================================
    // Base difficulty from average score
    let difficulty = Math.round(avgScore / 20); // 0-5 range

    // Adjust for streak (positive streak = harder questions)
    if (streak >= 7) difficulty += 0.5;
    if (streak >= 14) difficulty += 0.5;
    if (streak >= 30) difficulty += 0.5;

    // Adjust for trend (improving = harder)
    if (recentTrend > 10) difficulty += 0.5;
    if (recentTrend < -10) difficulty -= 0.5;

    // Adjust for consistency (consistent high = harder)
    if (consistency > 0.8 && avgScore > 70) difficulty += 0.5;

    // Clamp to 1-5
    difficulty = Math.max(1, Math.min(5, Math.round(difficulty)));

    // Map to challenge level
    const challengeLevels: Array<'easy' | 'medium' | 'hard' | 'expert'> = [
      'easy', 'easy', 'medium', 'medium', 'hard', 'expert'
    ];
    const challengeLevel = challengeLevels[Math.round(difficulty)];

    // XP multiplier based on difficulty
    const xpMultipliers: Record<number, number> = { 1: 0.8, 2: 1.0, 3: 1.2, 4: 1.5, 5: 2.0 };
    const xpMultiplier = xpMultipliers[Math.round(difficulty)] || 1.0;

    // Generate reasoning
    const reasons: string[] = [];
    if (avgScore > 80) reasons.push(`Strong performance (${Math.round(avgScore)}% average)`);
    if (avgScore < 40) reasons.push(`Needs practice (${Math.round(avgScore)}% average)`);
    if (streak >= 7) reasons.push(`${streak}-day streak shows great consistency`);
    if (recentTrend > 10) reasons.push('Scores trending upward');
    if (recentTrend < -10) reasons.push('Scores declining — taking it easier');
    if (weakTopics.length > 0) reasons.push(`Focus areas: ${weakTopics.slice(0, 3).join(', ')}`);

    const recommendation: DifficultyRecommendation = {
      recommended_difficulty: Math.round(difficulty),
      challenge_level: challengeLevel,
      topic_focus_areas: weakTopics.length > 0 ? weakTopics : ['Review general topics'],
      reasoning: reasons.length > 0 ? reasons.join('. ') + '.' : 'Starting with balanced difficulty.',
      xp_multiplier: xpMultiplier,
    };

    // Store the recommendation for analytics
    await supabase
      .from('study_recommendations')
      .upsert({
        student_id,
        subject,
        recommendation_type: 'difficulty',
        recommendation_json: recommendation as any,
        generated_at: new Date().toISOString(),
      }, {
        onConflict: 'student_id,subject,recommendation_type',
      });

    return new Response(JSON.stringify({
      success: true,
      ...recommendation,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Dynamic difficulty error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to calculate difficulty',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function standardDeviation(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  return Math.sqrt(variance);
}
