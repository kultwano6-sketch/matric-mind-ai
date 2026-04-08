import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  
  try {
    const body = await req.json()
    const { prompt, type, subject, context } = body
    
    if (!prompt) {
      return Response.json({ error: 'Prompt required' }, { status: 400 })
    }
    const systemMsg = type === 'explain'
      ? `You are an expert South African matric tutor for ${subject || 'general'}. Explain concepts clearly with examples.`
      : `You are an expert South African matric tutor. Explain questions step by step.`
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ],
      max_tokens: 800,
    })
    return Response.json({ 
      result: response.choices[0]?.message?.content || 'No response',
      model: 'gpt-4o-mini'
  } catch (e: any) {
    console.error('Explain error:', e.message)
    return Response.json({ error: 'Failed', message: e.message }, { status: 500 })
}
export const runtime = 'nodejs';
