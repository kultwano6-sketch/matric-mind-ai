// api/parent-report.ts — Generate parent report
import type { Request, Response } from 'express';
import { groq, GROQ_MODEL } from '../server/production.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, student_name, period, performance_data } = req.body;

  if (!student_id || !student_name) {
    return res.status(400).json({ error: 'student_id and student_name are required' });
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are generating a parent-friendly progress report for a South African matric student. 
Write in clear, supportive language. Include:
1. Overall performance summary
2. Subject-by-subject breakdown
3. Strengths and areas for improvement
4. Recommended actions for parents to support their child
5. Upcoming exam preparation advice

Keep it professional but warm.`,
        },
        {
          role: 'user',
          content: `Student: ${student_name}\nPeriod: ${period || 'This term'}\nPerformance data: ${JSON.stringify(performance_data || {})}`,
        },
      ],
      model: GROQ_MODEL,
      max_tokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
      temperature: 0.6,
    });

    const report =
      completion.choices[0]?.message?.content ?? 'Report generation failed.';

    res.json({
      success: true,
      report,
      student_name,
      period: period || 'This term',
    });
  } catch (error: any) {
    console.error('Parent Report Error:', error);
    res.status(500).json({
      error: 'Failed to generate report',
      message: error?.message || 'Unknown error',
    });
  }
}
