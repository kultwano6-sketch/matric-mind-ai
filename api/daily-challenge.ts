// api/daily-challenge.ts — Daily challenge with caching

import type { Request, Response } from 'express';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

// Initialize Groq with the API key
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

// Challenge interface
interface Challenge {
  id: string;
  subject: string;
  type: string;
  difficulty: number;
  xp_reward: number;
  date: string;
  content: {
    question: string;
    options: { A: string; B: string; C: string; D: string };
    correct_answer: string;
    explanation: string;
    hints: string[];
  };
}

// Fallback challenges (if API fails)
const FALLBACK_CHALLENGES: Omit<Challenge, 'id' | 'date'>[] = [
  {
    subject: 'Mathematics',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'If f(x) = 2x² - 3x + 1, what is f(3)?',
      options: { A: '10', B: '12', C: '14', D: '16' },
      correct_answer: 'A',
      explanation: 'f(3) = 2(3)² - 3(3) + 1 = 2(9) - 9 + 1 = 18 - 9 + 1 = 10',
      hints: ['Substitute x=3 into the quadratic expression', 'Remember order of operations'],
    },
  },
  {
    subject: 'Physical Sciences',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: "According to Newton's Second Law, what is the relationship between force, mass, and acceleration?",
      options: { A: 'F = m/a', B: 'F = ma', C: 'F = m + a', D: 'F = m²a' },
      correct_answer: 'B',
      explanation: "Newton's Second Law states that F = ma",
      hints: ['Think about what happens when you push a heavier object'],
    },
  },
  {
    subject: 'Life Sciences',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'What is the primary function of mitochondria in a cell?',
      options: { A: 'DNA storage', B: 'Protein synthesis', C: 'Energy production', D: 'Cell division' },
      correct_answer: 'C',
      explanation: 'Mitochondria are the "powerhouses" of the cell',
      hints: ['Think about what the cell needs to function'],
    },
  },
  {
    subject: 'English',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'Identify the figure of speech in: "The wind whispered secrets to the trees."',
      options: { A: 'Simile', B: 'Metaphor', C: 'Personification', D: 'Hyperbole' },
      correct_answer: 'C',
      explanation: 'Personification gives human qualities to non-human things',
      hints: ['Look for when non-human things are described as doing human actions'],
    },
  },
];

const cache: Record<string, { challenges: Challenge[]; next_reset: string }> = {};

function today(): string {
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
    const d = today();
    if (cache[d]) {
      return res.json(cache[d]);
    }

    const subjects = ['Mathematics', 'Physical Sciences', 'Life Sciences', 'English', 'Accounting', 'Geography'];
    const challenges: Challenge[] = [];

    // Try to generate with AI first
    const hasApiKey = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('gsk_');
    
    if (hasApiKey) {
      for (let i = 0; i < subjects.length; i++) {
        try {
          const { text } = await generateText({
            model: groq('llama-3.3-70b-versatile'),
            system: `Generate a South African CAPS Grade 12 curriculum-aligned daily challenge for ${subjects[i]}. 
Questions must follow NSC exam standards.
Return ONLY valid JSON with keys: question, options (A-D), correct_answer, explanation, hints (array), difficulty (1-4).
Example: {"question":"Q","options":{"A":"a","B":"b","C":"c","D":"d"},"correct_answer":"A","explanation":"Why","hints":["hint"],"difficulty":2}`,
            prompt: `Generate a daily challenge for ${subjects[i]}. Make sure options are plausible distractors.`,
            maxTokens: 1024,
            temperature: 0.8,
          });

          const obj = JSON.parse(text.replace(/```json\s?|\s?```/g, '').trim());
          challenges.push({
            id: `dc_${d}_${i}`,
            subject: subjects[i],
            type: 'mcq',
            difficulty: obj.difficulty || 2,
            xp_reward: (obj.difficulty || 2) * 15,
            date: d,
            content: {
              question: obj.question,
              options: obj.options,
              correct_answer: obj.correct_answer,
              explanation: obj.explanation,
              hints: obj.hints || [],
            },
          });
        } catch (e) {
          console.error('Challenge generation error:', e);
        }
      }
    }

    // If AI generation failed or no API key, use fallbacks
    if (challenges.length === 0) {
      challenges.push(...FALLBACK_CHALLENGES.map((ch, i) => ({
        ...ch,
        id: `dc_${d}_${i}`,
        date: d,
      })));
    }

    const result = {
      challenges,
      next_reset: new Date(new Date(d).getTime() + 86400000).toISOString(),
    };
    cache[d] = result;
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to get challenges' });
  }
}

async function submitAnswer(req: Request, res: Response) {
  try {
    const { user_id, challenge_id, answer, time_taken_sec } = req.body;

    if (!user_id || !challenge_id || !answer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const ch = cache[today()]?.challenges?.find((c) => c.id === challenge_id);
    if (!ch) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const ok = answer.toUpperCase() === (ch.content.correct_answer || '').toUpperCase();
    let xp = ok ? (ch.xp_reward || 20) : 5;
    if (ok && time_taken_sec && time_taken_sec < 60) {
      xp = Math.round(xp * 1.5);
    }

    return res.json({
      success: true,
      correct: ok,
      xp_earned: xp,
      explanation: ch.content.explanation,
      correct_answer: ch.content.correct_answer,
      message: ok ? 'Correct! Well done!' : 'Keep trying!',
    });
  } catch (e) {
    return res.status(500).json({ error: 'Submit failed' });
  }
}
