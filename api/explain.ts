// api/explain.ts — Explain a mistake (FIXED: Consistent reply format)

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export const maxDuration = 30;
export const runtime = 'nodejs';

const FALLBACK_REPLY = "⚠️ AI failed to respond. Please try again.";

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { question, student_answer, correct_answer, subject, topic } = body;

  if (!question || !correct_answer) {
    return new Response(JSON.stringify({ reply: FALLBACK_REPLY }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { text: explanation } = await generateText({
      model: groq(GROQ_MODEL),
      messages: [
        {
          role: 'system',
          content: `You are Matric Mind AI. A student got this question wrong. Explain:
1. Why the correct answer is right
2. Common misconceptions that lead to the wrong answer
3. A memory tip or technique to remember this concept
Subject: ${subject || 'General'}. Topic: ${topic || 'N/A'}. Be encouraging — mistakes are learning opportunities!`,
        },
        {
          role: 'user',
          content: `Question: ${question}\nStudent's answer: ${student_answer || '(no answer given)'}\nCorrect answer: ${correct_answer}`,
        },
      ],
      maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
      temperature: 0.6,
    });

    // Ensure non-empty response
    const reply = (explanation?.trim() || '').length > 0 ? explanation.trim() : FALLBACK_REPLY;

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Explain API Error:', error);
    // Always return valid response
    return new Response(JSON.stringify({ reply: FALLBACK_REPLY }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}