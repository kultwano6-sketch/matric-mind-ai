// api/study-recommendations.ts — AI study recommendations
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
  const { student_id, subject, weak_areas } = body;

  if (!student_id) {
    return new Response(
      JSON.stringify({ error: 'student_id is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { text } = await generateText({
      model: groq(MODEL),
      system: `You are Matric Mind AI study planner. Generate personalised study recommendations for a South African matric student.
Return ONLY valid JSON array:
[{"topic": "...", "reason": "...", "priority": 1, "subject": "...", "estimated_minutes": 30}]
Prioritise weak areas. Max 5 recommendations.
No markdown, no backticks.`,
      prompt: `Student ID: ${student_id}\nSubject: ${subject || 'All subjects'}\nWeak areas: ${JSON.stringify(weak_areas || [])}`,
      maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '1024', 10),
      temperature: 0.7,
    });

    let recommendations = [];
    if (text) {
      try {
        const cleaned = text.replace(/```json\s?|\s?```/g, '').trim();
        recommendations = JSON.parse(cleaned);
      } catch (e) {
        console.error('Failed to parse recommendations:', text);
      }
    }

    return new Response(
      JSON.stringify({ success: true, recommendations }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Study Recommendations Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate recommendations',
        message: error?.message || 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
