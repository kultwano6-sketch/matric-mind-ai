// api/daily-challenge.ts — Daily challenge with pre-defined CAPS questions

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

// Pre-defined CAPS-aligned daily challenges
const CHALLENGES: Omit<Challenge, 'id' | 'date'>[] = [
  { subject: 'Mathematics', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'If f(x) = 2x² - 3x + 1, what is f(3)?', options: { A: '10', B: '12', C: '14', D: '16' }, correct_answer: 'A', explanation: 'f(3) = 2(9) - 9 + 1 = 10', hints: ['Substitute x=3'] } },
  { subject: 'Mathematics', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'Solve for x: x² - 5x + 6 = 0', options: { A: 'x = 2 or x = 3', B: 'x = 1 or x = 6', C: 'x = -2 or x = -3', D: 'x = 3 or x = 4' }, correct_answer: 'A', explanation: 'Factor: (x-2)(x-3) = 0', hints: ['Find two numbers that multiply to 6'] } },
  { subject: 'Mathematical Literacy', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'A car travels 240km in 3 hours. What is the average speed?', options: { A: '60 km/h', B: '80 km/h', C: '120 km/h', D: '90 km/h' }, correct_answer: 'B', explanation: 'Speed = 240 ÷ 3 = 80 km/h', hints: ['Use speed = distance/time'] } },
  { subject: 'Physical Sciences', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: "According to Newton's Second Law, what is F when m=2kg and a=5m/s²?", options: { A: '10N', B: '7N', C: '3N', D: '25N' }, correct_answer: 'A', explanation: 'F = ma = 2 × 5 = 10N', hints: ['Use F = ma'] } },
  { subject: 'Physical Sciences', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'What is the SI unit of electric current?', options: { A: 'Volt', B: 'Watt', C: 'Ampere', D: 'Ohm' }, correct_answer: 'C', explanation: 'Current is measured in Amperes', hints: ['Think about what flows in wires'] } },
  { subject: 'Life Sciences', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'What is the primary function of mitochondria?', options: { A: 'DNA storage', B: 'Protein synthesis', C: 'Energy production', D: 'Cell division' }, correct_answer: 'C', explanation: 'Mitochondria produce ATP', hints: ['Think about cell energy'] } },
  { subject: 'Life Sciences', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'What is the process by which plants make their food?', options: { A: 'Respiration', B: 'Photosynthesis', C: 'Fermentation', D: 'Transpiration' }, correct_answer: 'B', explanation: 'Photosynthesis converts CO₂ to glucose', hints: ['Think about sunlight'] } },
  { subject: 'Agricultural Sciences', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'What is the main purpose of irrigation?', options: { A: 'Weed control', B: 'Providing water to crops', C: 'Pest control', D: 'Soil aeration' }, correct_answer: 'B', explanation: 'Irrigation provides water to crops', hints: ['Plants need water'] } },
  { subject: 'Accounting', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'What is the accounting equation?', options: { A: 'Assets = Liabilities + Capital', B: 'Assets + Liabilities = Capital', C: 'Assets = Capital - Liabilities', D: 'Capital = Assets + Liabilities' }, correct_answer: 'A', explanation: 'Assets = Liabilities + Equity', hints: ['Think balance sheet'] } },
  { subject: 'Business Studies', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'What is the main purpose of a business plan?', options: { A: 'Tax rebate', B: 'Guide operations', C: 'Hire employees', D: 'Register with SARS' }, correct_answer: 'B', explanation: 'Business plan outlines goals and strategies', hints: ['Think planning'] } },
  { subject: 'Economics', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'What is inflation?', options: { A: 'Decrease in prices', B: 'Rise in price levels', C: 'Increase in unemployment', D: 'Decrease in money supply' }, correct_answer: 'B', explanation: 'Inflation is general rise in prices', hints: ['Think purchasing power'] } },
  { subject: 'Geography', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'What is the main cause of ocean currents?', options: { A: 'Earth rotation', B: 'Wind patterns', C: 'Tides', D: 'Volcanic activity' }, correct_answer: 'B', explanation: 'Ocean currents driven by wind', hints: ['Think surface movements'] } },
  { subject: 'Geography', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'Which layer contains weather?', options: { A: 'Troposphere', B: 'Stratosphere', C: 'Mesosphere', D: 'Thermosphere' }, correct_answer: 'A', explanation: 'Troposphere contains all weather', hints: ['Weather closest to Earth'] } },
  { subject: 'History', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'When did the UN officially come into existence?', options: { A: '1945', B: '1919', C: '1950', D: '1939' }, correct_answer: 'A', explanation: 'UN founded Oct 24, 1945', hints: ['Think WWII aftermath'] } },
  { subject: 'History', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'What was the main cause of WWI?', options: { A: 'Trade wars', B: 'Assassination of Archduke', C: 'Climate change', D: 'Space race' }, correct_answer: 'B', explanation: 'Assassination triggered WWI', hints: ['Think spark'] } },
  { subject: 'Life Orientation', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'What is a healthy way to manage stress?', options: { A: 'Ignoring it', B: 'Exercise and talking', C: 'Eating junk food', D: 'Sleeping less' }, correct_answer: 'B', explanation: 'Exercise and social support help', hints: ['Think physical/emotional health'] } },
  { subject: 'English Home Language', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'Identify: "The wind whispered secrets"', options: { A: 'Simile', B: 'Metaphor', C: 'Personification', D: 'Hyperbole' }, correct_answer: 'C', explanation: 'Personification gives human traits to non-human', hints: ['Wind cannot whisper'] } },
  { subject: 'English Home Language', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'Choose: "She ___ yesterday"', options: { A: 'go', B: 'goes', C: 'went', D: 'going' }, correct_answer: 'C', explanation: 'Use past tense for yesterday', hints: ['Look for "yesterday"'] } },
  { subject: 'Computer Applications Technology', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'What does CPU stand for?', options: { A: 'Central Processing Unit', B: 'Computer Personal Unit', C: 'Central Program Utility', D: 'Computer Processing Unit' }, correct_answer: 'A', explanation: 'CPU is the brain of the computer', hints: ['Think processing'] } },
  { subject: 'Tourism', type: 'mcq', difficulty: 2, xp_reward: 30, content: { question: 'What is a passport used for?', options: { A: 'ID for voting', B: 'International travel', C: 'Bank verification', D: 'Driver license' }, correct_answer: 'B', explanation: 'Passport for international travel', hints: ['Think borders'] },
];

