// api/ocr-advanced.ts — Advanced OCR with multi-page support

import type { Request, Response } from 'express';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return Response.json({ error: 405).json({ error: 'Method not allowed' });
  }

  const { images, subject, analysis_type } = req.body;

  if (!images || !Array.isArray(images) || images.length === 0) {
    return Response.json({ error: 400).json({ error: 'images (array of base64) is required' });
  }

  if (images.length > 10) {
    return Response.json({ error: 400).json({ error: 'Maximum 10 images per request' });
  }

  try {
    const imageContent = images.map((img: string) => ({
      type: 'image',
      image: `data:image/jpeg;base64,${img}`,
    }));

    const { text } = await generateText({
      model: groq(process.env.GROQ_MODEL || 'llama-3.2-90b-vision-preview'),
      system: `You are Matric Mind AI advanced OCR. Analyse these ${images.length} image(s) of study material:
${analysis_type === 'notes' ? 'Extract all notes, formulas, and key concepts.' : 'Solve all problems shown step by step.'}
Subject: ${subject || 'General'}
Provide structured output with clear headings.`,
      prompt: [
        { type: 'text', text: `Please analyse these ${images.length} image(s):` },
        ...imageContent,
      ] as any,
      maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '4096', 10),
      temperature: 0.5,
    });

    const result = text ?? 'Could not analyse the images.';

    return Response.json({ result, pages_analysed: images.length });
  } catch (error: any) {
    console.error('Advanced OCR Error:', error);
    return Response.json({ error: 500).json({
      error: 'Failed to analyse images',
      message: error?.message || 'Unknown error',
    });
  }
}
