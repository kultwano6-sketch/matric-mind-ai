import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const sessions = new Map()
setInterval(() => {
  const now = Date.now()
  for (const [key, session] of sessions.entries()) {
    if (now - session.created_at > 30 * 60 * 1000) {
      sessions.delete(key)
    }
  }
}, 5 * 60 * 1000)
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  
  try {
    const body = await req.json()
    const { message, sessionId, subject, clearHistory } = body
    
    if (!message) {
      return Response.json({ error: 'Message required' }, { status: 400 })
    const sid = sessionId || 'default'
    let history = sessions.get(sid) || { messages: [], created_at: Date.now() }
    if (clearHistory) {
      history = { messages: [], created_at: Date.now() }
    const systemMsg = `You are an expert South African matric tutor for ${subject || 'all subjects'}. CAPS Grade 12. Be helpful and clear.`
    const messages = [
      { role: 'system', content: systemMsg },
      ...history.messages.slice(-20),
      { role: 'user', content: message }
    ]
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as any,
      max_tokens: 800,
    })
    const reply = response.choices[0]?.message?.content || 'No response'
    history.messages.push({ role: 'user', content: message }, { role: 'assistant', content: reply })
    sessions.set(sid, history)
    return Response.json({ reply, sessionId: sid, history: history.messages.slice(-10) })
  } catch (e: any) {
    console.error('Conversation error:', e.message)
    return Response.json({ error: 'Failed', message: e.message }, { status: 500 })
}
export const runtime = 'nodejs';