const cache: Record<string, { challenges: Challenge[]; next_reset: string }> = {};

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export default async function handler(req: Request, res: Response) {
  if (req.method === 'GET') {
    const d = today();
    const subjectsParam = req.url ? new URL(req.url, 'http://localhost').searchParams.get('subjects') : null;
    const todayCacheKey = `${d}_${subjectsParam || 'all'}`;
    
    if (cache[todayCacheKey]) {
      return Response.json(cache[todayCacheKey]);
    }

    const userSubjectsParam = subjectsParam || '';
    const userSubjects = userSubjectsParam ? userSubjectsParam.split(',').map((s: string) => s.trim().toLowerCase()) : [];

    let filteredChallenges: Challenge[];
    if (userSubjects.length > 0) {
      filteredChallenges = CHALLENGES.filter(ch => userSubjects.some(us => ch.subject.toLowerCase().includes(us) || us.includes(ch.subject.toLowerCase()))).map((ch, i) => ({ ...ch, id: `dc_${d}_${i}`, date: d }));
    } else {
      filteredChallenges = CHALLENGES.map((ch, i) => ({ ...ch, id: `dc_${d}_${i}`, date: d }));
    }

    const result = { challenges: filteredChallenges, next_reset: new Date(new Date(d).getTime() + 86400000).toISOString() };
    cache[todayCacheKey] = result;
    return Response.json(result);
  }
  
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { user_id, challenge_id, answer, time_taken_sec } = body;

      if (!user_id || !challenge_id || !answer) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const ch = cache[today()]?.challenges?.find((c) => c.id === challenge_id);
      if (!ch) {
        return Response.json({ error: 'Challenge not found' }, { status: 404 });
      }

      const ok = answer.toUpperCase() === (ch.content.correct_answer || '').toUpperCase();
      let xp = ok ? (ch.xp_reward || 20) : 5;
      if (ok && time_taken_sec && time_taken_sec < 60) xp = Math.round(xp * 1.5);

      return Response.json({ success: true, correct: ok, xp_earned: xp, explanation: ch.content.explanation, correct_answer: ch.content.correct_answer, message: ok ? 'Correct! Well done!' : 'Keep trying!' });
    } catch {
      return Response.json({ error: 'Submit failed' }, { status: 500 });
    }
  }
  
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
