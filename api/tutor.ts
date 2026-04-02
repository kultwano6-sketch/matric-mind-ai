import { streamText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export const maxDuration = 30
export const runtime = 'edge'

// Subject-specific prompts
const SUBJECT_PROMPTS: Record<string, string> = {
  mathematics: `Matric Maths tutor. Algebra, Calculus, Geometry, Trig, Stats. Show working steps. Be concise.`,
  mathematical_literacy: `Matric Maths Lit tutor. Budgets, loans, measurement, data. Use practical examples. Be concise.`,
  physical_sciences: `Matric Physical Sciences tutor. Physics & Chemistry. Show formulas. Be concise.`,
  life_sciences: `Matric Life Sciences tutor. Cells, Genetics, Evolution, Human Physiology. Be concise.`,
  agricultural_sciences: `Matric Agricultural Sciences tutor. Soil, Plant, Animal production. Be concise.`,
  accounting: `Matric Accounting tutor. Financial statements, Bookkeeping, Cash flow, VAT. Be concise.`,
  business_studies: `Matric Business Studies tutor. Business, Management, HR, Marketing. Be concise.`,
  economics: `Matric Economics tutor. Micro, Macro, GDP, Inflation, Markets. Be concise.`,
  geography: `Matric Geography tutor. Climate, Geomorphology, Mapwork, Development. Be concise.`,
  history: `Matric History tutor. Cold War, Apartheid, Civil rights, Globalization. Be concise.`,
  life_orientation: `Matric LO tutor. Self-development, Careers, Health, Democracy. Be concise.`,
  english_home_language: `Matric English Home Language tutor. Literature, Writing, Essays. Be concise.`,
  english_first_additional: `Matric English FAL tutor. Comprehension, Summary, Writing. Be concise.`,
  afrikaans_home_language: `Matric Afrikaans HT tutor. Letterkunde, Opstelle, Taal. Be concise.`,
  afrikaans_first_additional: `Matric Afrikaans EAT tutor. Begrip, Opsomming, Taal. Be concise.`,
  isizulu_home_language: `Matric isiZulu Home tutor. Be concise.`,
  isizulu_first_additional: `Matric isiZulu FAL tutor. Be concise.`,
  isixhosa_home_language: `Matric isiXhosa Home tutor. Be concise.`,
  isixhosa_first_additional: `Matric isiXhosa FAL tutor. Be concise.`,
  sepedi_home_language: `Matric Sepedi Home tutor. Be concise.`,
  sepedi_first_additional: `Matric Sepedi FAL tutor. Be concise.`,
  setswana_home_language: `Matric Setswana Home tutor. Be concise.`,
  setswana_first_additional: `Matric Setswana FAL tutor. Be concise.`,
  sesotho_home_language: `Matric Sesotho Home tutor. Be concise.`,
  sesotho_first_additional: `Matric Sesotho FAL tutor. Be concise.`,
  siswati_home_language: `Matric siSwati Home tutor. Be concise.`,
  siswati_first_additional: `Matric siSwati FAL tutor. Be concise.`,
  isindebele_home_language: `Matric isiNdebele Home tutor. Be concise.`,
  isindebele_first_additional: `Matric isiNdebele FAL tutor. Be concise.`,
  xitsonga_home_language: `Matric Xitsonga Home tutor. Be concise.`,
  xitsonga_first_additional: `Matric Xitsonga FAL tutor. Be concise.`,
  tshivenda_home_language: `Matric Tshivenda Home tutor. Be concise.`,
  tshivenda_first_additional: `Matric Tshivenda FAL tutor. Be concise.`,
  computer_applications_technology: `Matric CAT tutor. Spreadsheets, Databases, Internet. Be concise.`,
  information_technology: `Matric IT tutor. Programming, Algorithms, SQL, Networks. Be concise.`,
  tourism: `Matric Tourism tutor. Mapwork, Tourism sectors, Attractions. Be concise.`,
  dramatic_arts: `Matric Dramatic Arts tutor. Theatre, Performance, Design. Be concise.`,
  visual_arts: `Matric Visual Arts tutor. Art history, Drawing, Painting. Be concise.`,
  music: `Matric Music tutor. Theory, Aural, Composition, History. Be concise.`,
  civil_technology: `Matric Civil Technology tutor. Carpentry, Plumbing, Construction. Be concise.`,
  electrical_technology: `Matric Electrical Technology tutor. Circuits, Electronics. Be concise.`,
  mechanical_technology: `Matric Mechanical Technology tutor. Workshop, Materials, Machines. Be concise.`,
  engineering_graphic_and_design: `Matric EGD tutor. Technical drawing, CAD, Orthographic. Be concise.`,
}

const DEFAULT_PROMPT = `Matric tutor. Be concise and helpful.`

// Extract text content from a message, handling all possible formats
function extractTextFromMessage(msg: any): string {
  // If content is a string, use it directly
  if (typeof msg.content === 'string' && msg.content.trim()) {
    return msg.content
  }
  
  // If content is an array (multimodal format), extract text parts
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('\n')
  }
  
  // If parts exist (UIMessage format), extract text from parts
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('\n')
  }
  
  return ''
}

