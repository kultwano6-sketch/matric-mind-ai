import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  try {
    const body = await req.json()
    const { messages, subject } = body
    if (!messages || !Array.isArray(messages)) return new Response(JSON.stringify({ error: 'Messages required' }), { status: 400 })
    const sys = `You are Matric Mind AI, a South African matric tutor for ${subject || 'general studies'}. Explain step by step.`
    const { text } = await generateText({ model: groq('llama-3.3-70b-versatile'), system: sys, messages, maxTokens: 2048, temperature: 0.7 })
    return new Response(JSON.stringify({ reply: text }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) { console.error('Tutor error:', e); return new Response(JSON.stringify({ error: 'Tutor failed' }), { status: 500 }) }
}
