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
    const { image_base64, image, subject, context } = body
    const img = image_base64 || image || ''
    
    if (!img) {
      return new Response(JSON.stringify({ error: 'Image required' }), { status: 400 })
    }
    
    // Extract base64 data properly
    let b64 = img
    if (img.startsWith('data:')) {
      const parts = img.split(',')
      b64 = parts[1] || img
    }
    
    const fmt = b64.startsWith('/9j/') ? 'jpeg' : b64.startsWith('iVBOR') ? 'png' : 'jpeg'
    const dataUrl = `data:image/${fmt};base64,${b64}`
    
    const subjectPrompt = getSubjectPrompt(subject)
    const contextInfo = context ? `\nAdditional context: ${context}` : ''

    // Use vision model with proper image format
    const { text } = await generateText({
      model: groq('llama-3.2-11b-vision-preview'),
      messages: [
        { 
          role: 'system', 
          content: `You are an expert South African matric tutor. Analyze the image and provide solution in JSON format: {"question":"...","steps":["step1","step2","step3"],"answer":"...","explanation":"...","tips":["tip1","tip2"]}. Subject: ${subjectPrompt}.${contextInfo}`
        },
        { 
          role: 'user', 
          content: [
            { type: 'image', image: dataUrl }
          ]
        },
      ],
      maxTokens: 1024,
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
      const lines = text.split('\n').filter((l: string) => l.trim())
      return new Response(JSON.stringify({
        solution: {
          question: 'Problem from image',
          steps: lines.slice(0, 5),
          answer: 'See steps above',
          explanation: text.slice(0, 300),
          tips: ['Make image clear', 'Include full question'],
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
