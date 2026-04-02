// api/parent-report.ts — Generate parent report (Web API)

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { student_id, student_name, period, performance_data } = body;

  if (!student_id || !student_name) {
    return new Response(JSON.stringify({ error: 'student_id and student_name are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
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

    return new Response(JSON.stringify({
      success: true,
      report,
      student_name,
      period: period || 'This term',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Parent Report Error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate report',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
