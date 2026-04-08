import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  
  try {
    const body = await req.json()
    const { image, question, subject, context } = body
    
    const hasImage = image && image.length > 100
    
    // Use Gemini for both image and text
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    
    let prompt: any = question || context || 'Solve this problem'
    
    if (hasImage) {
      // Clean base64
      let b64 = image
      if (image.includes(',')) {
        b64 = image.split(',')[1]
      }
      
      const imagePart = {
        inlineData: {
          data: b64,
          mimeType: 'image/jpeg'
        }
      }
      
      const result = await model.generateContent([prompt, imagePart])
      const response = result.response.text()
      
      return Response.json({ 
        result: response,
        model: 'gemini-1.5-flash'
      })
    } else {
      // Text-only using Gemini
      const result = await model.generateContent(prompt)
      const response = result.response.text()
      
      return Response.json({ 
        result: response,
        model: 'gemini-1.5-flash'
      })
    }
  } catch (e: any) {
    console.error('SnapSolve error:', e.message)
    return Response.json({ error: 'Solve failed', message: e.message }, { status: 500 })
  }
}

export const runtime = 'nodejs';
