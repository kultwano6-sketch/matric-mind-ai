import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
// Use faster model for image analysis
const MODEL = 'llama-3.2-11b-vision-preview'

// Subject-specific prompts for CAPS curriculum
const getSubjectPrompt = (subject: string): string => {
  const prompts: Record<string, string> = {
    mathematics: 'South African CAPS Grade 12 Mathematics. Topics: Algebra, Calculus, Geometry, Trigonometry, Statistics. Show ALL working steps. Use CAPS terminology.',
    mathematical_literacy: 'South African CAPS Grade 12 Mathematical Literacy. Topics: Finance, Measurement, Maps, Data handling. Use practical real-world examples.',
    physical_sciences: 'South African CAPS Grade 12 Physical Sciences (Physics & Chemistry). Topics: Mechanics, Waves, Electricity, Matter, Chemical reactions. Show formulas and working.',
    life_sciences: 'South African CAPS Grade 12 Life Sciences. Topics: Cell Biology, Genetics, Evolution, Ecology, Human Physiology. Explain concepts clearly.',
    accounting: 'South African CAPS Grade 12 Accounting. Topics: Financial Statements, Cost Accounting, Budgets, VAT, Assets. Use SA accounting standards.',
    business_studies: 'South African CAPS Grade 12 Business Studies. Topics: Business, Management, Marketing, HR. Use CAPS curriculum.',
    economics: 'South African CAPS Grade 12 Economics. Topics: Microeconomics, Macroeconomics, GDP, Inflation, Policy. Use CAPS terminology.',
    geography: 'South African CAPS Grade 12 Geography. Topics: Geomorphology, Climate, Hydrology, Mapwork, Population. Use CAPS curriculum.',
    history: 'South African CAPS Grade 12 History. Topics: South African History, World History. Use CAPS curriculum.',
    english_home_language: 'South African CAPS Grade 12 English Home Language. Literature analysis, essay writing, language usage.',
    english_first_additional: 'South African CAPS Grade 12 English First Additional Language. Comprehension, summary, writing.',
    afrikaans_home_language: 'South African CAPS Grade 12 Afrikaans. Taal, Literatuur, Opstelle.',
    isizulu_home_language: 'South African CAPS Grade 12 isiZulu. Ulwimi, Amazing, Incwadi.',
    computer_applications_technology: 'South African CAPS Grade 12 CAT. Programming, Databases, HTML, SQL.',
    tourism: 'South African CAPS Grade 12 Tourism. Destinations, Travel, Hospitality.',
    agricultural_sciences: 'South African CAPS Grade 12 Agricultural Sciences. Soil Science, Plant Production, Animal Production.',
    life_orientation: 'South African CAPS Grade 12 Life Orientation. Career development, Health, Democracy, Social issues.',
  }
  return prompts[subject?.toLowerCase()] || 'South African CAPS Grade 12 general subject. Explain the problem and provide a clear solution.'
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }
  
  try {
    const body = await req.json()
    const { image_base64, image, subject, context } = body
    const img = image_base64 || image || ''
    
    if (!img) {
      return new Response(JSON.stringify({ error: 'Image required' }), { status: 400 })
    }
    
    // Extract base64 data
    const b64 = img.startsWith('data:') ? img.split(',')[1] || img : img
    const fmt = b64.startsWith('/9j/') ? 'jpeg' : b64.startsWith('iVBOR') ? 'png' : 'jpeg'
    
    // Get subject-specific prompt
    const subjectPrompt = getSubjectPrompt(subject)
    const contextInfo = context ? `\nAdditional context: ${context}` : ''

    const { text } = await generateText({
      model: groq(MODEL),
      messages: [
        { 
          role: 'system', 
          content: `You are Matric Mind AI SnapSolve - expert South African matric tutor. 
Analyze the uploaded image showing a question/problem and provide a detailed solution.

${subjectPrompt}

Return ONLY valid JSON with this exact structure:
{
  "question": "The problem statement from the image",
  "steps": ["Step 1 with full working", "Step 2 with full working", "Step 3 with full working"],
  "answer": "Final answer clearly stated",
  "explanation": "Detailed explanation of why this is correct",
  "tips": ["Study tip 1", "Study tip 2", "Study tip 3"]
}

IMPORTANT: 
- Show ALL working steps for math/science problems
- For essays, provide structure and key points
- Use CAPS curriculum terminology
- If image is unclear, state that in explanation
${contextInfo}`
        },
        { 
          role: 'user', 
          content: [
            { 
              type: 'image', 
              image: `data:image/${fmt};base64,${b64}` 
            }
          ]
        },
      ],
      maxTokens: 1024,
      temperature: 0.3,
    })

    // Try to parse JSON response
    try {
      // Find JSON in response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const cleaned = jsonMatch[0].replace(/```json\s?|\s?```/g, '').trim()
        const solution = JSON.parse(cleaned)
        return new Response(JSON.stringify({ solution }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error('No JSON found')
    } catch {
      // If JSON parsing fails, create a solution from the text
      const lines = text.split('\n').filter((l: string) => l.trim() && !l.startsWith('```'))
      const steps = lines.filter((l: string) => l.match(/^\d+\.|\*|-|Step/i)).slice(0, 8)
      
      return new Response(JSON.stringify({
        solution: {
          question: 'Problem from uploaded image',
          steps: steps.length > 0 ? steps : ['Analysis complete', 'Solution derived', 'Final answer obtained'],
          answer: 'See steps above for solution',
          explanation: text.slice(0, 500),
          tips: [
            'Make sure the image is clear and well-lit',
            'Include all parts of the question in the frame',
            'For multi-part questions, add context below'
          ],
        },
      }), { headers: { 'Content-Type': 'application/json' } })
    }
  } catch (e: any) {
    console.error('SnapSolve error:', e)
    return new Response(JSON.stringify({ 
      error: 'Solve failed', 
      message: e?.message || 'Unable to process image. Please try again.'
    }), { status: 500 })
  }
}
