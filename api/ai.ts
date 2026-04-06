// api/ai.ts — AI Q&A endpoint

import type { Request, Response } from 'express';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

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
    const { text } = await generateText({
      model: groq(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'),
      system:
        'You are Matric Mind AI, a helpful South African matric study assistant. Be concise, accurate, and encouraging.',
      prompt: prompt.trim(),
      maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '1024', 10),
      temperature: 0.7,
    });

    const reply = text ?? 'Sorry, I could not generate a response.';

    return res.json({ reply });
  } catch (error: any) {
    console.error('AI API Error:', error);
    return res.status(500).json({
      error: 'Failed to process AI request',
      message: error?.message || 'Unknown error',
    });
  }
}
