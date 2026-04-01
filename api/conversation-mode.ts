// ============================================================
// Matric Mind AI - Conversation Mode API
// Multi-turn contextual conversation with AI tutor
// ============================================================

import { getSupabase } from '../server/supabaseClient';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 60;
export const runtime = 'edge';

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ConversationRequest {
  session_id?: string;
  student_id: string;
  subject: string;
  message: string;
  context?: string;
}

/**
 * POST /api/conversation-mode
 *
 * Multi-turn conversation with context retention.
 * Supports "explain again", "go deeper", and natural follow-ups.
 *
 * Body:
 * {
 *   session_id?: string,
 *   student_id: string,
 *   subject: string,
 *   message: string,
 *   context?: string
 * }
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: ConversationRequest = await req.json();
    const { session_id, student_id, subject, message, context } = body;

    if (!student_id || !subject || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields: student_id, subject, message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get or create conversation session
    let sessionId = session_id;
    let existingMessages: ConversationMessage[] = [];

    if (sessionId) {
      const { data: session } = await supabase
        .from('conversation_sessions')
        .select('messages_json')
        .eq('id', sessionId)
        .eq('student_id', student_id)
        .single();

      if (session) {
        existingMessages = (session.messages_json as ConversationMessage[]) || [];
      }
    }

    // Add user message to history
    existingMessages.push({
      role: 'user',
      content: message,
    });

    // Trim history to last 20 messages to stay within token limits
    const trimmedMessages = existingMessages.slice(-20);

    // Build system prompt for conversation mode
    const systemPrompt = `You are a friendly and knowledgeable Matric tutor for South African students studying ${subject.replace(/_/g, ' ')}.

You are currently in a CONVERSATION MODE with a student. This means:

1. **Context matters**: The student has been asking questions in this session. Reference previous messages naturally with phrases like "As we discussed earlier..." or "Building on what you asked before...".

2. **Follow-up friendly**: The student might say things like:
   - "Explain that again" → Re-explain the last concept in simpler terms
   - "Go deeper" → Provide more advanced details and examples
   - "Give me an example" → Provide a concrete example related to their question
   - "Why?" or "How?" → Elaborate on the reasoning
   - "What about X?" → Connect the current topic to X

3. **Conversational tone**: Be warm, encouraging, and natural. Use "we" language ("Let's work through this together").

4. **South African context**: Reference SA curriculum (CAPS), use SA examples when possible, and acknowledge the Matric exam context.

5. **Progressive learning**: Build on previous answers. If they understood concept A, connect concept B to it.

${context ? `\nAdditional context: ${context}` : ''}

Keep responses concise but thorough. Use formatting (bold, bullet points) for clarity.
When appropriate, suggest quiz topics or related areas to study.`;

    // Build messages for the AI
    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...trimmedMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // Generate AI response
    const { text } = await generateText({
      model: groq('llama-3.1-8b-instant'),
      messages: aiMessages,
      maxOutputTokens: 1024,
      temperature: 0.7,
    });

    // Add assistant response to history
    existingMessages.push({
      role: 'assistant',
      content: text,
    });

    // Save updated conversation
    if (sessionId) {
      await supabase
        .from('conversation_sessions')
        .update({
          messages_json: existingMessages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    } else {
      const { data: newSession } = await supabase
        .from('conversation_sessions')
        .insert({
          student_id,
          subject,
          messages_json: existingMessages,
        })
        .select('id')
        .single();
      sessionId = newSession?.id;
    }

    // Log activity
    await supabase.from('activity_log').insert({
      user_id: student_id,
      action: 'conversation_message',
      details: { session_id: sessionId, subject },
    });

    return new Response(JSON.stringify({
      success: true,
      session_id: sessionId,
      response: text,
      message_count: existingMessages.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Conversation mode error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Conversation failed',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
