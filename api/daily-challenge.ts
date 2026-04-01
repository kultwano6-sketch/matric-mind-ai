import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const maxDuration = 60;
export const runtime = 'edge';

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

/**
 * GET /api/daily-challenge
 * Returns today's challenges (3 per active subject)
 *
 * POST /api/daily-challenge
 * Submits a challenge answer, checks correctness, awards XP
 *
 * Body: { user_id, challenge_id, answer, time_taken_sec? }
 */
export default async function handler(req: Request) {
  if (req.method === 'GET') {
    return handleGetChallenges(req);
  } else if (req.method === 'POST') {
    return handleSubmitAnswer(req);
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetChallenges(_req: Request) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Check if challenges already exist for today
    const { data: existing } = await supabase
      .from('daily_challenges')
      .select('*')
      .eq('date', today);

    let challenges = existing || [];

    // Generate missing challenges if needed
    if (challenges.length < ACTIVE_SUBJECTS.length * 2) {
      const subjectsToGenerate = ACTIVE_SUBJECTS.filter(subject => {
        const subjectChallenges = challenges.filter((c: any) => c.subject === subject);
        return subjectChallenges.length < 2;
      });

      for (const subject of subjectsToGenerate.slice(0, 5)) {
        // Generate 2 challenges per subject (to limit API calls)
        for (const difficulty of [2, 4]) {
          const existingForSubject = challenges.filter(
            (c: any) => c.subject === subject && c.difficulty === difficulty
          );
          if (existingForSubject.length > 0) continue;

          try {
            const challenge = await generateChallenge(subject, difficulty, today);
            if (challenge) {
              challenges.push(challenge);
            }
          } catch (genError) {
            console.error(`Failed to generate challenge for ${subject}:`, genError);
          }
        }
      }
    }

    // Format challenges for response
    const formattedChallenges = challenges.map((c: any) => ({
      id: c.id,
      subject: c.subject,
      type: c.challenge_type,
      difficulty: c.difficulty,
      xp_reward: c.xp_reward,
      date: c.date,
      content: c.content_json,
    }));

    // Group by subject
    const grouped: Record<string, typeof formattedChallenges> = {};
    for (const c of formattedChallenges) {
      if (!grouped[c.subject]) grouped[c.subject] = [];
      grouped[c.subject].push(c);
    }

    return new Response(JSON.stringify({
      success: true,
      date: today,
      challenges: formattedChallenges,
      grouped_by_subject: grouped,
      total_available: formattedChallenges.length,
      next_reset: getNextResetTime(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Get challenges error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch challenges',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function handleSubmitAnswer(req: Request) {
  try {
    const body = await req.json();
    const { user_id, challenge_id, answer, time_taken_sec } = body;

    if (!user_id || !challenge_id || !answer) {
      return new Response(JSON.stringify({ error: 'Missing user_id, challenge_id, or answer' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check for duplicate submission
    const { data: existing } = await supabase
      .from('challenge_completions')
      .select('id, correct')
      .eq('user_id', user_id)
      .eq('challenge_id', challenge_id)
      .single();

    if (existing) {
      return new Response(JSON.stringify({
        error: 'Already completed',
        correct: existing.correct,
        message: 'You have already attempted this challenge.',
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch the challenge
    const { data: challenge, error: challengeError } = await supabase
      .from('daily_challenges')
      .select('*')
      .eq('id', challenge_id)
      .single();

    if (challengeError || !challenge) {
      return new Response(JSON.stringify({ error: 'Challenge not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const content = challenge.content_json as ChallengeContent;
    const correctAnswer = content.correct_answer?.toLowerCase().trim() || '';
    const userAnswer = answer.toLowerCase().trim();
    const isCorrect = userAnswer === correctAnswer ||
      (content.options && Object.entries(content.options).some(
        ([key, val]) => key.toLowerCase() === userAnswer &&
          (val as string).toLowerCase().trim() === correctAnswer
      ));

    // Calculate XP earned
    let xpEarned = 0;
    if (isCorrect) {
      xpEarned = XP_REWARDS[challenge.difficulty] || 25;

      // Bonus for speed (under 30 seconds)
      if (time_taken_sec && time_taken_sec < 30) {
        xpEarned = Math.round(xpEarned * 1.5);
      }

      // Update gamification state
      const { data: gamification } = await supabase
        .from('gamification_state')
        .select('xp, streak_days')
        .eq('user_id', user_id)
        .single();

      if (gamification) {
        await supabase
          .from('gamification_state')
          .update({
            xp: (gamification.xp || 0) + xpEarned,
            last_activity: new Date().toISOString(),
          })
          .eq('user_id', user_id);
      }
    }

    // Save completion
    const { error: completionError } = await supabase
      .from('challenge_completions')
      .insert({
        user_id,
        challenge_id,
        answer,
        correct: isCorrect,
        time_taken_sec: time_taken_sec || null,
        xp_earned: xpEarned,
        completed_at: new Date().toISOString(),
      });

    if (completionError) {
      console.error('Save completion error:', completionError);
    }

    // Log activity
    await supabase
      .from('activity_log')
      .insert({
        user_id,
        action: isCorrect ? 'daily_challenge_correct' : 'daily_challenge_incorrect',
        entity_type: 'daily_challenge',
        entity_id: challenge_id,
        metadata: {
          subject: challenge.subject,
          difficulty: challenge.difficulty,
          xp_earned: xpEarned,
          time_taken: time_taken_sec,
        },
      });

    return new Response(JSON.stringify({
      success: true,
      correct: isCorrect,
      xp_earned: xpEarned,
      explanation: content.explanation,
      correct_answer: content.correct_answer,
      time_taken: time_taken_sec,
      message: isCorrect
        ? `🎉 Correct! You earned ${xpEarned} XP!`
        : '❌ Not quite right. Check the explanation to learn!',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Submit answer error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to submit answer',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function generateChallenge(subject: string, difficulty: number, date: string): Promise<any | null> {
  const challengeTypes = ['mcq', 'short_answer', 'problem_solving'] as const;
  const challengeType = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];

  const difficultyLabels: Record<number, string> = {
    1: 'basic recall',
    2: 'application',
    3: 'analysis',
    4: 'synthesis',
    5: 'expert evaluation',
  };

  const prompt = `Create a South African CAPS curriculum daily challenge for Grade 12 ${subject}.

Difficulty: ${difficulty}/5 (${difficultyLabels[difficulty] || 'standard'})
Type: ${challengeType === 'mcq' ? 'Multiple Choice' : challengeType === 'short_answer' ? 'Short Answer' : 'Problem Solving'}

${challengeType === 'mcq' ? `
Create a multiple choice question with 4 options (A, B, C, D).` : `
Create a question that requires a written response.`}

IMPORTANT: Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "question": "The question text here",
  ${challengeType === 'mcq' ? `"options": { "A": "First option", "B": "Second option", "C": "Third option", "D": "Fourth option" },` : ''}
  "correct_answer": "${challengeType === 'mcq' ? 'A' : 'The complete correct answer text'}",
  "explanation": "Why this answer is correct, with relevant CAPS concepts",
  "hints": ["Hint 1", "Hint 2"]
}

The question should be:
- Realistic for Grade 12 exams
- Test a specific concept from the CAPS syllabus
- Have clear, unambiguous answers${challengeType === 'mcq' ? `
- Have one clearly correct option and three plausible distractors` : ''}`;

  const { text } = await generateText({
    model: groq('llama-3.1-8b-instant'),
    system: 'You are a South African CAPS exam creator. Output ONLY valid JSON. No markdown, no explanation outside JSON.',
    prompt,
    maxOutputTokens: 512,
    temperature: 0.8,
  });

  // Parse response
  let content: ChallengeContent;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    content = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
  } catch {
    console.error('Failed to parse challenge JSON for', subject);
    return null;
  }

  // Validate required fields
  if (!content.question || !content.correct_answer) {
    return null;
  }

  // Save to database
  const { data: saved, error } = await supabase
    .from('daily_challenges')
    .insert({
      subject,
      challenge_type: challengeType,
      content_json: content,
      difficulty,
      xp_reward: XP_REWARDS[difficulty] || 25,
      date,
    })
    .select()
    .single();

  if (error) {
    console.error('Save challenge error:', error);
    return null;
  }

  return saved;
}

function getNextResetTime(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}
