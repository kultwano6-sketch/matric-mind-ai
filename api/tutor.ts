import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  
  try {
    const body = await req.json()
    const { message, history, subject, context } = body
    
    if (!message) {
      return Response.json({ error: 'Message required' }, { status: 400 })
    }
    const systemPrompt = `You are an expert South African matric tutor for ${subject || 'general subjects'}. 
CAPS Grade 12 curriculum aligned. Answer questions clearly and concisely. Use examples where helpful.`
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-10),
      { role: 'user', content: message }
    ]
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as any,
      max_tokens: 1000,
      temperature: 0.7,
    })
    const reply = response.choices[0]?.message?.content || 'I could not generate a response.'
    return Response.json({ reply, model: 'gpt-4o-mini' })
  } catch (e: any) {
    console.error('Tutor error:', e.message)
    return Response.json({ error: 'Failed to get response', message: e.message }, { status: 500 })
}
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
