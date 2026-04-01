import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { getSupabase } from '../server/supabaseClient';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

interface ChallengeContent {
  question: string;
  options?: Record<string, string>;
  correct_answer: string;
  explanation: string;
  hints: string[];
}

const ACTIVE_SUBJECTS = [
  'mathematics', 'physical_sciences', 'life_sciences',
  'english_home_language', 'accounting', 'economics',
  'business_studies', 'geography', 'history',
];

const XP_REWARDS: Record<number, number> = { 1: 15, 2: 25, 3: 35, 4: 50, 5: 75 };

export default async function handler(req: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  if (req.method === 'GET') return handleGetChallenges(req, supabase);
  if (req.method === 'POST') return handleSubmitAnswer(req, supabase);
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
}

async function handleGetChallenges(_req: Request, supabase: ReturnType<typeof getSupabase>!) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase.from('daily_challenges').select('*').eq('date', today);
    let challenges = existing || [];

    if (challenges.length < ACTIVE_SUBJECTS.length * 2) {
      const subjectsToGenerate = ACTIVE_SUBJECTS.filter(s => challenges.filter((c: any) => c.subject === s).length < 2);
      for (const subject of subjectsToGenerate.slice(0, 5)) {
        for (const difficulty of [2, 4]) {
          if (challenges.some((c: any) => c.subject === subject && c.difficulty === difficulty)) continue;
          try {
            const challenge = await generateChallenge(subject, difficulty, today, supabase);
            if (challenge) challenges.push(challenge);
          } catch (e) { console.error(`Failed to generate for ${subject}:`, e); }
        }
      }
    }

    const formatted = challenges.map((c: any) => ({ id: c.id, subject: c.subject, type: c.challenge_type, difficulty: c.difficulty, xp_reward: c.xp_reward, date: c.date, content: c.content_json }));
    const grouped: Record<string, typeof formatted> = {};
    for (const c of formatted) { if (!grouped[c.subject]) grouped[c.subject] = []; grouped[c.subject].push(c); }

    return new Response(JSON.stringify({ success: true, date: today, challenges: formatted, grouped_by_subject: grouped, total_available: formatted.length, next_reset: getNextResetTime() }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Get challenges error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch challenges', message: error?.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleSubmitAnswer(req: Request, supabase: ReturnType<typeof getSupabase>!) {
  try {
    const body = await req.json();
    const { user_id, challenge_id, answer, time_taken_sec } = body;
    if (!user_id || !challenge_id || !answer) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: existing } = await supabase.from('challenge_completions').select('id, correct').eq('user_id', user_id).eq('challenge_id', challenge_id).single();
    if (existing) {
      return new Response(JSON.stringify({ error: 'Already completed', correct: existing.correct }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: challenge } = await supabase.from('daily_challenges').select('*').eq('id', challenge_id).single();
    if (!challenge) {
      return new Response(JSON.stringify({ error: 'Challenge not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const content = challenge.content_json as ChallengeContent;
    const correctAnswer = content.correct_answer?.toLowerCase().trim() || '';
    const userAnswer = answer.toLowerCase().trim();

    // Resolve correct answer: could be a key (A/B/C/D) or a value (text)
    let resolvedCorrect = correctAnswer;
    if (content.options) {
      // If correct_answer is a key like "A", resolve to the value
      for (const [k, v] of Object.entries(content.options)) {
        if (k.toLowerCase() === correctAnswer) {
          resolvedCorrect = (v as string).toLowerCase().trim();
          break;
        }
      }
    }

    // Check: user answer matches the resolved correct answer (by text value)
    const isCorrect = userAnswer === resolvedCorrect;

    let xpEarned = 0;
    if (isCorrect) {
      xpEarned = XP_REWARDS[challenge.difficulty] || 25;
      if (time_taken_sec && time_taken_sec < 30) xpEarned = Math.round(xpEarned * 1.5);

      const { data: gamification } = await supabase.from('gamification_state').select('xp, streak_days').eq('user_id', user_id).single();
      if (gamification) {
        await supabase.from('gamification_state').update({ xp: (gamification.xp || 0) + xpEarned, last_activity: new Date().toISOString() }).eq('user_id', user_id);
      }
    }

    await supabase.from('challenge_completions').insert({ user_id, challenge_id, answer, correct: isCorrect, time_taken_sec: time_taken_sec || null, xp_earned: xpEarned, completed_at: new Date().toISOString() });
    await supabase.from('activity_log').insert({ user_id, action: isCorrect ? 'daily_challenge_correct' : 'daily_challenge_incorrect', entity_type: 'daily_challenge', entity_id: challenge_id, metadata: { subject: challenge.subject, difficulty: challenge.difficulty, xp_earned: xpEarned } });

    return new Response(JSON.stringify({ success: true, correct: isCorrect, xp_earned: xpEarned, explanation: content.explanation, correct_answer: content.correct_answer, message: isCorrect ? `🎉 Correct! +${xpEarned} XP!` : '❌ Not quite. Check the explanation!' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Submit answer error:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit answer', message: error?.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function generateChallenge(subject: string, difficulty: number, date: string, supabase: ReturnType<typeof getSupabase>!) {
  const types = ['mcq', 'short_answer', 'problem_solving'] as const;
  const challengeType = types[Math.floor(Math.random() * types.length)];
  const labels: Record<number, string> = { 1: 'basic recall', 2: 'application', 3: 'analysis', 4: 'synthesis', 5: 'expert' };

  const prompt = `Create a South African CAPS Grade 12 ${subject} challenge. Difficulty: ${difficulty}/5 (${labels[difficulty]}). Type: ${challengeType}. ${challengeType === 'mcq' ? 'Include 4 options (A-D).' : ''} Return ONLY valid JSON: {"question":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"correct_answer":"...","explanation":"...","hints":["..."]}`;

  const { text } = await generateText({ model: groq('llama-3.1-8b-instant'), system: 'You are a CAPS exam creator. Output ONLY valid JSON.', prompt, maxOutputTokens: 512, temperature: 0.8 });

  let content: ChallengeContent;
  try { content = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || text); } catch { return null; }
  if (!content.question || !content.correct_answer) return null;

  const { data: saved, error } = await supabase.from('daily_challenges').upsert({ subject, challenge_type: challengeType, content_json: content, difficulty, xp_reward: XP_REWARDS[difficulty] || 25, date }, { onConflict: 'subject,date,challenge_type' }).select().single();
  if (error) { console.error('Save challenge error:', error); return null; }
  return saved;
}

function getNextResetTime(): string { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(0, 0, 0, 0); return t.toISOString(); }
