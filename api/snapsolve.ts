import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  
  try {
    const body = await req.json()
    const { image, subject, context } = body
    
    if (!image) {
      return Response.json({ error: 'Image required' }, { status: 400 })
    }
    
    // Clean up base64 - remove data URL prefix if present
    let b64 = image
    if (image.includes(',')) {
      b64 = image.split(',')[1]
    }
    
    // Validate base64
    if (b64.length < 100) {
      return Response.json({ error: 'Invalid image data' }, { status: 400 })
    }
    
    const subjectPrompt = getSubjectPrompt(subject)
    const contextInfo = context ? `\nContext: ${context}` : ''

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert South African matric tutor for ${subjectPrompt}. 
Analyze the image and provide a solution in JSON format:
{"question":"the problem","steps":["step1","step2","step3"],"answer":"final answer","explanation":"why correct","tips":["tip1","tip2"]}
Show all working steps clearly.${contextInfo}`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Solve this question from the image. Show all steps.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }
          ]
        }
      ],
      max_tokens: 1500,
      temperature: 0.3,
    })

    const content = response.choices[0]?.message?.content || ''
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const cleaned = jsonMatch[0].replace(/```json\s?|\s?```/g, '').trim()
        const solution = JSON.parse(cleaned)
        return Response.json({ solution })
      }
    } catch {
      // Continue to fallback
    }
    
    // Fallback response
    const lines = content.split('\n').filter((l: string) => l.trim())
    return Response.json({
      solution: {
        question: 'Problem from image',
        steps: lines.slice(0, 5),
        answer: 'See steps above',
        explanation: content.slice(0, 300),
        tips: ['Make image clear', 'Include full question'],
      }
    })
  } catch (e: any) {
    console.error('SnapSolve error:', e.message)
    return Response.json({ 
      error: 'Solve failed', 
      message: e.message || 'Unable to process'
    }, { status: 500 })
  }
}

export const runtime = 'nodejs';
