import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  try {
    const body = await req.json()
    const { messages, subject } = body
    const subjectLabel = typeof subject === 'string' ? subject : 'general studies'
    const systemPrompt = `You are Matric Mind AI — an expert South African matric tutor for ${subjectLabel}.`

    // Extract the last user message as a simple string — avoids strict message schema issues
    let promptText = ''
    if (Array.isArray(messages)) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]
        if (m && m.role === 'user' && typeof m.content === 'string') {
          promptText = m.content
          break
        }
      }
      if (!promptText && messages.length > 0) {
        const last = messages[messages.length - 1]
        promptText = typeof last?.content === 'string' ? last.content : JSON.stringify(last)
      }
    } else if (typeof messages === 'string') {
      promptText = messages
    } else if (messages && typeof messages === 'object') {
      promptText = typeof messages.content === 'string' ? messages.content : JSON.stringify(messages)
    }

    if (!promptText) return new Response(JSON.stringify({ error: 'No prompt found' }), { status: 400 })

    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      prompt: promptText,
      maxTokens: 2048,
      temperature: 0.7,
    })

    return new Response(JSON.stringify({ reply: text }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('Tutor error:', e)
    return new Response(JSON.stringify({ error: 'Tutor failed', message: e?.message || String(e) }), { status: 500 })
  }
}
