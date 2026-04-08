// api/daily-challenge.ts - Simple daily challenges

const challenges = [
  { s: 'Mathematics', q: 'If f(x) = 2x^2 - 3x + 1, what is f(3)?', o: { A: '10', B: '12', C: '14', D: '16' }, a: 'A', e: 'f(3) = 2(9) - 9 + 1 = 10' },
  { s: 'Mathematics', q: 'Solve for x: x^2 - 5x + 6 = 0', o: { A: 'x = 2 or x = 3', B: 'x = 1 or x = 6', C: 'x = -2 or x = -3', D: 'x = 3 or x = 4' }, a: 'A', e: 'Factor: (x-2)(x-3) = 0' },
  { s: 'Mathematical Literacy', q: 'A car travels 240km in 3 hours. What is speed?', o: { A: '60 km/h', B: '80 km/h', C: '120 km/h', D: '90 km/h' }, a: 'B', e: 'Speed = 240 / 3 = 80 km/h' },
  { s: 'Physical Sciences', q: 'What is F when m=2kg and a=5m/s^2?', o: { A: '10N', B: '7N', C: '3N', D: '25N' }, a: 'A', e: 'F = ma = 2 * 5 = 10N' },
  { s: 'Physical Sciences', q: 'What is the SI unit of electric current?', o: { A: 'Volt', B: 'Watt', C: 'Ampere', D: 'Ohm' }, a: 'C', e: 'Current in Amperes' },
  { s: 'Life Sciences', q: 'What is the primary function of mitochondria?', o: { A: 'DNA storage', B: 'Protein synthesis', C: 'Energy production', D: 'Cell division' }, a: 'C', e: 'Mitochondria produce ATP' },
  { s: 'Life Sciences', q: 'What process do plants use to make food?', o: { A: 'Respiration', B: 'Photosynthesis', C: 'Fermentation', D: 'Transpiration' }, a: 'B', e: 'Photosynthesis converts CO2' },
  { s: 'Accounting', q: 'What is the accounting equation?', o: { A: 'Assets = Liabilities + Capital', B: 'Assets + Liabilities = Capital', C: 'Assets = Capital - Liabilities', D: 'Capital = Assets + Liabilities' }, a: 'A', e: 'Assets = Liabilities + Equity' },
  { s: 'Business Studies', q: 'What is the purpose of a business plan?', o: { A: 'Tax rebate', B: 'Guide operations', C: 'Hire employees', D: 'Register with SARS' }, a: 'B', e: 'Business plan outlines goals' },
  { s: 'Economics', q: 'What is inflation?', o: { A: 'Decrease in prices', B: 'Rise in price levels', C: 'Increase in unemployment', D: 'Decrease in money supply' }, a: 'B', e: 'Inflation is general rise in prices' },
  { s: 'Geography', q: 'What causes ocean currents?', o: { A: 'Earth rotation', B: 'Wind patterns', C: 'Tides', D: 'Volcanic activity' }, a: 'B', e: 'Ocean currents driven by wind' },
  { s: 'History', q: 'When did the UN come into existence?', o: { A: '1945', B: '1919', C: '1950', D: '1939' }, a: 'A', e: 'UN founded 1945' },
  { s: 'English Home Language', q: 'Identify: The wind whispered secrets', o: { A: 'Simile', B: 'Metaphor', C: 'Personification', D: 'Hyperbole' }, a: 'C', e: 'Personification gives human traits' },
  { s: 'Computer Applications Technology', q: 'What does CPU stand for?', o: { A: 'Central Processing Unit', B: 'Computer Personal Unit', C: 'Central Program Utility', D: 'Computer Processing Unit' }, a: 'A', e: 'CPU is the brain of computer' },
  { s: 'Tourism', q: 'What is a passport used for?', o: { A: 'ID for voting', B: 'International travel', C: 'Bank verification', D: 'Driver license' }, a: 'B', e: 'Passport for international travel' }
];
const cache = {};
function today() {
  return new Date().toISOString().split('T')[0];
}
export default async function handler(req: Request) {
  if (req.method === 'GET') {
    const d = today();
    const url = new URL(req.url, 'http://localhost');
    const subjectsParam = url.searchParams.get('subjects');
    const cacheKey = d + '_' + (subjectsParam || 'all');
    
    if (cache[cacheKey]) {
      return Response.json(cache[cacheKey]);
    }
    const result = {
      challenges: challenges.map((ch, i) => ({
        id: 'dc_' + d + '_' + i,
        subject: ch.s,
        type: 'mcq',
        difficulty: 2,
        xp_reward: 30,
        date: d,
        content: { question: ch.q, options: ch.o, correct_answer: ch.a, explanation: ch.e, hints: [] }
      })),
      next_reset: new Date(new Date(d).getTime() + 86400000).toISOString()
    };
    cache[cacheKey] = result;
    return Response.json(result);
  }
  
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { challenge_id, answer } = body;
      if (!challenge_id || !answer) {
        return Response.json({ error: 'Missing fields' }, { status: 400 });
      }
      const ch = challenges.find((c, i) => 'dc_' + today() + '_' + i === challenge_id);
      if (!ch) {
        return Response.json({ error: 'Challenge not found' }, { status: 404 });
      const ok = answer.toUpperCase() === ch.a.toUpperCase();
      return Response.json({ 
        success: true, 
        correct: ok, 
        xp_earned: ok ? 30 : 5, 
        explanation: ch.e, 
        correct_answer: ch.a,
        message: ok ? 'Correct!' : 'Keep trying!'
      });
    } catch {
      return Response.json({ error: 'Submit failed' }, { status: 500 });
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
