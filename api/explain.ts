// api/explain.ts — Explain a mistake
import type { Request, Response } from 'express';
import { groq, GROQ_MODEL } from '../server/production.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, student_answer, correct_answer, subject, topic } = req.body;

  if (!question || !correct_answer) {
    return res.status(400).json({ error: 'question and correct_answer are required' });
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are Matric Mind AI. A student got this question wrong. Explain:
1. Why the correct answer is right
2. Common misconceptions that lead to the wrong answer
3. A memory tip or technique to remember this concept
Subject: ${subject || 'General'}. Topic: ${topic || 'N/A'}. Be encouraging — mistakes are learning opportunities!`,
        },
        {
          role: 'user',
          content: `Question: ${question}\nStudent's answer: ${student_answer || '(no answer given)'}\nCorrect answer: ${correct_answer}`,
        },
      ],
      model: GROQ_MODEL,
      max_tokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
      temperature: 0.6,
    });

    const explanation =
      completion.choices[0]?.message?.content ?? 'Explanation unavailable.';

    res.json({ explanation });
  } catch (error: any) {
    console.error('Explain API Error:', error);
    res.status(500).json({
      error: 'Failed to generate explanation',
      message: error?.message || 'Unknown error',
    });
  }
}
