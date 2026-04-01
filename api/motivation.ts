import { getSupabase } from '../server/supabaseClient';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 30;
export const runtime = 'edge';

interface MotivationResponse {
  message: string;
  emoji: string;
  call_to_action: string;
  category: 'encouragement' | 'celebration' | 'push' | 'wisdom' | 'humour';
  streak_context?: string;
  performance_context?: string;
}

/**
 * POST /api/motivation
 *
 * Generates personalized motivation based on student's current state.
 *
 * Body:
 * {
 *   student_id: string,
 *   subject?: string
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
    const { student_id, subject } = body;

    if (!student_id) {
      return new Response(JSON.stringify({ error: 'Missing student_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get current time context
    const now = new Date();
    const hour = now.getHours();
    const timeOfDay = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
    const dayOfWeek = now.toLocaleDateString('en-ZA', { weekday: 'long' });

    // Fetch student's gamification state
    const { data: gamification } = await supabase
      .from('gamification_state')
      .select('xp, level, streak_days, last_activity')
      .eq('user_id', student_id)
      .single();

    const streak = gamification?.streak_days || 0;
    const level = gamification?.level || 1;
    const xp = gamification?.xp || 0;

    // Fetch recent quiz performance
    const { data: recentQuizzes } = await supabase
      .from('quiz_results')
      .select('score, subject, completed_at')
      .eq('student_id', student_id)
      .order('completed_at', { ascending: false })
      .limit(5);

    const recentScores = recentQuizzes?.map(q => Number(q.score)) || [];
    const avgRecent = recentScores.length > 0
      ? Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length)
      : null;
    const lastScore = recentScores.length > 0 ? recentScores[0] : null;

    // Determine performance trend
    let performanceTrend = 'neutral';
    if (recentScores.length >= 3) {
      const recent = recentScores.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
      const older = recentScores.slice(-2).reduce((a, b) => a + b, 0) / 2;
      if (recent - older > 10) performanceTrend = 'improving';
      else if (older - recent > 10) performanceTrend = 'declining';
    }

    // Check study sessions
    const { data: todaySessions } = await supabase
      .from('study_sessions')
      .select('duration_sec')
      .eq('student_id', student_id)
      .gte('started_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());

    const studyTodayMin = todaySessions
      ? Math.round(todaySessions.reduce((sum: number, s: any) => sum + (s.duration_sec || 0), 0) / 60)
      : 0;

    // ========================================
    // Generate Personalized Motivation with Groq
    // ========================================

    const contextPrompt = `You are a warm, encouraging Matric study coach for South African students.

Student Context:
- Streak: ${streak} days${streak >= 7 ? ' 🔥' : streak >= 3 ? ' ✨' : ''}
- Level: ${level}
- Total XP: ${xp}
- Today's study time: ${studyTodayMin} minutes
- Recent quiz average: ${avgRecent !== null ? `${avgRecent}%` : 'No data yet'}
- Last quiz score: ${lastScore !== null ? `${lastScore}%` : 'N/A'}
- Performance trend: ${performanceTrend}
- Time of day: ${timeOfDay}
- Day: ${dayOfWeek}
- Subject: ${subject || 'General'}
${lastScore !== null && lastScore >= 80 ? '- Recent excellent performance!' : ''}
${lastScore !== null && lastScore < 40 ? '- Recent scores need improvement' : ''}
${streak === 0 ? '- Currently no active streak' : ''}
${studyTodayMin === 0 ? '- Has not studied today yet' : studyTodayMin > 60 ? '- Has studied extensively today' : ''}

Generate a personalized motivation message. Return ONLY valid JSON:
{
  "message": "Personalized motivational message (2-3 sentences, conversational tone, reference South African context if appropriate)",
  "emoji": "Primary emoji (1-2 emojis)",
  "call_to_action": "Specific next step they should take right now (1 sentence)",
  "category": "encouragement | celebration | push | wisdom | humour"
}

Rules:
- Be genuine and specific (reference their actual data)
- ${streak >= 7 ? 'Celebrate their streak!' : streak >= 3 ? 'Acknowledge their growing streak.' : 'Encourage building a streak.'}
- ${performanceTrend === 'improving' ? 'Celebrate their improvement!' : ''}
- ${performanceTrend === 'declining' ? 'Be supportive about the decline, suggest reviewing weak areas.' : ''}
- ${studyTodayMin === 0 ? 'Encourage them to start studying today.' : ''}
- ${studyTodayMin > 60 ? 'Acknowledge their hard work today, remind them to take breaks.' : ''}
- ${timeOfDay === 'morning' ? 'Morning energy — encourage starting strong.' : ''}
- ${timeOfDay === 'evening' ? 'Evening — encourage a final push or winding down.' : ''}
- Keep it under 150 characters for the message
- Make it feel human, not robotic`;

    let motivation: MotivationResponse;

    try {
      const { text } = await generateText({
        model: groq('llama-3.1-8b-instant'),
        system: 'You are a motivational Matric study coach. Be warm, specific, and encouraging. Output ONLY valid JSON.',
        prompt: contextPrompt,
        maxOutputTokens: 256,
        temperature: 0.8,
      });

      // Parse response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      motivation = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);

      // Validate
      if (!motivation.message || !motivation.emoji) {
        throw new Error('Invalid response format');
      }
    } catch (aiError) {
      console.error('Motivation AI error:', aiError);
      // Fallback motivation
      motivation = getFallbackMotivation(streak, performanceTrend, timeOfDay, studyTodayMin, level);
    }

    // Enrich response with context
    const response = {
      success: true,
      ...motivation,
      context: {
        streak,
        level,
        xp,
        time_of_day: timeOfDay,
        study_today_min: studyTodayMin,
        recent_avg: avgRecent,
        performance_trend: performanceTrend,
        day_of_week: dayOfWeek,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Motivation error:', error);
    return new Response(JSON.stringify({
      success: true,
      message: "Every day is a new chance to learn something amazing. You've got this! 💪",
      emoji: '💪',
      call_to_action: 'Pick one topic and spend 20 minutes on it right now.',
      category: 'encouragement',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function getFallbackMotivation(
  streak: number,
  trend: string,
  timeOfDay: string,
  studyMin: number,
  level: number
): MotivationResponse {
  // Streak-based
  if (streak >= 14) {
    return {
      message: `${streak} days strong! You're building something incredible. Keep the fire burning!`,
      emoji: '🔥🔥',
      call_to_action: `You're on a roll — tackle that hardest topic while you're in the zone!`,
      category: 'celebration',
      streak_context: `${streak}-day streak`,
    };
  }

  if (streak >= 7) {
    return {
      message: `A whole week of consistency! ${streak} days and counting. Your future self will thank you.`,
      emoji: '⚡',
      call_to_action: 'Complete one more challenge today to keep the streak alive!',
      category: 'celebration',
      streak_context: `${streak}-day streak`,
    };
  }

  if (streak >= 3) {
    return {
      message: `3 days and going! Consistency is your superpower. Let's make it ${streak + 1}!`,
      emoji: '✨',
      call_to_action: 'Even 15 minutes of revision counts. Start now!',
      category: 'encouragement',
    };
  }

  // Trend-based
  if (trend === 'improving') {
    return {
      message: "Your scores are climbing! All that hard work is paying off. Keep pushing!",
      emoji: '📈',
      call_to_action: 'Ride this wave — do another practice quiz while you\'re on fire!',
      category: 'celebration',
      performance_context: 'Improving trend',
    };
  }

  if (trend === 'declining') {
    return {
      message: "Tough days happen to every champion. Review what went wrong and come back stronger.",
      emoji: '💪',
      call_to_action: 'Revisit the topics you got wrong — understanding mistakes is real progress.',
      category: 'encouragement',
    };
  }

  // Time-based
  if (studyMin === 0 && timeOfDay === 'morning') {
    return {
      message: "Good morning, future Matric! Start your day with a quick revision — it sets the tone for everything.",
      emoji: '🌅',
      call_to_action: 'Open your notes for just 10 minutes. Small starts lead to big results!',
      category: 'push',
    };
  }

  if (studyMin > 90) {
    return {
      message: `${Math.round(studyMin / 60 * 10) / 10} hours today — that's dedication! Remember to rest too.`,
      emoji: '🎓',
      call_to_action: 'Take a proper break. You\'ve earned it, and rest helps memory consolidation!',
      category: 'wisdom',
    };
  }

  // Level-based
  if (level >= 8) {
    return {
      message: `Level ${level} legend! You've proven you can do this. Stay focused on the final goal.`,
      emoji: '👑',
      call_to_action: 'Help a classmate with their work — teaching is the highest form of learning!',
      category: 'wisdom',
    };
  }

  // Default
  return {
    message: "Matric is a marathon, not a sprint. Every chapter you revise is a step closer to your dream career.",
    emoji: '📚',
    call_to_action: 'Pick your weakest subject and spend 20 focused minutes on it.',
    category: 'encouragement',
  };
}
