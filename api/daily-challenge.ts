// api/daily-challenge.ts — Daily challenge with caching

import type { Request, Response } from 'express';

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

// Pre-defined CAPS-aligned daily challenges (no API key needed)
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
      hints: ['Substitute x=3 into the quadratic expression', 'Remember order of operations: exponents first, then multiplication, then subtraction'],
    },
  },
  {
    subject: 'Mathematics',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'Solve for x: x² - 5x + 6 = 0',
      options: { A: 'x = 2 or x = 3', B: 'x = 1 or x = 6', C: 'x = -2 or x = -3', D: 'x = 3 or x = 4' },
      correct_answer: 'A',
      explanation: 'Factor the quadratic: (x-2)(x-3) = 0, so x = 2 or x = 3',
      hints: ['Look for two numbers that multiply to 6 and add to -5', 'The factors should be (x-a)(x-b) where a+b=5 and ab=6'],
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
      explanation: "Newton's Second Law states that F = ma (Force equals mass times acceleration)",
      hints: ['Think about what happens when you push a heavier object vs a lighter one', 'Force is what causes objects to accelerate'],
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
      explanation: 'Mitochondria are the "powerhouses" of the cell, producing ATP through cellular respiration',
      hints: ['Think about what the cell needs to function', 'This organelle is responsible for producing energy currency of the cell'],
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
      explanation: 'Personification gives human qualities to non-human things (wind whispering)',
      hints: ['Look for when non-human things are described as doing human actions', 'The wind cannot literally whisper - it is given human characteristics'],
    },
  },
  {
    subject: 'Accounting',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'What is the accounting equation?',
      options: { A: 'Assets = Liabilities + Capital', B: 'Assets + Liabilities = Capital', C: 'Assets = Capital - Liabilities', D: 'Capital = Assets + Liabilities' },
      correct_answer: 'A',
      explanation: 'The fundamental accounting equation is Assets = Liabilities + Equity (Capital)',
      hints: ['Think about what a balance sheet shows', 'Assets must equal liabilities plus owner equity'],
    },
  },
  {
    subject: 'Geography',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'What is the main cause of ocean currents?',
      options: { A: 'Earth rotation', B: 'Wind patterns', C: 'Tides', D: 'Volcanic activity' },
      correct_answer: 'B',
      explanation: 'Ocean currents are primarily driven by wind patterns and thermohaline circulation',
      hints: ['Think about surface movements of water', 'Temperature and salinity also play a role'],
    },
  },
  {
    subject: 'History',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'When did the United Nations (UN) officially come into existence?',
      options: { A: '1945', B: '1919', C: '1950', D: '1939' },
      correct_answer: 'A',
      explanation: 'The UN was officially founded on October 24, 1945, after World War II',
      hints: ['Think about the aftermath of World War II', 'The UN Charter was signed in San Francisco'],
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

    // Use pre-defined CAPS-aligned challenges (no AI needed)
    const challenges = FALLBACK_CHALLENGES.map((ch, i) => ({
      ...ch,
      id: `dc_${d}_${i}`,
      date: d,
    }));

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
