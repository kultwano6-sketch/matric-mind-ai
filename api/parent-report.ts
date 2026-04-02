// api/parent-report.ts — Generate parent report
import type { Request, Response } from 'express';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, student_name, period, performance_data } = req.body;

  if (!student_id || !student_name) {
    return res.status(400).json({ error: 'student_id and student_name are required' });
  }

  try {
    const { text } = await generateText({
      model: groq(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'),
      system: `You are generating a parent-friendly progress report for a South African matric student. 
Write in clear, supportive language. Include:
1. Overall performance summary
2. Subject-by-subject breakdown
3. Strengths and areas for improvement
4. Recommended actions for parents to support their child
5. Upcoming exam preparation advice

Keep it professional but warm.`,
      prompt: `Student: ${student_name}\nPeriod: ${period || 'This term'}\nPerformance data: ${JSON.stringify(performance_data || {})}`,
      maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
      temperature: 0.6,
    });

    const report = text ?? 'Report generation failed.';

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
