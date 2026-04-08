// api/weakness-detection.ts — AI-powered weakness detection
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const body = await req.json();
  const { student_id, subject, score, questions, weak_topics } = body;
  if (!student_id || !subject) {
    return new Response(
      JSON.stringify({ error: 'student_id and subject are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  try {
    // Analyze incorrect answers
    const incorrectQuestions = (questions || []).filter((q: any) => !q.is_correct);
    const weakAreas: Record<string, { wrong: number; total: number }> = {};
    for (const q of incorrectQuestions) {
      const topic = q.topic || 'General';
      if (!weakAreas[topic]) {
        weakAreas[topic] = { wrong: 0, total: 0 };
      }
      weakAreas[topic].wrong++;
      const allForTopic = (questions || []).filter(
        (qq: any) => (qq.topic || 'General') === topic
      );
      weakAreas[topic].total = allForTopic.length;
    }
    const weakAreasList = Object.entries(weakAreas)
      .map(([topic, data]) => ({
        topic,
        mastery_pct: Math.max(0, Math.round(100 - (data.wrong / data.total) * 100)),
        questions_wrong: data.wrong,
      }))
      .sort((a, b) => a.mastery_pct - b.mastery_pct);
    // AI insights
    let aiInsights = 'Analysis complete. ';
    if (incorrectQuestions.length === 0) {
      aiInsights += 'Perfect score! No weaknesses detected.';
    } else {
      try {
        const { text } = await openai.chat.completions.create({
          model: openaiMODEL),
          system: `You are a South African matric tutor. Based on this quiz performance data, provide brief, encouraging insights about the student's weak areas and what to focus on. Max 200 words.`,
          prompt: `Subject: ${subject}\nScore: ${score}%\nWeak topics: ${JSON.stringify(weakAreasList)}\nIncorrect questions: ${incorrectQuestions.length}`,
          maxTokens: 512,
          temperature: 0.7,
        });
        aiInsights = text || aiInsights;
      } catch (aiErr) {
        console.error('AI insights generation failed:', aiErr);
      JSON.stringify({
        success: true,
        weak_areas: weakAreasList,
        ai_insights: aiInsights,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
  } catch (error: any) {
    console.error('Weakness Detection Error:', error);
        error: 'Failed to detect weaknesses',
        message: error?.message || 'Unknown error',
      { status: 500, headers: { 'Content-Type': 'application/json' } }
}
