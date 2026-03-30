import { streamText, convertToModelMessages, UIMessage } from 'ai'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export const maxDuration = 30
export const runtime = 'edge'

// Subject-specific prompts
const SUBJECT_PROMPTS: Record<string, string> = {
  // Core subjects
  mathematics: `Matric Maths tutor. Algebra, calculus, geometry, trig, stats. Show all working steps clearly.`,
  mathematical_literacy: `Matric Maths Lit tutor. Budgets, loans, measurement, data. Use practical everyday examples.`,
  physical_sciences: `Matric Physical Sciences tutor (Physics & Chemistry). Mechanics, waves, electricity, bonding, stoichiometry, acids & bases.`,
  life_sciences: `Matric Life Sciences tutor (Biology). Cells, genetics, evolution, human physiology, ecology.`,
  agricultural_sciences: `Matric Agricultural Sciences tutor. Soil science, plant production, animal production, agricultural economics, farm management.`,
  accounting: `Matric Accounting tutor. Financial statements, bookkeeping, adjustments, cash flow, VAT.`,
  business_studies: `Matric Business Studies tutor. Business environments, operations, ethics, management, HR, marketing.`,
  economics: `Matric Economics tutor. Microeconomics, macroeconomics, GDP, inflation, market structures, SA economic policy.`,
  geography: `Matric Geography tutor. Climate, geomorphology, settlements, mapwork, development, sustainability.`,
  history: `Matric History tutor. Cold War, apartheid South Africa, civil rights, nationalism, globalization.`,
  life_orientation: `Matric Life Orientation tutor. Self-development, careers, study skills, health, democracy, human rights.`,

  // English
  english_home_language: `Matric English Home Language tutor. Literature analysis, creative writing, essays, language structures.`,
  english_first_additional: `Matric English FAL tutor. Comprehension, summary writing, visual literacy, transactional writing.`,

  // Afrikaans
  afrikaans_home_language: `Matric Afrikaans Huistaal tutor. Letterkunde, opstelle, taalstrukture, begripstoets.`,
  afrikaans_first_additional: `Matric Afrikaans EAT tutor. Begrip, opsomming, taalstrukture, visuele geletterdheid.`,

  // isiZulu
  isizulu_home_language: `Matric isiZulu Home Language tutor. Incwadi yabafundi, ukubhala, ulimi.`,
  isizulu_first_additional: `Matric isiZulu FAL tutor. Ukuqonda, ukubhala, ulimi, ubuciko bokubhala.`,

  // isiXhosa
  isixhosa_home_language: `Matric isiXhosa Home Language tutor. Incwadi yabafundi, ukubhala, ulwimi.`,
  isixhosa_first_additional: `Matric isiXhosa FAL tutor. Ukuqonda, ukubhala, ulwimi.`,

  // Sepedi
  sepedi_home_language: `Matric Sepedi Home Language tutor. Buka ya baithuti, go ngwala, polelo.`,
  sepedi_first_additional: `Matric Sepedi FAL tutor. Go kwešiša, go ngwala, polelo.`,

  // Setswana
  setswana_home_language: `Matric Setswana Home Language tutor. Buka ya baithuti, go kwala, puo.`,
  setswana_first_additional: `Matric Setswana FAL tutor. Go tlhaloganya, go kwala, puo.`,

  // Sesotho
  sesotho_home_language: `Matric Sesotho Home Language tutor. Buka ya baithuti, ho ngola, puo.`,
  sesotho_first_additional: `Matric Sesotho FAL tutor. Ho utloisisa, ho ngola, puo.`,

  // siSwati
  siswati_home_language: `Matric siSwati Home Language tutor. Incwadzi yabafundzi, kubhala, lulwimi.`,
  siswati_first_additional: `Matric siSwati FAL tutor. Kuvisisa, kubhala, lulwimi.`,

  // isiNdebele
  isindebele_home_language: `Matric isiNdebele Home Language tutor. Incwadzi yabafundzi, kubhala, lulwimi.`,
  isindebele_first_additional: `Matric isiNdebele FAL tutor. Kuqonda, kubhala, lulwimi.`,

  // Xitsonga
  xitsonga_home_language: `Matric Xitsonga Home Language tutor. Buku ya vurimi, ku tsala, ririmi.`,
  xitsonga_first_additional: `Matric Xitsonga FAL tutor. Ku twisisa, ku tsala, ririmi.`,

  // Tshivenda
  tshivenda_home_language: `Matric Tshivenda Home Language tutor. Bugu ya vhanaṱanga, u ṅwala, luambo.`,
  tshivenda_first_additional: `Matric Tshivenda FAL tutor. U takala, u ṅwala, luambo.`,

  // Technology & Arts
  computer_applications_technology: `Matric CAT tutor. Spreadsheets, word processing, databases, presentations, internet.`,
  information_technology: `Matric IT tutor. Programming (Delphi/Python), algorithms, SQL, data structures, networks, system technologies.`,
  tourism: `Matric Tourism tutor. Mapwork, tourism sectors, sustainable tourism, attractions, customer service.`,
  dramatic_arts: `Matric Dramatic Arts tutor. Theatre history, performance skills, play analysis, directing, design.`,
  visual_arts: `Matric Visual Arts tutor. Art history, drawing, painting, sculpture, printmaking, conceptual art.`,
  music: `Matric Music tutor. Music theory, aural training, composition, music history, performance.`,
  civil_technology: `Matric Civil Technology tutor. Carpentry, plumbing, masonry, construction, safety.`,
  electrical_technology: `Matric Electrical Technology tutor. Circuits, electronics, digital systems, electrical installations.`,
  mechanical_technology: `Matric Mechanical Technology tutor. Workshop practice, materials, machines, fitting & turning.`,
  engineering_graphic_and_design: `Matric EGD tutor. Technical drawing, CAD, isometric views, sectional views, orthographic projection.`,
}

const DEFAULT_PROMPT = `Matric tutor. Be concise and helpful.`

// Science subjects that benefit from ASCII diagrams
const SCIENCE_SUBJECTS = ['physical_sciences', 'life_sciences', 'geography', 'agricultural_sciences']

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

    const subjectPrompt = subject ? SUBJECT_PROMPTS[subject] || DEFAULT_PROMPT : DEFAULT_PROMPT
    const isScience = subject && SCIENCE_SUBJECTS.includes(subject)

    let fullSystemPrompt = `${subjectPrompt}${stylePrompt ? ' ' + stylePrompt : ''} Be brief. Use Markdown. IMPORTANT: When giving practice questions, NEVER include the answers or solutions. Only provide questions. When the student says "give me the answers", "show solutions", "reveal answers", or similar, then provide the full solutions and explanations.`

    // Add illustration instructions for science subjects
    if (isScience) {
      fullSystemPrompt += ` VISUAL LEARNING: When explaining concepts that benefit from visual representation (diagrams, processes, structures, cycles, systems), include ASCII diagrams using box-drawing characters (─, │, ┌, ┐, └, ┘, ├, ┤, ┬, ┼), arrows (→, ↑, ↓, ←), and clear labels. Make diagrams exam-ready and easy to understand. Good topics for diagrams: cell structures, chemical reactions, circuits, rock cycles, food webs, river cross-sections, soil profiles, anatomical structures, wave diagrams, force diagrams, etc. Keep diagrams compact but informative.`
    }

    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: fullSystemPrompt,
      messages: await convertToModelMessages(messages),
      maxOutputTokens: 2000,
      temperature: 0.1,
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
