// api/conversation-mode.ts — Multi-turn AI conversation
import type { Request, Response } from 'express';
import { groq, GROQ_MODEL } from '../server/production.js';

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

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id, student_id, subject, message } = req.body;

  if (!student_id || !subject || !message) {
    return res.status(400).json({ error: 'student_id, subject, and message are required' });
  }

  const sessionId = session_id || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  try {
    // Get or create session
    let session = sessions.get(sessionId);
    if (!session) {
      session = {
        messages: [
          {
            role: 'system',
            content: `You are Matric Mind AI, a friendly South African matric tutor specialising in ${subject}.
You hold multi-turn conversations to help students understand concepts deeply.
- Ask follow-up questions
- Use the Socratic method
- Be encouraging and patient
- Use South African English naturally
- Reference the South African curriculum when relevant`,
          },
        ],
        created_at: Date.now(),
      };
      sessions.set(sessionId, session);
    }

    // Add user message
    session.messages.push({ role: 'user', content: message });

    // Keep conversation context manageable (last 20 messages + system prompt)
    if (session.messages.length > 21) {
      session.messages = [
        session.messages[0], // system prompt
        ...session.messages.slice(-20),
      ];
    }

    const completion = await groq.chat.completions.create({
      messages: session.messages as any,
      model: GROQ_MODEL,
      max_tokens: parseInt(process.env.GROQ_MAX_TOKENS || '1024', 10),
      temperature: 0.7,
    });

    const assistantReply =
      completion.choices[0]?.message?.content ?? 'I lost my train of thought. Could you repeat that?';

    // Add assistant reply to session
    session.messages.push({ role: 'assistant', content: assistantReply });

    res.json({
      success: true,
      session_id: sessionId,
      response: assistantReply,
      message_count: session.messages.length - 1, // Exclude system prompt
    });
  } catch (error: any) {
    console.error('Conversation Mode Error:', error);
    res.status(500).json({
      error: 'Failed to process conversation',
      message: error?.message || 'Unknown error',
    });
  }
}
