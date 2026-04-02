// api/matric-readiness.ts — Matric exam readiness assessment
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { student_id, subjects, performance_data } = body;

  if (!student_id) {
    return new Response(
      JSON.stringify({ error: 'student_id is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { text } = await generateText({
      model: groq(MODEL),
      system: `You are a South African matric exam readiness advisor. Analyse the student's performance data and provide:
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
      prompt: `Subjects: ${JSON.stringify(subjects || [])}\nPerformance data: ${JSON.stringify(performance_data || {})}`,
      maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
      temperature: 0.6,
    });

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate readiness assessment' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cleaned = text.replace(/```json\s?|\s?```/g, '').trim();
    const assessment = JSON.parse(cleaned);

    return new Response(
      JSON.stringify(assessment),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Matric Readiness Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to assess readiness',
        message: error?.message || 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
