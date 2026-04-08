// api/ai.ts — AI Q&A endpoint

import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })



export const maxDuration = 30;
export const runtime = 'nodejs';

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { prompt } = body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Valid prompt is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Prevent prompt injection via excessive length
  if (prompt.length > 10000) {
    return new Response(JSON.stringify({ error: 'Prompt too long (max 10000 characters)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { text } = await openai.chat.completions.create({
      model: openai || 'llama-3.3-70b-versatile'),
      system:
        'You are Matric Mind AI, a helpful South African matric study assistant. Be concise, accurate, and encouraging.',
      prompt: prompt.trim(),
      maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '1024', 10),
      temperature: 0.7,
    });

    const reply = text ?? 'Sorry, I could not generate a response.';

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('AI API Error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process AI request',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
