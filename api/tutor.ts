import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 60;

interface TutorMessage {
  role: string;
  content: string;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await req.json();
    const { messages, subject } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages array required' }), { status: 400 });
    }

    const systemPrompt = `You are Matric Mind AI, an expert South African matric tutor for ${subject || 'general studies'}. Help students understand concepts step by step. Be encouraging, clear, and use CAPS-aligned examples where relevant.`;

    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages: messages.map((m: TutorMessage) => ({ role: m.role, content: m.content })),
      maxTokens: 2048,
      temperature: 0.7,
    });

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error('Tutor error:', error);
    return new Response(JSON.stringify({ error: 'Tutor failed', message: error?.message }), { status: 500 });
  }
}
