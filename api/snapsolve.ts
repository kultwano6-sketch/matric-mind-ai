import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  
  try {
    const body = await req.json()
    const { image, question, subject, context } = body
    
    if (!image && !question) {
      return Response.json({ error: 'Image or question required' }, { status: 400 })
    }

    // Use text-based model since vision models are deprecated
    const response = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [
        {
          role: 'system',
          content: `You are an expert South African matric tutor for ${subject || 'all subjects'}. CAPS Grade 12. Provide clear step-by-step solutions.`
        },
        {
          role: 'user',
          content: question || 'Solve this problem from the image: ' + (context || 'Please provide the solution with working steps.')
        }
      ],
      maxTokens: 1000,
    })

    return Response.json({ 
      result: response.text,
      model: 'llama-3.3-70b-versatile'
    })
  } catch (e: any) {
    console.error('SnapSolve error:', e.message)
    return Response.json({ error: 'Solve failed', message: e.message }, { status: 500 })
  }
}

export const runtime = 'nodejs';
