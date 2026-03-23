import { streamText, convertToModelMessages, UIMessage } from 'ai'

export const maxDuration = 30
export const runtime = 'edge'

// Compact subject prompts for faster processing
const SUBJECT_PROMPTS: Record<string, string> = {
  mathematics: `Expert Matric Mathematics tutor. Cover algebra, calculus, geometry, trigonometry, stats, financial maths. Show step-by-step working with proper notation.`,
  mathematical_literacy: `Expert Matric Maths Literacy tutor. Focus on practical applications: budgets, loans, interest, measurement, data handling, maps. Use everyday examples.`,
  physical_sciences: `Expert Matric Physical Sciences tutor (Physics & Chemistry). Cover mechanics, waves, electricity, bonding, stoichiometry, organic chemistry. Show clear calculations.`,
  life_sciences: `Expert Matric Life Sciences tutor. Cover cell biology, genetics, evolution, physiology, ecology. Use clear explanations for biological processes.`,
  accounting: `Expert Matric Accounting tutor. Cover financial statements, bookkeeping, adjustments, inventory, manufacturing accounts. Show proper formats.`,
  business_studies: `Expert Matric Business Studies tutor. Cover business environments, ventures, operations, legislation, ethics, management with SA examples.`,
  economics: `Expert Matric Economics tutor. Cover micro/macroeconomics, GDP, inflation, growth, international economics with SA context.`,
  geography: `Expert Matric Geography tutor. Cover climatology, geomorphology, settlements, economic geography, GIS, mapwork with SA/global contexts.`,
  history: `Expert Matric History tutor. Cover Cold War, civil society protests (1950s-1990s), apartheid, democracy, globalization. Analyze sources critically.`,
  english_home_language: `Expert Matric English Home Language tutor. Cover literature analysis, essay writing, language conventions, visual literacy.`,
  english_first_additional: `Expert Matric English FAL tutor. Focus on comprehension, writing, language use, literature. Be patient and supportive.`,
  afrikaans_home_language: `Kundige Afrikaans Huistaal-tutor vir Matric. Letterkunde, opstelle, taalstrukture, visuele geletterdheid.`,
  afrikaans_first_additional: `Afrikaans EAT-tutor vir Matric. Leesbegrip, skryfvaardighede, taalgebruik, letterkunde.`,
  isizulu: `Uthisha wesiZulu weMatric. Usiza ngezincwadi, ukubhala, nolimi.`,
  isixhosa: `Utitshala wesiXhosa weMatric. Unceda ngeencwadi, ukubhala, nolwimi.`,
  sepedi_home_language: `Morutisi wa Sepedi wa Matric. Thuša ka dingwalo, go ngwala, le polelo.`,
  life_orientation: `Expert Matric Life Orientation tutor. Cover self-development, social responsibility, human rights, careers, study skills.`,
  computer_applications_technology: `Expert Matric CAT tutor. Cover Word, Excel, Access, presentations, internet, hardware/software concepts. Give step-by-step guidance.`,
  information_technology: `Expert Matric IT tutor. Cover programming (Delphi/Java), algorithms, SQL, networks, data structures. Help write clean code.`,
  tourism: `Expert Matric Tourism tutor. Cover tourism sectors, attractions, map work, tour planning, marketing, customer service with SA examples.`,
  dramatic_arts: `Expert Matric Dramatic Arts tutor. Cover theatre history, performance analysis, playwriting, technical theatre, SA theatre.`,
  visual_arts: `Expert Matric Visual Arts tutor. Cover art history, visual analysis, techniques, SA artists, portfolio development.`,
  music: `Expert Matric Music tutor. Cover theory, aural skills, music history, SA traditions, performance, composition.`,
}

const DEFAULT_PROMPT = `Friendly Matric tutor. Be encouraging, concise, and helpful. Use SA context. Celebrate progress.`

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const { messages, subject, stylePrompt } = body as {
      messages: UIMessage[]
      subject?: string
      stylePrompt?: string
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build the system prompt
    const subjectPrompt = subject ? SUBJECT_PROMPTS[subject] || DEFAULT_PROMPT : DEFAULT_PROMPT
    const fullSystemPrompt = `${subjectPrompt}

${stylePrompt || ''}

RULES: Be concise. Answer directly, then explain if needed. Use Markdown. For math: x², √x, a/b. Number steps clearly. Max 3 paragraphs unless complex.`

    const result = streamText({
      model: 'openai/gpt-4o-mini',
      system: fullSystemPrompt,
      messages: await convertToModelMessages(messages),
      maxOutputTokens: 1000,
      temperature: 0.5,
      abortSignal: req.signal,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('AI Tutor error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate response' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
