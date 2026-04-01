// api/matric-readiness.ts — Matric exam readiness assessment
import type { Request, Response } from 'express';
import { groq, GROQ_MODEL } from '../server/production.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, subjects, performance_data } = req.body;

  if (!student_id) {
    return res.status(400).json({ error: 'student_id is required' });
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a South African matric exam readiness advisor. Analyse the student's performance data and provide:
1. Readiness score (0-100) per subject
2. Overall readiness assessment
3. Priority topics to study
4. Recommended study hours per week
5. Exam tips

Return ONLY valid JSON:
{
  "readiness_scores": {"subject": score},
  "overall_assessment": "...",
  "priority_topics": [{"subject": "...", "topics": ["..."]}],
  "recommended_hours_per_week": 20,
  "exam_tips": ["tip1", "tip2"]
}
No markdown, no backticks.`,
        },
        {
          role: 'user',
          content: `Subjects: ${JSON.stringify(subjects || [])}\nPerformance data: ${JSON.stringify(performance_data || {})}`,
        },
      ],
      model: GROQ_MODEL,
      max_tokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
      temperature: 0.6,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: 'Failed to generate readiness assessment' });
    }

    const cleaned = content.replace(/```json\s?|\s?```/g, '').trim();
    const assessment = JSON.parse(cleaned);

    res.json(assessment);
  } catch (error: any) {
    console.error('Matric Readiness Error:', error);
    res.status(500).json({
      error: 'Failed to assess readiness',
      message: error?.message || 'Unknown error',
    });
  }
}
