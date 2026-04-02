import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }
  try {
    const body = await req.json()
    const { image_base64, image, subject } = body
    const img = image_base64 || image || ''
    if (!img) {
      return new Response(JSON.stringify({ error: 'Image required' }), { status: 400 })
    }
    const b64 = img.startsWith('data:') ? img.split(',')[1] || img : img
    const fmt = b64.startsWith('/9j/') ? 'jpeg' : b64.startsWith('iVBOR') ? 'png' : 'jpeg'

    const { text } = await generateText({
      model: groq(MODEL),
      messages: [
        { role: 'system', content: `You are Matric Mind AI SnapSolve. Analyze the image and return ONLY valid JSON:\n{"question":"The problem statement","steps":["Step 1...","Step 2...","Step 3..."],"answer":"Final answer","explanation":"Why this is correct","tips":["Study tip 1","Study tip 2"]}\nSubject: ${subject || 'Mathematics'}. Show all working steps clearly.` },
        { role: 'user', content: [{ type: 'image', image: `data:image/${fmt};base64,${b64}` }] },
      ],
      maxTokens: 2048,
      temperature: 0.5,
    })

    try {
      const cleaned = text.replace(/```json\s?|\s?```/g, '').trim()
      const solution = JSON.parse(cleaned)
      return new Response(JSON.stringify({ solution }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {
      const steps = text.split('\n').filter((l: string) => l.trim()).slice(0, 6)
      return new Response(JSON.stringify({
        solution: {
          question: 'Problem from image',
          steps,
          answer: 'See steps above',
          explanation: text,
          tips: ['Make sure the image is clear and well-lit', 'Include all parts of the question'],
        },
      }), { headers: { 'Content-Type': 'application/json' } })
    }
  } catch (e: any) {
    console.error('SnapSolve error:', e)
    return new Response(JSON.stringify({ error: 'Solve failed', message: e?.message }), { status: 500 })
  }
}
