import { streamText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export const maxDuration = 60
export const runtime = 'edge'

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    if (!process.env.GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), { status: 500 })
    }

    const { subject, questions, answers, score } = await req.json()
    
    if (!questions || !answers) {
      return new Response(JSON.stringify({ error: 'Questions and answers required' }), { status: 400 })
    }

    const questionSummary = questions.map((q: any, i: number) => 
      `Q${i + 1}: ${q.question}\nStudent answered: ${answers[i] || 'No answer'}\nCorrect: ${q.correct}\n`
    ).join('\n')

    const prompt = `You are a Matric ${subject || ''} tutor providing feedback on a quiz.

Student scored: ${score}%

Questions and answers:
${questionSummary}

Provide brief, encouraging feedback (2-3 sentences). Mention specific areas to improve based on wrong answers. Be supportive and motivating. Use Markdown.`

    const result = streamText({
      model: groq('llama-3.3-8b-instant'),
      prompt,
      maxOutputTokens: 500,
      temperature: 0.5,
    })

    const feedback = await result.text

    return new Response(JSON.stringify({ feedback }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Quiz grading error:', error)
    return new Response(JSON.stringify({ error: 'Failed to grade quiz', details: error?.message }), { status: 500 })
  }
}
