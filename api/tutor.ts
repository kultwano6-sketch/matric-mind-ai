// api/tutor.ts — AI Tutor endpoint
import type { Request, Response } from 'express';
import { groq, GROQ_MODEL } from '../server/production.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, subject, context } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Valid message is required' });
  }

  if (message.length > 10000) {
    return res.status(400).json({ error: 'Message too long (max 10000 characters)' });
  }

  try {
    const systemPrompt = `You are Matric Mind AI, an expert South African matric tutor for ${subject || 'general studies'}. 
You help students understand concepts step by step. Be encouraging and clear.
${context ? `Context: ${context}` : ''}`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message.trim() },
      ],
      model: GROQ_MODEL,
      max_tokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
      temperature: 0.7,
    });

    const reply =
      completion.choices[0]?.message?.content ?? 'I could not generate a response. Please try again.';

    res.json({ reply });
  } catch (error: any) {
    console.error('Tutor API Error:', error);
    res.status(500).json({
      error: 'Failed to get tutor response',
      message: error?.message || 'Unknown error',
    });
  }
}
