import { streamText, convertToModelMessages, UIMessage } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export const maxDuration = 30
export const runtime = 'edge'

// Minimal prompts for speed
const SUBJECT_PROMPTS: Record<string, string> = {
  mathematics: `Matric Maths tutor. Algebra, calculus, geometry, trig, stats. Show steps.`,
  mathematical_literacy: `Matric Maths Lit tutor. Budgets, loans, measurement, data. Practical examples.`,
  physical_sciences: `Matric Physics & Chemistry tutor. Mechanics, waves, electricity, bonding, stoichiometry.`,
  life_sciences: `Matric Biology tutor. Cells, genetics, evolution, physiology, ecology.`,
  accounting: `Matric Accounting tutor. Financial statements, bookkeeping, adjustments.`,
  business_studies: `Matric Business tutor. Environments, operations, ethics, management.`,
  economics: `Matric Economics tutor. Micro/macro, GDP, inflation, SA context.`,
  geography: `Matric Geography tutor. Climate, settlements, GIS, mapwork.`,
  history: `Matric History tutor. Cold War, apartheid, democracy, globalization.`,
  english_home_language: `Matric English tutor. Literature, essays, language conventions.`,
  english_first_additional: `Matric English FAL tutor. Comprehension, writing, grammar.`,
  life_orientation: `Matric LO tutor. Self-development, careers, study skills.`,
  information_technology: `Matric IT tutor. Programming, algorithms, SQL, data structures.`,
}

const DEFAULT_PROMPT = `Matric tutor. Be concise and helpful.`

// Race multiple models - first to respond wins
async function raceModels(
  systemPrompt: string,
  messages: UIMessage[],
  signal: AbortSignal
) {
  const convertedMessages = await convertToModelMessages(messages)
  
  // Use Groq with different fast models - race them
  const models = [
    { model: groq('llama-3.1-8b-instant'), name: 'llama-8b' },
    { model: groq('llama-3.3-70b-versatile'), name: 'llama-70b' },
    { model: groq('gemma2-9b-it'), name: 'gemma2' },
  ]
  
  // Create abort controllers for each model
  const controllers = models.map(() => new AbortController())
  
  // Link parent signal to all controllers
  signal.addEventListener('abort', () => {
    controllers.forEach(c => c.abort())
  })
  
  // Race all models
  const racePromises = models.map(async ({ model, name }, index) => {
    try {
      const result = streamText({
        model,
        system: systemPrompt,
        messages: convertedMessages,
        maxOutputTokens: 500,
        temperature: 0.1,
        abortSignal: controllers[index].signal,
      })
      
      // Wait for first chunk to ensure model is responding
      const stream = result.toDataStream()
      const reader = stream.getReader()
      const firstChunk = await reader.read()
      
      if (firstChunk.done) {
        throw new Error('Empty response')
      }
      
      // Cancel other models since we have a winner
      controllers.forEach((c, i) => {
        if (i !== index) c.abort()
      })
      
      console.log(`[v0] Winner: ${name}`)
      
      // Return the winning result
      return { result, name, firstChunk: firstChunk.value }
    } catch (error) {
      // If aborted by another winner, that's fine
      if (error instanceof Error && error.name === 'AbortError') {
        throw error
      }
      console.log(`[v0] ${name} failed:`, error)
      throw error
    }
  })
  
  // Return first successful result
  return Promise.any(racePromises)
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const { messages, subject, stylePrompt } = body as {
      messages: UIMessage[]
      subject?: string
      stylePrompt?: string
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Minimal system prompt for speed
    const subjectPrompt = subject ? SUBJECT_PROMPTS[subject] || DEFAULT_PROMPT : DEFAULT_PROMPT
    const fullSystemPrompt = `${subjectPrompt}${stylePrompt ? ' ' + stylePrompt : ''} Be brief. Use Markdown.`

    // Simple fast path - just use the fastest model directly
    // The 8b instant model is consistently fastest
    const result = streamText({
      model: groq('llama-3.1-8b-instant'),
      system: fullSystemPrompt,
      messages: await convertToModelMessages(messages),
      maxOutputTokens: 500,
      temperature: 0.1,
      abortSignal: req.signal,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('AI Tutor error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate response' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
