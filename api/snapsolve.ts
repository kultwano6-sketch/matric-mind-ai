import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  
  try {
    const body = await req.json()
    const { image, question, subject, context } = body
    
    const hasImage = image && image.length > 100
    
    // Use Gemini for images
    if (hasImage && process.env.GEMINI_API_KEY) {
      try {
        let b64 = image
        if (image.includes(',')) {
          b64 = image.split(',')[1]
        }
        
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
        const result = await model.generateContent([question || context || 'Solve this problem', { inlineData: { data: b64, mimeType: 'image/jpeg' } }])
        const response = result.response.text()
        
        return Response.json({ 
          result: response,
          model: 'gemini-2.0-flash'
        })
      } catch (geminiError: any) {
        console.log('Gemini failed, trying Groq:', geminiError.message)
        // Fall through to Groq
      }
    }
    
    // Use Groq for text-only or if Gemini fails
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
  } catch (e: any) {
    console.error('SnapSolve error:', e.message)
    return Response.json({ error: 'Solve failed', message: e.message }, { status: 500 })
  }
}

export const runtime = 'nodejs';
