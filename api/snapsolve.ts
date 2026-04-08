import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  
  try {
    const body = await req.json()
    const { image, question, subject, context } = body
    
    // Handle both image uploads and text questions
    const hasImage = image && image.length > 100
    
    let messages: any[] = [
      {
        role: 'system',
        content: `You are an expert South African matric tutor for ${subject || 'all subjects'}. CAPS Grade 12. Provide clear step-by-step solutions with working.`
      }
    ]

    if (hasImage) {
      // Clean base64
      let b64 = image
      if (image.includes(',')) {
        b64 = image.split(',')[1]
      }
      
      // Use GPT-4o vision for image analysis
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: question || 'Solve this question from the image. Show all working steps.' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }
        ]
      })
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: 1500,
      })

      return Response.json({ 
        result: response.choices[0]?.message?.content || 'No response',
        model: 'gpt-4o'
      })
    } else {
      // Fallback to text-only using Groq
      const { generateText } = await import('ai')
      const { createGroq } = await import('@ai-sdk/groq')
      const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
      
      const { text } = await generateText({
        model: groq('llama-3.3-70b-versatile'),
        messages: [
          { role: 'system', content: `You are an expert South African matric tutor for ${subject || 'all subjects'}. CAPS Grade 12. Provide clear step-by-step solutions.` },
          { role: 'user', content: question || context || 'Solve this problem' }
        ],
        maxTokens: 1000,
      })

      return Response.json({ 
        result: text,
        model: 'llama-3.3-70b-versatile'
      })
    }
  } catch (e: any) {
    console.error('SnapSolve error:', e.message)
    return Response.json({ error: 'Solve failed', message: e.message }, { status: 500 })
  }
}

export const runtime = 'nodejs';
