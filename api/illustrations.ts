import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

const SUBJECT_CONTEXT: Record<string, string> = {
  physical_sciences: 'South African NSC Physical Sciences (Physics and Chemistry)',
  life_sciences: 'South African NSC Life Sciences (Biology)',
  geography: 'South African NSC Geography',
  agricultural_sciences: 'South African NSC Agricultural Sciences',
  natural_sciences: 'Natural Sciences',
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
    const { subject, prompt } = body as { subject: string; prompt: string }

    if (!subject || !prompt) {
      return new Response(JSON.stringify({ error: 'Subject and prompt required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const subjectContext = SUBJECT_CONTEXT[subject] || 'Science'

    const systemPrompt = `You are an expert science educator creating ASCII/text-based diagrams and illustrations for ${subjectContext} students.

When asked to illustrate something:
1. Create a clear, detailed ASCII diagram or structured text-based illustration
2. Label all parts clearly
3. Use arrows (→, ↑, ↓, ←) and lines (─, │, ┌, ┐, └, ┘, ├, ┤, ┬, ┼, ┘) for connections
4. Include brief explanations in brackets [like this] where helpful
5. Make it exam-ready — students should be able to use this for studying
6. Keep it accurate to the South African CAPS curriculum

Format your response as:
DESCRIPTION: [One line describing what this illustrates]
---
[The diagram/illustration in ASCII art or structured text]
---
EXPLANATION: [Brief 2-3 sentence explanation of the key concepts shown]`

    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      prompt: `Create a detailed text-based illustration/diagram for: ${prompt}`,
      maxOutputTokens: 1500,
      temperature: 0.3,
    })

    // Parse the response
    const text = result.text
    let description = prompt
    let illustration = text

    const descMatch = text.match(/DESCRIPTION:\s*(.+?)(?:\n|---)/)
    if (descMatch) {
      description = descMatch[1].trim()
    }

    // Extract just the illustration part (between --- markers)
    const parts = text.split('---')
    if (parts.length >= 3) {
      illustration = parts[1].trim()
    }

    return new Response(JSON.stringify({
      text: illustration,
      description,
      full: text,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Illustration error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate illustration' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
