// api/tutor.ts — AI Tutor endpoint (Enhanced with Self-Healing & Context)

import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY });

export const maxDuration = 60; // Increased for retries
export const runtime = 'nodejs';

// Self-healing config
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT = 25000; // 25s timeout

// Subject-specific prompts
const SUBJECT_PROMPTS: Record<string, string> = {
  mathematics: `South African Matric CAPS Mathematics tutor. Algebra, Calculus, Geometry, Trig, Stats. Show working steps. Be concise.`,
  mathematical_literacy: `South African Matric CAPS Maths Lit tutor. Budgets, loans, measurement, data. Use practical examples. Be concise.`,
  physical_sciences: `South African Matric CAPS Physical Sciences tutor. Physics & Chemistry. Show formulas. Be concise.`,
  life_sciences: `South African Matric CAPS Life Sciences tutor. Cells, Genetics, Evolution, Human Physiology. Be concise.`,
  agricultural_sciences: `South African Matric CAPS Agricultural Sciences tutor. Soil, Plant, Animal production. Be concise.`,
  accounting: `South African Matric CAPS Accounting tutor. Financial statements, Bookkeeping, Cash flow, VAT. Be concise.`,
  business_studies: `South African Matric CAPS Business Studies tutor. Business, Management, HR, Marketing. Be concise.`,
  economics: `South African Matric CAPS Economics tutor. Micro, Macro, GDP, Inflation, Markets. Be concise.`,
  geography: `South African Matric CAPS Geography tutor. Climate, Geomorphology, Mapwork, Development. Be concise.`,
  history: `South African Matric CAPS History tutor. Cold War, Apartheid, Civil rights, Globalization. Be concise.`,
  life_orientation: `South African Matric CAPS LO tutor. Self-development, Careers, Health, Democracy. Be concise.`,
  english_home_language: `South African Matric CAPS English Home Language tutor. Literature, Writing, Essays. Be concise.`,
  english_first_additional: `South African Matric CAPS English FAL tutor. Comprehension, Summary, Writing. Be concise.`,
  afrikaans_home_language: `South African Matric CAPS Afrikaans HT tutor. Letterkunde, Opstelle, Taal. Be concise.`,
  afrikaans_first_additional: `South African Matric CAPS Afrikaans EAT tutor. Begrip, Opsomming, Taal. Be concise.`,
  isizulu_home_language: `South African Matric CAPS isiZulu Home tutor. Be concise.`,
  isizulu_first_additional: `South African Matric CAPS isiZulu FAL tutor. Be concise.`,
  isixhosa_home_language: `South African Matric CAPS isiXhosa Home tutor. Be concise.`,
  isixhosa_first_additional: `South African Matric CAPS isiXhosa FAL tutor. Be concise.`,
  sepedi_home_language: `South African Matric CAPS Sepedi Home tutor. Be concise.`,
  sepedi_first_additional: `South African Matric CAPS Sepedi FAL tutor. Be concise.`,
  setswana_home_language: `South African Matric CAPS Setswana Home tutor. Be concise.`,
  setswana_first_additional: `South African Matric CAPS Setswana FAL tutor. Be concise.`,
  sesotho_home_language: `South African Matric CAPS Sesotho Home tutor. Be concise.`,
  sesotho_first_additional: `South African Matric CAPS Sesotho FAL tutor. Be concise.`,
  siswati_home_language: `South African Matric CAPS siSwati Home tutor. Be concise.`,
  siswati_first_additional: `South African Matric CAPS siSwati FAL tutor. Be concise.`,
  isindebele_home_language: `South African Matric CAPS isiNdebele Home tutor. Be concise.`,
  isindebele_first_additional: `South African Matric CAPS isiNdebele FAL tutor. Be concise.`,
  xitsonga_home_language: `South African Matric CAPS Xitsonga Home tutor. Be concise.`,
  xitsonga_first_additional: `South African Matric CAPS Xitsonga FAL tutor. Be concise.`,
  tshivenda_home_language: `South African Matric CAPS Tshivenda Home tutor. Be concise.`,
  tshivenda_first_additional: `South African Matric CAPS Tshivenda FAL tutor. Be concise.`,
  computer_applications_technology: `South African Matric CAPS CAT tutor. Spreadsheets, Databases, Internet. Be concise.`,
  information_technology: `South African Matric CAPS IT tutor. Programming, Algorithms, SQL, Networks. Be concise.`,
  tourism: `South African Matric CAPS Tourism tutor. Mapwork, Tourism sectors, Attractions. Be concise.`,
  dramatic_arts: `South African Matric CAPS Dramatic Arts tutor. Theatre, Performance, Design. Be concise.`,
  visual_arts: `South African Matric CAPS Visual Arts tutor. Art history, Drawing, Painting. Be concise.`,
  music: `South African Matric CAPS Music tutor. Theory, Aural, Composition, History. Be concise.`,
  civil_technology: `South African Matric CAPS Civil Technology tutor. Carpentry, Plumbing, Construction. Be concise.`,
  electrical_technology: `South African Matric CAPS Electrical Technology tutor. Circuits, Electronics. Be concise.`,
  mechanical_technology: `South African Matric CAPS Mechanical Technology tutor. Workshop, Materials, Machines. Be concise.`,
  engineering_graphic_and_design: `South African Matric CAPS EGD tutor. Technical drawing, CAD, Orthographic. Be concise.`,
};

