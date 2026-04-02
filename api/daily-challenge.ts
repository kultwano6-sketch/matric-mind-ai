import { createGroq } from '@ai-sdk/groq'
import { generateText } from 'ai'
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
const cache: Record<string, any> = {}
function today(): string { return new Date().toISOString().split('T')[0] }
export default async function handler(req: Request) {
  if (req.method === 'GET') return getChallenges()
  if (req.method === 'POST') return submitAnswer(req)
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
}
async function getChallenges() {
  try {
    const d = today()
    if (cache[d]) return new Response(JSON.stringify(cache[d]))
    const subjects = ['Mathematics', 'Physical Sciences', 'Life Sciences', 'English']
    const challenges: any[] = []
    for (let i = 0; i < subjects.length; i++) {
      try {
        const { text } = await generateText({ model: groq('llama-3.3-70b-versatile'), system: `Generate a daily challenge for matric ${subjects[i]}. Return ONLY JSON: {"question":"Q","options":{"A":"a","B":"b","C":"c","D":"d"},"correct_answer":"A","explanation":"Why","hints":["h"],"difficulty":2}`, prompt: `Generate a daily challenge for ${subjects[i]}.`, maxTokens: 1024, temperature: 0.8 })
        const obj = JSON.parse(text.replace(/```json\s?|\s?```/g, '').trim())
        challenges.push({ id: `dc_${d}_${i}`, subject: subjects[i], type: 'mcq', difficulty: obj.difficulty || 2, xp_reward: (obj.difficulty || 2) * 15, date: d, content: { question: obj.question, options: obj.options, correct_answer: obj.correct_answer, explanation: obj.explanation, hints: obj.hints || [] } })
      } catch (e) { console.error('Challenge parse:', e) }
    }
    const r = { challenges, next_reset: new Date(new Date(d).getTime() + 86400000).toISOString() }
    cache[d] = r; return new Response(JSON.stringify(r))
  } catch (e) { return new Response(JSON.stringify({ error: 'Failed' }), { status: 500 }) }
}
async function submitAnswer(req: Request) {
  try {
    const { user_id, challenge_id, answer, time_taken_sec } = await req.json()
    if (!user_id || !challenge_id || !answer) return new Response(JSON.stringify({ error: 'Missing' }), { status: 400 })
    const ch = cache[today()]?.challenges?.find((c: any) => c.id === challenge_id)
    if (!ch) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    const ok = answer.toUpperCase() === (ch.content.correct_answer || '').toUpperCase()
    let xp = ok ? (ch.xp_reward || 20) : 5
    if (ok && time_taken_sec && time_taken_sec < 60) xp = Math.round(xp * 1.5)
    return new Response(JSON.stringify({ success: true, correct: ok, xp_earned: xp, explanation: ch.content.explanation, correct_answer: ch.content.correct_answer, message: ok ? 'Correct!' : 'Keep trying!' }))
  } catch (e) { return new Response(JSON.stringify({ error: 'Submit failed' }), { status: 500 }) }
}
