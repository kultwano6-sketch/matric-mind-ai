// api/tutor.ts — Unified AI Tutor Endpoint
// FIXED: Node runtime, no streaming, proper JSON response

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 60;
export const runtime = 'nodejs';

// Subject-specific prompts - CAPS aligned
const SUBJECT_PROMPTS: Record<string, string> = {
  mathematics: `South African Matric CAPS Mathematics tutor. Topics: Algebra, Calculus, Geometry, Trigonometry, Statistics, Finance. Show step-by-step working. Use CAPS terminology. Be concise and accurate.`,
  mathematical_literacy: `South African Matric CAPS Mathematical Literacy tutor. Topics: Finance, Measurement, Maps, Data handling. Use practical real-world examples. Be concise.`,
  physical_sciences: `South African Matric CAPS Physical Sciences tutor. Physics & Chemistry - Mechanics, Waves, Electricity, Matter, Chemical reactions, Equilibrium. Show formulas and working. Use CAPS terminology.`,
  life_sciences: `South African Matric CAPS Life Sciences tutor. Topics: Cell Biology, Genetics, Evolution, Ecology, Human Physiology, Biodiversity. Use CAPS terminology and explain concepts clearly.`,
  agricultural_sciences: `South African Matric CAPS Agricultural Sciences tutor. Soil Science, Plant Production, Animal Production. Use CAPS curriculum.`,
  accounting: `South African Matric CAPS Accounting tutor. Topics: Financial Statements, Cost Accounting, Budgets, VAT, Assets. Use SA accounting standards.`,
  business_studies: `South African Matric CAPS Business Studies tutor. Topics: Business, Management, Marketing, HR. Use CAPS curriculum.`,
  economics: `South African Matric CAPS Economics tutor. Topics: Microeconomics, Macroeconomics, GDP, Inflation, Fiscal & Monetary Policy. Use CAPS terminology.`,
  geography: `South African Matric CAPS Geography tutor. Topics: Geomorphology, Climate, Hydrology, Mapwork, Population, Economic Geography. Use CAPS.`,
  history: `South African Matric CAPS History tutor. Topics: South African History (Apartheid, Liberation), World History (Cold War, Decolonization). Use CAPS curriculum.`,
  life_orientation: `South African Matric CAPS Life Orientation tutor. Topics: Career development, Health, Democracy, Social issues. Use CAPS curriculum.`,
  english_home_language: `South African Matric CAPS English Home Language tutor. Literature (Novels, Poetry, Drama), Language, Essay writing. Use CAPS assessment.`,
  english_first_additional: `South African Matric CAPS English First Additional Language tutor. Comprehension, Summary, Writing, Grammar. Use CAPS curriculum.`,
  default: `You are Matric Mind AI, a helpful South African matric study assistant. Follow CAPS curriculum for Grade 12. Be concise, accurate, and encouraging.`,
};

// Get subject-specific system prompt
function getSystemPrompt(subject?: string): string {
  if (!subject) return SUBJECT_PROMPTS.default;
  const key = subject.toLowerCase().replace(/[^a-z_]/g, '');
  return SUBJECT_PROMPTS[key] || SUBJECT_PROMPTS.default;
}

export default async function handler(req: Request) {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse request body - STANDARDIZE to { message: string }
    const body = await req.json();
    
    // Support both "message" and "prompt" for backward compatibility
    const message = body?.message || body?.prompt || '';
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Message is required',
        reply: 'Please provide a question or topic to learn about.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const subject = body?.subject || 'general';
    const studentContext = body?.student_context || null;
    
    // Build system prompt with student context if available
    let systemPrompt = getSystemPrompt(subject);
    
    if (studentContext) {
      const contextInfo = `
STUDENT PROFILE:
- Name: ${studentContext.name || 'Student'}
- Weak subjects: ${studentContext.weak_subjects?.join(', ') || 'None identified'}
- Recent performance: ${studentContext.recent_performance || 'No data yet'}
- Focus areas: ${studentContext.focus_areas?.join(', ') || 'General study'}

Adapt your responses to help with weak areas and build on existing knowledge.`;
      systemPrompt += contextInfo;
    }

    // Generate response using non-streaming
    const { text } = await generateText({
      model: groq(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'),
      system: systemPrompt,
      prompt: message.trim(),
      maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
      temperature: 0.7,
    });

    // Ensure response is never empty
    const reply = (text && text.trim().length > 0) 
      ? text.trim() 
      : 'I apologize, but I could not generate a proper response. Please try rephrasing your question or ask about a specific topic.';

    return new Response(JSON.stringify({ 
      reply,
      subject,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Tutor API Error:', error);
    
    // Always return a valid response with fallback
    return new Response(JSON.stringify({ 
      error: 'Failed to process request',
      reply: '⚠️ AI service temporarily unavailable. Please try again in a moment, or try a different question.',
      fallback: true,
    }), {
      status: 200, // Return 200 with fallback to prevent UI crash
      headers: { 'Content-Type': 'application/json' },
    });
  }
}