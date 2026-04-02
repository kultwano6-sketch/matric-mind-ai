// api/conversation-mode.ts — Multi-turn AI conversation (Web API)

import { createGroq } from '@ai-sdk/groq';
import { generateText, streamText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

// In-memory session store (use Redis/DB in production)
const sessions: Map<
  string,
  { messages: Array<{ role: string; content: string }>; created_at: number }
> = new Map();

// Clean up stale sessions every 30 minutes
const SESSION_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now - session.created_at > SESSION_TTL_MS) {
      sessions.delete(key);
    }
  }
}, 5 * 60 * 1000); // Run cleanup every 5 minutes

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { session_id, student_id, subject, message } = body;

  if (!student_id || !subject || !message) {
    return new Response(JSON.stringify({ error: 'student_id, subject, and message are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionId = session_id || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  try {
    // Get or create session
    let session = sessions.get(sessionId);

    if (!session) {
      session = { messages: [], created_at: Date.now() };
      sessions.set(sessionId, session);
    }

    // Add user message
    session.messages.push({ role: 'user', content: message });

    // Build context for AI
    const subjectContext = `You are a helpful ${subject} tutor for South African matric students. Keep responses clear and educational.`;

    // Generate response
    const { text } = await generateText({
      model: groq(process.env.GROQ_MODEL || 'llama-3.1-8b-instant'),
      system: subjectContext,
      prompt: session.messages.map(m => `${m.role}: ${m.content}`).join('\n'),
      maxTokens: 1024,
      temperature: 0.7,
    });

    // Add assistant response
    session.messages.push({ role: 'assistant', content: text });

    return new Response(JSON.stringify({
      success: true,
      session_id: sessionId,
      response: text,
      message_count: session.messages.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('conversation-mode error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate response',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}