// Get the role from a message, defaulting to 'user'
function getMessageRole(msg: any): 'user' | 'assistant' | 'system' {
  const role = msg.role?.toLowerCase()
  if (role === 'assistant' || role === 'system') return role
  return 'user'
}

// Convert any message format to ModelMessage format for streamText
function toModelMessages(messages: any[]): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  return messages.map(msg => ({
    role: getMessageRole(msg),
    content: extractTextFromMessage(msg) || '[No content]'
  }))
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Check for API key
    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY is not set')
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const body = await req.json()
    console.log('Request received, keys:', Object.keys(body || {}))
    
    // Extract messages - handle Promise, array, or undefined
    let rawMessages: any[] = []
    
    if (body?.messages) {
      // Handle Promise (check for .then)
      if (typeof body.messages.then === 'function') {
        console.log('Messages is Promise, awaiting...')
        rawMessages = await body.messages
      } else if (Array.isArray(body.messages)) {
        rawMessages = body.messages
      }
      console.log('Messages count:', rawMessages.length)
    }
    
    const subject = body?.subject as string | undefined
    console.log('Subject:', subject)

    // Validate messages
    if (!rawMessages.length) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build concise system prompt
    const subjectPrompt = subject ? SUBJECT_PROMPTS[subject] || DEFAULT_PROMPT : DEFAULT_PROMPT
    let systemPrompt = `${subjectPrompt} Be a helpful tutor: answer questions directly, explain step by step, and use examples. If the student asks for practice or a quiz, give them questions. Otherwise, be direct and helpful.`

    // Add science-specific instructions (only for science subjects)
    const scienceSubjects = ['physical_sciences', 'life_sciences']
    if (subject && scienceSubjects.includes(subject)) {
      systemPrompt += ` Use simple ASCII diagrams when needed.`
    }

    // Check for images
    const hasImages = rawMessages.some((m: any) => 
      m.experimental_attachments?.length > 0 ||
      m.parts?.some((p: any) => p.type === 'file' || p.type === 'image')
    )
    if (hasImages) {
      systemPrompt += ` The student has uploaded an image. Analyze it carefully, identify any mistakes, and provide clear corrections.`
    }

    // Convert to ModelMessages format
    const modelMessages = toModelMessages(rawMessages)
    console.log('Converted to ModelMessages:', modelMessages.length)
    console.log('First message role:', modelMessages[0]?.role, 'content length:', modelMessages[0]?.content?.length)

    // Call Groq API via streamText - optimized for speed
    console.log('Calling streamText with fast model...')
    const result = streamText({
      model: groq('llama-3.1-8b-instant'),  // Much faster than 70b
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: 2048,
      temperature: 0.3,
      experimental_telemetry: { isEnabled: false },  // Skip telemetry for speed
    })

    console.log('Returning stream response')
    return result.toUIMessageStreamResponse()

  } catch (error: any) {
    console.error('Tutor API Error:', error?.message || error)
    console.error('Stack:', error?.stack?.substring(0, 500))
    
    return new Response(JSON.stringify({ 
      error: 'Failed to generate response',
      message: error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
