// api/daily-challenge.ts — Daily challenge with pre-defined CAPS-aligned questions

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

// Pre-defined CAPS-aligned daily challenges for all major Matric subjects
const CHALLENGES: Omit<Challenge, 'id' | 'date'>[] = [
  // Mathematics
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
      hints: ['Substitute x=3', 'Remember order of operations: exponents first'],
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
      explanation: 'Factor: (x-2)(x-3) = 0, so x = 2 or x = 3',
      hints: ['Find two numbers that multiply to 6 and add to -5'],
    },
  },
  // Mathematical Literacy
  {
    subject: 'Mathematical Literacy',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'A car travels 240km in 3 hours. What is the average speed?',
      options: { A: '60 km/h', B: '80 km/h', C: '120 km/h', D: '90 km/h' },
      correct_answer: 'B',
      explanation: 'Speed = Distance ÷ Time = 240 ÷ 3 = 80 km/h',
      hints: ['Use the formula: speed = distance/time'],
    },
  },
  // Physical Sciences
  {
    subject: 'Physical Sciences',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: "According to Newton's Second Law, what is F when m=2kg and a=5m/s²?",
      options: { A: '10N', B: '7N', C: '3N', D: '25N' },
      correct_answer: 'A',
      explanation: "F = ma = 2 × 5 = 10N",
      hints: ['Use F = ma formula', 'Multiply mass by acceleration'],
    },
  },
  {
    subject: 'Physical Sciences',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'What is the SI unit of electric current?',
      options: { A: 'Volt', B: 'Watt', C: 'Ampere', D: 'Ohm' },
      correct_answer: 'C',
      explanation: 'Electric current is measured in Amperes (A)',
      hints: ['Think about what flows in wires'],
    },
  },
  // Life Sciences
  {
    subject: 'Life Sciences',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'What is the primary function of mitochondria?',
      options: { A: 'DNA storage', B: 'Protein synthesis', C: 'Energy production', D: 'Cell division' },
      correct_answer: 'C',
      explanation: 'Mitochondria produce ATP - the cell\'s energy currency',
      hints: ['Think about what the cell needs to function'],
    },
  },
  {
    subject: 'Life Sciences',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'What is the process by which plants make their food?',
      options: { A: 'Respiration', B: 'Photosynthesis', C: 'Fermentation', D: 'Transpiration' },
      correct_answer: 'B',
      explanation: 'Photosynthesis converts CO₂ and sunlight into glucose and oxygen',
      hints: ['Think about what plants need from sunlight'],
    },
  },
  // Agricultural Sciences
  {
    subject: 'Agricultural Sciences',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'What is the main purpose of irrigation in agriculture?',
      options: { A: 'Weed control', B: 'Providing water to crops', C: 'Pest control', D: 'Soil aeration' },
      correct_answer: 'B',
      explanation: 'Irrigation provides water to crops, especially in dry periods',
      hints: ['Plants need water to grow'],
    },
  },
  // Accounting
  {
    subject: 'Accounting',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'What is the accounting equation?',
      options: { A: 'Assets = Liabilities + Capital', B: 'Assets + Liabilities = Capital', C: 'Assets = Capital - Liabilities', D: 'Capital = Assets + Liabilities' },
      correct_answer: 'A',
      explanation: 'Assets = Liabilities + Equity (Capital)',
      hints: ['Think about what a balance sheet shows'],
    },
  },
  // Business Studies
  {
    subject: 'Business Studies',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'What is the main purpose of a business plan?',
      options: { A: 'To get a tax rebate', B: 'To guide business operations', C: 'To hire employees', D: 'To register with SARS' },
      correct_answer: 'B',
      explanation: 'A business plan outlines goals, strategies, and operations',
      hints: ['Think about planning for success'],
    },
  },
  // Economics
  {
    subject: 'Economics',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'What is inflation?',
      options: { A: 'Decrease in prices', B: 'Rise in general price levels', C: 'Increase in unemployment', D: 'Decrease in money supply' },
      correct_answer: 'B',
      explanation: 'Inflation is the general rise in price levels over time',
      hints: ['Think about purchasing power'],
    },
  },
  // Geography
  {
    subject: 'Geography',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'What is the main cause of ocean currents?',
      options: { A: 'Earth rotation', B: 'Wind patterns', C: 'Tides', D: 'Volcanic activity' },
      correct_answer: 'B',
      explanation: 'Ocean currents are primarily driven by wind patterns',
      hints: ['Think about surface movements of water'],
    },
  },
  {
    subject: 'Geography',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'Which layer of the atmosphere contains weather?',
      options: { A: 'Troposphere', B: 'Stratosphere', C: 'Mesosphere', D: 'Thermosphere' },
      correct_answer: 'A',
      explanation: 'The Troposphere is the lowest layer and contains all weather',
      hints: ['Weather happens closest to Earth'],
    },
  },
  // History
  {
    subject: 'History',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'When did the United Nations officially come into existence?',
      options: { A: '1945', B: '1919', C: '1950', D: '1939' },
      correct_answer: 'A',
      explanation: 'The UN was founded on October 24, 1945',
      hints: ['Think about the aftermath of WWII'],
    },
  },
  {
    subject: 'History',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'What was the main cause of World War I?',
      options: { A: 'Trade wars', B: 'Assassination of Archduke Franz Ferdinand', C: 'Climate change', D: 'Space race' },
      correct_answer: 'B',
      explanation: 'The assassination triggered a chain of events leading to WWI',
      hints: ['Think about the spark that started the war'],
    },
  },
  // Life Orientation
  {
    subject: 'Life Orientation',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'What is a healthy way to manage stress?',
      options: { A: 'Ignoring it', B: 'Exercise and talking to others', C: 'Eating junk food', D: 'Sleeping less' },
      correct_answer: 'B',
      explanation: 'Exercise and social support help manage stress effectively',
      hints: ['Think about physical and emotional health'],
    },
  },
  // English Home Language
  {
    subject: 'English Home Language',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'Identify the figure of speech: "The wind whispered secrets"',
      options: { A: 'Simile', B: 'Metaphor', C: 'Personification', D: 'Hyperbole' },
      correct_answer: 'C',
      explanation: 'Personification gives human qualities to non-human things',
      hints: ['Wind cannot literally whisper'],
    },
  },
  {
    subject: 'English Home Language',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'Choose the correct sentence:',
      options: { A: 'Their going to the store', B: 'They\'re going to the store', C: 'There going to the store', D: 'Theyre going to the store' },
      correct_answer: 'B',
      explanation: '"They\'re" is the contraction of "they are"',
      hints: ['Look for the correct use of apostrophes'],
    },
  },
  // English First Additional Language
  {
    subject: 'English First Additional',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'Choose the correct form: "She ___ to the store yesterday"',
      options: { A: 'go', B: 'goes', C: 'went', D: 'going' },
      correct_answer: 'C',
      explanation: 'Use past tense "went" for actions yesterday',
      hints: ['Look for time words like "yesterday"'],
    },
  },
  // Afrikaans Home Language
  {
    subject: 'Afrikaans Home Language',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'Wat is die teenoorgestelde van "groot"?',
      options: { A: 'klein', B: 'snel', C: 'oud', D: 'nuut' },
      correct_answer: 'A',
      explanation: 'Die teenoorgestelde van "groot" is "klein"',
      hints: ['Dink aan die teenoorgestelde betekenis'],
    },
  },
  // isiZulu Home Language
  {
    subject: 'isiZulu Home Language',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'Yini ingcubeko yezwi elithi "ukushona"?',
      options: { A: 'ukusebenzela', B: 'ukuhlala', C: 'ukubheka phansi', D: 'ukuhamba' },
      correct_answer: 'C',
      explanation: 'Ukushona kusho ukubheka phansi noma ukusobala',
      hints: ['Funda ibanga elifanayo'],
    },
  },
  // Computer Applications Technology
  {
    subject: 'Computer Applications Technology',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'What does CPU stand for?',
      options: { A: 'Central Processing Unit', B: 'Computer Personal Unit', C: 'Central Program Utility', D: 'Computer Processing Unit' },
      correct_answer: 'A',
      explanation: 'CPU is the Central Processing Unit - the brain of the computer',
      hints: ['Think about what processes information'],
    },
  },
  // Tourism
  {
    subject: 'Tourism',
    type: 'mcq',
    difficulty: 2,
    xp_reward: 30,
    content: {
      question: 'What is a passport used for?',
      options: { A: 'ID for voting', B: 'International travel identification', C: 'Bank verification', D: 'Driver\'s license' },
      correct_answer: 'B',
      explanation: 'A passport is an official document for international travel',
      hints: ['Think about crossing borders'],
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

    // Use pre-defined CAPS-aligned challenges
    const challenges = CHALLENGES.map((ch, i) => ({
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
    console.error('Daily challenge error:', e);
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
