// api/ai.ts — AI Q&A endpoint
import type { Request, Response } from 'express';
import { groq, GROQ_MODEL } from '../server/production.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Valid prompt is required' });
  }

  // Prevent prompt injection via excessive length
  if (prompt.length > 10000) {
    return res.status(400).json({ error: 'Prompt too long (max 10000 characters)' });
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You are Matric Mind AI, a helpful South African matric study assistant. Be concise, accurate, and encouraging.',
        },
        { role: 'user', content: prompt.trim() },
      ],
      model: GROQ_MODEL,
      max_tokens: parseInt(process.env.GROQ_MAX_TOKENS || '1024', 10),
      temperature: 0.7,
    });

    const reply =
      completion.choices[0]?.message?.content ?? 'Sorry, I could not generate a response.';

    res.json({ reply });
  } catch (error: any) {
    console.error('AI API Error:', error);
    res.status(500).json({
      error: 'Failed to process AI request',
      message: error?.message || 'Unknown error',
    });
  }
}
