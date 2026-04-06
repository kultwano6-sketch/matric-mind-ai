// api/textbook-scan.ts — Textbook page scanning and analysis

import type { Request, Response } from 'express';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, subject, image_base64, chapter_hint } = req.body;

  if (!image_base64) {
    return res.status(400).json({ error: 'image_base64 is required' });
  }

  if (!student_id) {
    return res.status(400).json({ error: 'student_id is required' });
  }

  try {
    const { text } = await generateText({
      model: groq(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'),
      system: `Analyse this textbook page for South African matric ${subject || 'studies'}.
${chapter_hint ? `Chapter hint: ${chapter_hint}` : ''}

Return ONLY valid JSON:
{
  "chapter": "detected chapter name",
  "headings": ["heading1", "heading2"],
  "key_concepts": ["concept1", "concept2"],
  "questions": ["question1", "question2"],
  "formulas": ["formula1", "formula2"],
  "suggested_topics": ["topic1", "topic2"]
}
No markdown, no backticks.`,
      prompt: `Analyse this textbook page: [image provided as base64 data:jpeg;base64,${image_base64}]`,
      maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
      temperature: 0.4,
    });

    if (!text) {
      return res.status(500).json({ error: 'Failed to analyse textbook page' });
    }

    const cleaned = text.replace(/```json\s?|\s?```/g, '').trim();
    const scanResult = JSON.parse(cleaned);

    return res.json({
      success: true,
      scan_id: `scan_${Date.now()}`,
      result: scanResult,
    });
  } catch (error: any) {
    console.error('Textbook Scan Error:', error);
    return res.status(500).json({
      error: 'Failed to scan textbook',
      message: error?.message || 'Unknown error',
    });
  }
}
