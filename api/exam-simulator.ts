// api/exam-simulator.ts — Exam simulation with AI-generated papers
import type { Request, Response } from 'express';
import { groq, GROQ_MODEL } from '../server/production.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, subject, difficulty } = req.body;

  if (!subject) {
    return res.status(400).json({ error: 'subject is required' });
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Generate a realistic South African matric exam paper for ${subject}.
Difficulty: ${difficulty || 'medium'}.

Return ONLY valid JSON:
{
  "exam_id": "exam_${Date.now()}",
  "title": "${subject} Mock Exam",
  "instructions": "Answer all questions.",
  "total_marks": 100,
  "time_limit_min": 120,
  "sections": [{"name": "Section A", "questions": [1, 2, 3]}],
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "question": "...",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct_answer": "A",
      "marks": 5,
      "topic": "...",
      "marking_criteria": ["..."]
    }
  ],
  "marking_rubric": [{"id": 1, "topic": "...", "marks": 5, "criteria": ["..."]}]
}
Generate 10-15 questions. No markdown, no backticks.`,
        },
      ],
      model: GROQ_MODEL,
      max_tokens: parseInt(process.env.GROQ_MAX_TOKENS || '4096', 10),
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: 'Failed to generate exam' });
    }

    const cleaned = content.replace(/```json\s?|\s?```/g, '').trim();
    const examData = JSON.parse(cleaned);

    res.json(examData);
  } catch (error: any) {
    console.error('Exam Simulator Error:', error);
    res.status(500).json({
      error: 'Failed to generate exam',
      message: error?.message || 'Unknown error',
    });
  }
}
