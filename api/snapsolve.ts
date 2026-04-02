import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }
  try {
    const { image_base64, subject, question } = await req.json()
    if (!image_base64 && !question) {
      return new Response(JSON.stringify({ error: 'Image or question required' }), { status: 400 })
    }
    const userContent: any[] = []
    if (question) userContent.push({ type: 'text', text: question })
    if (image_base64) {
      const fmt = image_base64.startsWith('/9j/') ? 'jpeg' : image_base64.startsWith('iVBOR') ? 'png' : 'jpeg'
      userContent.push({ type: 'image', image: `data:image/${fmt};base64,${image_base64}` })
    }
    const { text } = await generateText({
      model: groq(MODEL),
      messages: [
        { role: 'system', content: `You are Matric Mind AI SnapSolve. Analyze the image/question and provide:\n1. The problem statement\n2. Step-by-step solution\n3. Final answer\nSubject: ${subject || 'Mathematics'}. Show all working, be clear.` },
        { role: 'user', content: userContent },
      ],
      maxTokens: 2048, temperature: 0.5,
    })
    return new Response(JSON.stringify({ solution: text }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    console.error('SnapSolve error:', e)
    return new Response(JSON.stringify({ error: 'Solve failed', message: e?.message }), { status: 500 })
  }
}
