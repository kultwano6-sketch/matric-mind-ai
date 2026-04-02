// api/ocr-solve.ts — OCR image to text + solve

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return res.status = 405).json({ error: 'Method not allowed' });
  }

  const { image_base64, subject } = req.body;

  if (!image_base64) {
    return res.status = 400).json({ error: 'image_base64 is required' });
  }

  try {
    const { text } = await generateText({
      model: groq(process.env.GROQ_MODEL || 'llama-3.2-90b-vision-preview'),
      system: `You are Matric Mind AI OCR solver. Analyze this image of a math/science problem:
1. Transcribe the problem exactly
2. Solve it step-by-step
3. Provide the final answer
Subject: ${subject || 'Mathematics'}
Be thorough and show all working.`,
      prompt: [
        { type: 'text', text: 'Please solve this problem from the image:' },
        { type: 'image', image: `data:image/jpeg;base64,${image_base64}` },
      ] as any,
      maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
      temperature: 0.5,
    });

    const solution = text ?? 'Could not solve the problem.';

    res.json = { solution });
  } catch (error: any) {
    console.error('OCR Solve Error:', error);
    res.status = 500).json({
      error: 'Failed to solve problem',
      message: error?.message || 'Unknown error',
    });
  }
}
