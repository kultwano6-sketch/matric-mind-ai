// api/daily-challenge.ts — Daily challenge generation & submission
import type { Request, Response } from 'express';
import { groq, GROQ_MODEL } from '../server/production.js';

// In-memory challenge cache (resets on server restart — use DB for persistence)
const challengeCache: Record<string, any> = {};

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export default async function handler(req: Request, res: Response) {
  if (req.method === 'GET') {
    return getChallenges(req, res);
  }
  if (req.method === 'POST') {
    return submitAnswer(req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function getChallenges(_req: Request, res: Response) {
  try {
    const today = getTodayKey();
    const subjects = ['Mathematics', 'Physical Sciences', 'Life Sciences', 'English'];

    // Check cache
    if (challengeCache[today]) {
      return res.json(challengeCache[today]);
    }

    // Generate challenges for each subject
    const challenges = [];
    for (let i = 0; i < subjects.length; i++) {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `Generate a single daily challenge for South African matric ${subjects[i]}.
Return ONLY valid JSON:
{
  "question": "The question",
  "options": {"A": "opt1", "B": "opt2", "C": "opt3", "D": "opt4"},
  "correct_answer": "A",
  "explanation": "Why this is correct",
  "hints": ["hint1", "hint2"],
  "difficulty": 2
}
No markdown, no backticks.`,
          },
        ],
        model: GROQ_MODEL,
        max_tokens: parseInt(process.env.GROQ_MAX_TOKENS || '1024', 10),
        temperature: 0.8,
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        try {
          const cleaned = content.replace(/```json\s?|\s?```/g, '').trim();
          const challengeData = JSON.parse(cleaned);
          challenges.push({
            id: `challenge_${today}_${i}`,
            subject: subjects[i],
            type: 'mcq',
            difficulty: challengeData.difficulty || 2,
            xp_reward: (challengeData.difficulty || 2) * 15,
            date: today,
            content: {
              question: challengeData.question,
              options: challengeData.options,
              correct_answer: challengeData.correct_answer,
              explanation: challengeData.explanation,
              hints: challengeData.hints || [],
            },
          });
        } catch (e) {
          console.error(`Failed to parse challenge for ${subjects[i]}:`, e);
        }
      }
    }

    const response = {
      challenges,
      next_reset: new Date(
        new Date(today).getTime() + 24 * 60 * 60 * 1000
      ).toISOString(),
    };

    challengeCache[today] = response;
    res.json(response);
  } catch (error: any) {
    console.error('Daily Challenge API Error:', error);
    res.status(500).json({
      error: 'Failed to generate challenges',
      message: error?.message || 'Unknown error',
    });
  }
}

async function submitAnswer(req: Request, res: Response) {
  const { user_id, challenge_id, answer, time_taken_sec } = req.body;

  if (!user_id || !challenge_id || !answer) {
    return res.status(400).json({ error: 'user_id, challenge_id, and answer are required' });
  }

  try {
    const today = getTodayKey();
    const todayChallenges = challengeCache[today]?.challenges || [];
    const challenge = todayChallenges.find((c: any) => c.id === challenge_id);

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const isCorrect =
      answer.toUpperCase() === (challenge.content.correct_answer || '').toUpperCase();

    // Calculate XP
    let xpEarned = 0;
    if (isCorrect) {
      xpEarned = challenge.xp_reward || 20;
      // Time bonus
      if (time_taken_sec && time_taken_sec < 60) {
        xpEarned = Math.round(xpEarned * 1.5);
      }
    } else {
      xpEarned = 5; // participation XP
    }

    res.json({
      success: true,
      correct: isCorrect,
      xp_earned: xpEarned,
      explanation: challenge.content.explanation || '',
      correct_answer: challenge.content.correct_answer,
      message: isCorrect ? 'Correct! Well done!' : 'Not quite right. Keep practising!',
    });
  } catch (error: any) {
    console.error('Submit Answer Error:', error);
    res.status(500).json({
      error: 'Failed to submit answer',
      message: error?.message || 'Unknown error',
    });
  }
}
