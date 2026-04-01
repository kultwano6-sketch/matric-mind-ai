// api/snapsolve.ts — Snap & Solve (image-based homework help)
import type { Request, Response } from 'express';
import { groq, GROQ_MODEL } from '../server/production.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image_base64, subject, question } = req.body;

  if (!image_base64 && !question) {
    return res.status(400).json({ error: 'Either image_base64 or question is required' });
  }

  try {
    const userContent: any[] = [];
    if (question) {
      userContent.push({ type: 'text', text: question });
    }
    if (image_base64) {
      // Validate base64 format
      if (!/^[A-Za-z0-9+/]+=*$/.test(image_base64.substring(0, 100))) {
        return res.status(400).json({ error: 'Invalid image data format' });
      }
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${image_base64}` },
      });
    }

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are Matric Mind AI SnapSolve. Analyze the image/question and provide:
1. The problem statement (what you see)
2. Step-by-step solution
3. Final answer
Subject: ${subject || 'Mathematics'}. Be clear and show all working.`,
        },
        { role: 'user', content: userContent.length > 0 ? userContent : question },
      ],
      model: GROQ_MODEL,
      max_tokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
      temperature: 0.5,
    });

    const solution =
      completion.choices[0]?.message?.content ?? 'Could not solve the problem. Please try again.';

    res.json({ solution });
  } catch (error: any) {
    console.error('SnapSolve API Error:', error);
    res.status(500).json({
      error: 'Failed to solve problem',
      message: error?.message || 'Unknown error',
    });
  }
}
