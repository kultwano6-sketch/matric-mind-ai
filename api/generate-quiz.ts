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

    const prompt = `You are a South African Matric ${subject} exam question generator.

Generate exactly ${count} multiple choice questions covering: ${topics}${weakAreas}

Rules:
- Each question must have 4 options (A, B, C, D)
- Only ONE correct answer
- Options should be plausible but clearly distinct
- Include a brief explanation for each answer

Respond in this EXACT format (no other text):
[{"question":"Q1?","options":{"A":"opt1","B":"opt2","C":"opt3","D":"opt4"},"correct":"A","explanation":"Why correct"},{"question":"Q2?","options":{"A":"opt1","B":"opt2","C":"opt3","D":"opt4"},"correct":"B","explanation":"Why correct"}]`

    const result = streamText({
      model: groq('llama-3.1-8b-instant'),
      prompt,
      maxOutputTokens: 4096,
      temperature: 0.3,
    })

    // Get the full text response (await the Promise)
    const response = await result.text
    console.log('Quiz response received, length:', response.length)
    
    // Parse the JSON from response
    let questions
    try {
      // Clean up any markdown formatting and extract JSON array
      let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      
      // Try to find JSON array in the response
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        cleaned = jsonMatch[0]
      }
      
      questions = JSON.parse(cleaned)
      console.log('Parsed questions count:', questions.length)
    } catch (e: any) {
      console.error('Failed to parse quiz JSON:', response.substring(0, 500))
      // Return a fallback response with empty questions
      return new Response(JSON.stringify({ 
        error: 'Failed to parse questions',
        questions: [],
        rawResponse: response.substring(0, 200)
      }), { status: 200 })  // Return 200 so frontend can handle
    }

    return new Response(JSON.stringify({ questions }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Quiz generation error:', error?.message || error)
    return new Response(JSON.stringify({ 
      error: 'Failed to generate quiz', 
      details: error?.message,
      questions: [] 
    }), { status: 200 })
  }
}
