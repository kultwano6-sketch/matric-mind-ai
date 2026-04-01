// api/study-recommendations.ts — AI study recommendations
import type { Request, Response } from 'express';
import { groq, GROQ_MODEL } from '../server/production.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, subject, weak_areas } = req.body;

  if (!student_id) {
    return res.status(400).json({ error: 'student_id is required' });
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are Matric Mind AI study planner. Generate personalised study recommendations for a South African matric student.
Return ONLY valid JSON array:
[{"topic": "...", "reason": "...", "priority": 1, "subject": "...", "estimated_minutes": 30}]
Prioritise weak areas. Max 5 recommendations.
No markdown, no backticks.`,
        },
        {
          role: 'user',
          content: `Student ID: ${student_id}\nSubject: ${subject || 'All subjects'}\nWeak areas: ${JSON.stringify(weak_areas || [])}`,
        },
      ],
      model: GROQ_MODEL,
      max_tokens: parseInt(process.env.GROQ_MAX_TOKENS || '1024', 10),
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    let recommendations = [];
    if (content) {
      try {
        const cleaned = content.replace(/```json\s?|\s?```/g, '').trim();
        recommendations = JSON.parse(cleaned);
      } catch (e) {
        console.error('Failed to parse recommendations:', content);
      }
    }

    res.json({
      success: true,
      recommendations,
    });
  } catch (error: any) {
    console.error('Study Recommendations Error:', error);
    res.status(500).json({
      error: 'Failed to generate recommendations',
      message: error?.message || 'Unknown error',
    });
  }
}
