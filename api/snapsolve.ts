import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

// Subject-specific prompts for CAPS curriculum
const getSubjectPrompt = (subject: string): string => {
  const prompts: Record<string, string> = {
    mathematics: 'CAPS Grade 12 Mathematics. Show ALL working steps.',
    mathematical_literacy: 'CAPS Grade 12 Mathematical Literacy. Use practical examples.',
    physical_sciences: 'CAPS Grade 12 Physical Sciences. Show formulas and working.',
    life_sciences: 'CAPS Grade 12 Life Sciences. Explain concepts clearly.',
    accounting: 'CAPS Grade 12 Accounting. Use SA standards.',
    business_studies: 'CAPS Grade 12 Business Studies.',
    economics: 'CAPS Grade 12 Economics.',
    geography: 'CAPS Grade 12 Geography.',
    history: 'CAPS Grade 12 History.',
    english_home_language: 'CAPS Grade 12 English Home Language.',
    english_first_additional: 'CAPS Grade 12 English First Additional.',
  }
  return prompts[subject?.toLowerCase()] || 'CAPS Grade 12 subject'
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }
  
  try {
    const body = await req.json()
    const { question, subject, context } = body
    
    if (!question) {
      return new Response(JSON.stringify({ error: 'Question required' }), { status: 400 })
    }
    
    const subjectPrompt = getSubjectPrompt(subject)
    const contextInfo = context ? `\nContext: ${context}` : ''
    const fullQuestion = `${question}${contextInfo}`

    // Use fast text model
    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [
        { 
          role: 'system', 
          content: `You are an expert South African matric tutor for ${subjectPrompt}. 
Provide clear, step-by-step solutions. Return JSON:
{"question":"...","steps":["step1","step2","step3"],"answer":"...","explanation":"...","tips":["tip1","tip2"]}`
        },
        { 
          role: 'user', 
          content: fullQuestion
        },
      ],
      maxTokens: 1500,
      temperature: 0.3,
    })

    // Parse JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const cleaned = jsonMatch[0].replace(/```json\s?|\s?```/g, '').trim()
        const solution = JSON.parse(cleaned)
        return new Response(JSON.stringify({ solution }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error('No JSON found')
    } catch {
      // Return text as steps if no JSON
      const lines = text.split('\n').filter((l: string) => l.trim()).slice(0, 6)
      return new Response(JSON.stringify({
        solution: {
          question: question,
          steps: lines,
          answer: 'See steps above',
          explanation: text.slice(0, 500),
          tips: ['Practice similar problems', 'Review the topic'],
        },
      }), { headers: { 'Content-Type': 'application/json' } })
    }
  } catch (e: any) {
    console.error('SnapSolve error:', e)
    return new Response(JSON.stringify({ 
      error: 'Solve failed', 
      message: e?.message || 'Unable to process'
    }), { status: 500 })
  }
}
