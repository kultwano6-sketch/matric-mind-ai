import { streamText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export const maxDuration = 60
export const runtime = 'edge'

const SUBJECT_TOPICS: Record<string, string> = {
  mathematics: 'Algebra, Calculus, Geometry, Trigonometry, Statistics, Probability',
  mathematical_literacy: 'Budgets, loans, measurement, data handling, maps',
  physical_sciences: 'Mechanics, Waves, Electricity, Chemical Reactions, Acids & Bases',
  life_sciences: 'Cells, Genetics, Evolution, Human Physiology, Ecology',
  accounting: 'Financial Statements, Bookkeeping, Cash Flow, VAT',
  economics: 'Microeconomics, Macroeconomics, GDP, Inflation, Market Structures',
  geography: 'Climate, Geomorphology, Settlements, Mapwork, Development',
  history: 'Cold War, Apartheid, Civil Rights, Globalization',
  business_studies: 'Business Environments, Operations, Management, Marketing',
  life_orientation: 'Self-development, Careers, Health, Democracy',
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    if (!process.env.GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), { status: 500 })
    }

    const { subject, weakTopics = [], count = 5 } = await req.json()
    
    if (!subject) {
      return new Response(JSON.stringify({ error: 'Subject is required' }), { status: 400 })
    }

    const topics = SUBJECT_TOPICS[subject] || 'General topics'
    const weakAreas = weakTopics.length > 0 ? `\nFocus especially on: ${weakTopics.join(', ')}` : ''

    const prompt = `Generate exactly ${count} multiple choice questions for South African Matric ${subject} exam.

Topics to cover: ${topics}${weakAreas}

IMPORTANT: Respond with ONLY a valid JSON array, no markdown or explanation:
[
  {
    "question": "question text here",
    "options": { "A": "option 1", "B": "option 2", "C": "option 3", "D": "option 4" },
    "correct": "A",
    "explanation": "brief explanation of correct answer"
  }
]

Make questions exam-level difficulty. Ensure all options are plausible. Return ONLY the JSON array.`

    const result = streamText({
      model: groq('llama-3.1-8b-instant'),
      prompt,
      maxOutputTokens: 4096,
      temperature: 0.3,
    })

    // Get the full text response
    const response = await result.text
    
    // Parse the JSON from response
    let questions
    try {
      // Clean up any markdown formatting
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      questions = JSON.parse(cleaned)
    } catch (e) {
      console.error('Failed to parse quiz JSON:', response)
      return new Response(JSON.stringify({ error: 'Failed to generate valid questions' }), { status: 500 })
    }

    return new Response(JSON.stringify({ questions }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Quiz generation error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate quiz', details: error?.message }), { status: 500 })
  }
}
