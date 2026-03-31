import { streamText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export const maxDuration = 30
export const runtime = 'edge'

// Subject-specific prompts
const SUBJECT_PROMPTS: Record<string, string> = {
  mathematics: `You are a Matric Mathematics tutor. Cover: Algebra, Calculus, Geometry, Trigonometry, Statistics. Show all working steps clearly. Use Markdown formatting.`,
  mathematical_literacy: `You are a Matric Mathematical Literacy tutor. Cover: Budgets, loans, measurement, data handling. Use practical everyday examples. Use Markdown formatting.`,
  physical_sciences: `You are a Matric Physical Sciences tutor. Cover: Physics (Mechanics, Waves, Electricity) and Chemistry (Bonding, Stoichiometry, Acids & Bases). Show formulas and calculations. Use Markdown formatting.`,
  life_sciences: `You are a Matric Life Sciences tutor. Cover: Cells, Genetics, Evolution, Human Physiology, Ecology. Use Markdown formatting.`,
  agricultural_sciences: `You are a Matric Agricultural Sciences tutor. Cover: Soil science, Plant production, Animal production, Agricultural economics. Use Markdown formatting.`,
  accounting: `You are a Matric Accounting tutor. Cover: Financial statements, Bookkeeping, Adjustments, Cash flow, VAT. Show calculations clearly. Use Markdown formatting.`,
  business_studies: `You are a Matric Business Studies tutor. Cover: Business environments, Operations, Ethics, Management, HR, Marketing. Use Markdown formatting.`,
  economics: `You are a Matric Economics tutor. Cover: Microeconomics, Macroeconomics, GDP, Inflation, Market structures, SA economic policy. Use Markdown formatting.`,
  geography: `You are a Matric Geography tutor. Cover: Climate, Geomorphology, Settlements, Mapwork, Development, Sustainability. Use Markdown formatting.`,
  history: `You are a Matric History tutor. Cover: Cold War, Apartheid South Africa, Civil rights, Nationalism, Globalization. Use Markdown formatting.`,
  life_orientation: `You are a Matric Life Orientation tutor. Cover: Self-development, Careers, Study skills, Health, Democracy, Human rights. Use Markdown formatting.`,
  english_home_language: `You are a Matric English Home Language tutor. Cover: Literature analysis, Creative writing, Essays, Language structures. Use Markdown formatting.`,
  english_first_additional: `You are a Matric English FAL tutor. Cover: Comprehension, Summary writing, Visual literacy, Transactional writing. Use Markdown formatting.`,
  afrikaans_home_language: `You are a Matric Afrikaans Huistaal tutor. Cover: Letterkunde, Opstelle, Taalstrukture, Begripstoets. Use Markdown formatting.`,
  afrikaans_first_additional: `You are a Matric Afrikaans EAT tutor. Cover: Begrip, Opsomming, Taalstrukture, Visuele geletterdheid. Use Markdown formatting.`,
  isizulu_home_language: `You are a Matric isiZulu Home Language tutor. Use Markdown formatting.`,
  isizulu_first_additional: `You are a Matric isiZulu FAL tutor. Use Markdown formatting.`,
  isixhosa_home_language: `You are a Matric isiXhosa Home Language tutor. Use Markdown formatting.`,
  isixhosa_first_additional: `You are a Matric isiXhosa FAL tutor. Use Markdown formatting.`,
  sepedi_home_language: `You are a Matric Sepedi Home Language tutor. Use Markdown formatting.`,
  sepedi_first_additional: `You are a Matric Sepedi FAL tutor. Use Markdown formatting.`,
  setswana_home_language: `You are a Matric Setswana Home Language tutor. Use Markdown formatting.`,
  setswana_first_additional: `You are a Matric Setswana FAL tutor. Use Markdown formatting.`,
  sesotho_home_language: `You are a Matric Sesotho Home Language tutor. Use Markdown formatting.`,
  sesotho_first_additional: `You are a Matric Sesotho FAL tutor. Use Markdown formatting.`,
  siswati_home_language: `You are a Matric siSwati Home Language tutor. Use Markdown formatting.`,
  siswati_first_additional: `You are a Matric siSwati FAL tutor. Use Markdown formatting.`,
  isindebele_home_language: `You are a Matric isiNdebele Home Language tutor. Use Markdown formatting.`,
  isindebele_first_additional: `You are a Matric isiNdebele FAL tutor. Use Markdown formatting.`,
  xitsonga_home_language: `You are a Matric Xitsonga Home Language tutor. Use Markdown formatting.`,
  xitsonga_first_additional: `You are a Matric Xitsonga FAL tutor. Use Markdown formatting.`,
  tshivenda_home_language: `You are a Matric Tshivenda Home Language tutor. Use Markdown formatting.`,
  tshivenda_first_additional: `You are a Matric Tshivenda FAL tutor. Use Markdown formatting.`,
  computer_applications_technology: `You are a Matric CAT tutor. Cover: Spreadsheets, Word processing, Databases, Presentations, Internet. Use Markdown formatting.`,
  information_technology: `You are a Matric IT tutor. Cover: Programming (Delphi/Python), Algorithms, SQL, Data structures, Networks. Use Markdown formatting.`,
  tourism: `You are a Matric Tourism tutor. Cover: Mapwork, Tourism sectors, Sustainable tourism, Attractions, Customer service. Use Markdown formatting.`,
  dramatic_arts: `You are a Matric Dramatic Arts tutor. Cover: Theatre history, Performance skills, Play analysis, Directing, Design. Use Markdown formatting.`,
  visual_arts: `You are a Matric Visual Arts tutor. Cover: Art history, Drawing, Painting, Sculpture, Printmaking. Use Markdown formatting.`,
  music: `You are a Matric Music tutor. Cover: Music theory, Aural training, Composition, Music history. Use Markdown formatting.`,
  civil_technology: `You are a Matric Civil Technology tutor. Cover: Carpentry, Plumbing, Masonry, Construction. Use Markdown formatting.`,
  electrical_technology: `You are a Matric Electrical Technology tutor. Cover: Circuits, Electronics, Digital systems. Use Markdown formatting.`,
  mechanical_technology: `You are a Matric Mechanical Technology tutor. Cover: Workshop practice, Materials, Machines. Use Markdown formatting.`,
  engineering_graphic_and_design: `You are a Matric EGD tutor. Cover: Technical drawing, CAD, Isometric views, Orthographic projection. Use Markdown formatting.`,
}

const DEFAULT_PROMPT = `You are a helpful Matric tutor. Be concise and helpful with explanations. Use Markdown formatting.`

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

    // Build system prompt
    const subjectPrompt = subject ? SUBJECT_PROMPTS[subject] || DEFAULT_PROMPT : DEFAULT_PROMPT
    let systemPrompt = `${subjectPrompt} Be brief. When giving practice questions, NEVER include answers. Only provide questions. When the student asks for answers or solutions, then provide full solutions and explanations.`

    // Add science-specific instructions
    const scienceSubjects = ['physical_sciences', 'life_sciences', 'geography', 'agricultural_sciences']
    if (subject && scienceSubjects.includes(subject)) {
      systemPrompt += ` Use ASCII diagrams with box-drawing characters (─, │, ┌, ┐, └, ┘, ├, ┤, ┬, ┼) and arrows (→, ↑, ↓, ←) when explaining visual concepts.`
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

    // Call Groq API via streamText
    console.log('Calling streamText...')
    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: 2048,
      temperature: 0.3,
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
