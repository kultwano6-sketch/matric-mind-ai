// api/ocr-solve.ts — OCR image to text + solve
import type { Request, Response } from 'express';
import { groq, GROQ_MODEL } from '../server/production.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image_base64, subject } = req.body;

  if (!image_base64) {
    return res.status(400).json({ error: 'image_base64 is required' });
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are Matric Mind AI OCR solver. Analyze this image of a math/science problem:
1. Transcribe the problem exactly
2. Solve it step-by-step
3. Provide the final answer
Subject: ${subject || 'Mathematics'}
Be thorough and show all working.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Please solve this problem from the image:' },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${image_base64}` },
            },
          ],
        } as any,
      ],
      model: GROQ_MODEL,
      max_tokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
      temperature: 0.5,
    });

    const solution =
      completion.choices[0]?.message?.content ?? 'Could not solve the problem.';

    res.json({ solution });
  } catch (error: any) {
    console.error('OCR Solve Error:', error);
    res.status(500).json({
      error: 'Failed to solve problem',
      message: error?.message || 'Unknown error',
    });
  }
}
