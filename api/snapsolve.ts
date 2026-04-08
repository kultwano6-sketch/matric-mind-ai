import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  
  try {
    const body = await req.json()
    const image = body.image || body.image_base64
    
    if (!image) {
      return Response.json({ error: 'Image required' }, { status: 400 })
    }
    // Clean base64
    let b64 = image
    if (image.includes(',')) {
      b64 = image.split(',')[1]
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert South African matric tutor. Analyze the image and provide solution in JSON: {"question":"...","steps":["step1","step2"],"answer":"...","explanation":"...","tips":["tip1","tip2"]}'
        },
          role: 'user',
          content: [
            { type: 'text', text: 'Solve this question from the image.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }
          ]
        }
      ],
      max_tokens: 1000,
    })
    const content = response.choices[0]?.message?.content || ''
    try {
      const match = content.match(/\{[\s\S]*\}/)
      if (match) {
        const solution = JSON.parse(match[0].replace(/```json|```/g, '').trim())
        return Response.json({ solution })
      }
    } catch {}
    return Response.json({
      solution: {
        question: 'Problem from image',
        steps: content.split('\n').slice(0, 3),
        answer: 'See steps above',
        explanation: content.slice(0, 200),
        tips: ['Make image clear']
  } catch (e) {
    console.error('SnapSolve error:', e.message)
    return Response.json({ error: 'Solve failed', message: e.message }, { status: 500 })
}
export const runtime = 'nodejs';