const DEFAULT_PROMPT = `South African Matric CAPS tutor. Be concise and helpful.`;

const FALLBACK_REPLY = "⚠️ AI failed to respond. Please try again.";

// Extract text from various message formats
function extractTextFromMessage(msg: any): string {
  if (typeof msg.content === 'string' && msg.content.trim()) {
    return msg.content;
  }
  
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('\n');
  }
  
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('\n');
  }
  
  return '';
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Check for API key
    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY is not set');
      return new Response(JSON.stringify({ reply: FALLBACK_REPLY }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body - handle both formats: { message: string } and { messages: [] }
    const body = await req.json();
    let userMessage = '';
    let historyMessages: any[] = [];
    
    // Handle new simple format: { message: string }
    if (body.message && typeof body.message === 'string') {
      userMessage = body.message;
    }
    // Handle array messages format: { messages: [...] }
    else if (body.messages && Array.isArray(body.messages)) {
      historyMessages = body.messages;
      // Get the last user message
      const lastUserMsg = [...historyMessages].reverse().find((m: any) => m.role === 'user');
      if (lastUserMsg) {
        userMessage = extractTextFromMessage(lastUserMsg);
      }
    }
    
    const subject = body.subject as string | undefined;

    // Validate we have a message
    if (!userMessage || userMessage.trim().length === 0) {
      return new Response(JSON.stringify({ reply: FALLBACK_REPLY }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build system prompt
    const subjectPrompt = subject ? SUBJECT_PROMPTS[subject] || DEFAULT_PROMPT : DEFAULT_PROMPT;
    let systemPrompt = `${subjectPrompt} Be a helpful tutor: answer questions directly, explain step by step, and use examples. If the student asks for practice or a quiz, give them questions. Otherwise, be direct and helpful.`;

    // Add science-specific instructions
    const scienceSubjects = ['physical_sciences', 'life_sciences'];
    if (subject && scienceSubjects.includes(subject)) {
      systemPrompt += ` Use simple ASCII diagrams when needed.`;
    }

    // Build messages for AI - include conversation history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    
    // Add conversation history (excluding the last user message which we'll add separately)
    if (historyMessages.length > 0) {
      historyMessages.forEach((msg: any) => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          const text = extractTextFromMessage(msg);
          if (text) {
            messages.push({ role: msg.role, content: text });
          }
        }
      });
    }
    
    // Add current message
    messages.push({ role: 'user', content: userMessage.trim() });

    // Call AI with self-healing (retry + fallback)
    console.log('Calling AI with self-healing...');
    let reply = await executeWithSelfHealing(messages);

    // Ensure we always have a valid response
    if (!reply || reply.length === 0) {
      reply = FALLBACK_REPLY;
    }

    console.log('Returning reply:', reply.substring(0, 100) + '...');

    // Return simple JSON response
    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Tutor API Error:', error?.message || error);
    
    // Always return a valid response, never crash
    return new Response(JSON.stringify({ reply: FALLBACK_REPLY }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Self-healing AI execution with retry + fallback
async function executeWithSelfHealing(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<string> {
  const providers = [
    { name: 'Groq', execute: () => generateText({ model: groq('llama-3.3-70b-versatile'), messages, maxOutputTokens: 2048, temperature: 0.3 }) },
    { name: 'Google', execute: () => generateText({ model: google('gemini-2.0-flash'), messages, maxOutputTokens: 2048, temperature: 0.3 }) },
  ];

  let lastError: string = '';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    for (const provider of providers) {
      try {
        // Timeout wrapper
        const result = await Promise.race([
          provider.execute(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), REQUEST_TIMEOUT))
        ]) as any;
        
        const text = result?.text?.trim();
        if (text) {
          console.log(`AI success via ${provider.name}`);
          return text;
        }
      } catch (error: any) {
        lastError = error?.message || String(error);
        console.warn(`${provider.name} failed (attempt ${attempt + 1}):`, lastError);
      }
    }
  }

  console.error('All AI providers failed:', lastError);
  return '';
}
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}