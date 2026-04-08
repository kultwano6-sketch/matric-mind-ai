import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  
  try {
    const body = await req.json()
    const { image, question, subject } = body
    
    if (!image) {
      return Response.json({ error: 'Image required' }, { status: 400 })
    }

    let b64 = image
    if (image.includes(',')) {
      b64 = image.split(',')[1]
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert South African matric tutor. Analyze the image and provide solution. Subject: ${subject || 'General'}`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: question || 'Solve this question from the image.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }
          ]
        }
      ],
      max_tokens: 1000,
    })

    return Response.json({ 
      result: response.choices[0]?.message?.content || 'No result',
      model: 'gpt-4o'
    })
  } catch (e: any) {
    console.error('OCR Solve error:', e.message)
    return Response.json({ error: 'Failed', message: e.message }, { status: 500 })
  }
}

export const runtime = 'nodejs';
