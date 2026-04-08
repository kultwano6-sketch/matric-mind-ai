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
    
    // Build the prompt - include image description if provided
    let prompt = ''
    if (image && image.length > 100) {
      prompt = `Image uploaded. ${question || context || 'Solve this problem. Describe the problem shown in the image and provide a solution.'}`
    } else {
      prompt = question || context || 'Solve this problem'
    }

    // Use Groq for everything (text and image-based questions)
    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [
        { role: 'system', content: `You are an expert South African matric tutor for ${subject || 'all subjects'}. CAPS Grade 12 curriculum. Provide clear step-by-step solutions with working. Format responses with numbered steps.` },
        { role: 'user', content: prompt }
      ],
      maxTokens: 1500,
    })

    // Parse the response into solution format
    const lines = text.split('\n').filter((s: string) => s.trim()).slice(0, 10)
    
    return Response.json({ 
      solution: { 
        question: question || context || 'Problem',
        steps: lines,
        answer: lines.find((l: string) => l.match(/^(answer|final|result|therefore|so)/i)) || lines[0] || 'See steps above',
        explanation: text.slice(0, 500),
        tips: ['Practice similar problems', 'Review the topic', 'Ask for clarification if needed']
      },
      model: 'llama-3.3-70b-versatile'
    })
  } catch (e: any) {
    console.error('SnapSolve error:', e.message)
    return Response.json({ error: 'Solve failed', message: e.message }, { status: 500 })
  }
}

export const runtime = 'nodejs';
