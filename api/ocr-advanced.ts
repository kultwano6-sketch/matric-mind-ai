// api/ocr-advanced.ts — Advanced OCR with multi-page support
import type { Request, Response } from 'express';
import { groq, GROQ_MODEL } from '../server/production.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { images, subject, analysis_type } = req.body;

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'images (array of base64) is required' });
  }

  if (images.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 images per request' });
  }

  try {
    const imageContent = images.map((img: string) => ({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${img}` },
    }));

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are Matric Mind AI advanced OCR. Analyse these ${images.length} image(s) of study material:
${analysis_type === 'notes' ? 'Extract all notes, formulas, and key concepts.' : 'Solve all problems shown step by step.'}
Subject: ${subject || 'General'}
Provide structured output with clear headings.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Please analyse these ${images.length} image(s):` },
            ...imageContent,
          ] as any,
        } as any,
      ],
      model: GROQ_MODEL,
      max_tokens: parseInt(process.env.GROQ_MAX_TOKENS || '4096', 10),
      temperature: 0.5,
    });

    const result =
      completion.choices[0]?.message?.content ?? 'Could not analyse the images.';

    res.json({ result, pages_analysed: images.length });
  } catch (error: any) {
    console.error('Advanced OCR Error:', error);
    res.status(500).json({
      error: 'Failed to analyse images',
      message: error?.message || 'Unknown error',
    });
  }
}
