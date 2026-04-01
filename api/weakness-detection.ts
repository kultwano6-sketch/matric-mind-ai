// api/weakness-detection.ts — AI-powered weakness detection
import type { Request, Response } from 'express';
import { groq, GROQ_MODEL } from '../server/production.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, subject, score, questions, weak_topics } = req.body;

  if (!student_id || !subject) {
    return res.status(400).json({ error: 'student_id and subject are required' });
  }

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

      // Also count total attempts per topic
      const allForTopic = (questions || []).filter((qq: any) => (qq.topic || 'General') === topic);
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
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are a South African matric tutor. Based on this quiz performance data, provide brief, encouraging insights about the student's weak areas and what to focus on. Max 200 words.`,
            },
            {
              role: 'user',
              content: `Subject: ${subject}\nScore: ${score}%\nWeak topics: ${JSON.stringify(weakAreasList)}\nIncorrect questions: ${incorrectQuestions.length}`,
            },
          ],
          model: GROQ_MODEL,
          max_tokens: 512,
          temperature: 0.7,
        });
        aiInsights = completion.choices[0]?.message?.content || aiInsights;
      } catch (aiErr) {
        console.error('AI insights generation failed:', aiErr);
        // Non-fatal — return basic insights
      }
    }

    res.json({
      success: true,
      weak_areas: weakAreasList,
      ai_insights: aiInsights,
    });
  } catch (error: any) {
    console.error('Weakness Detection Error:', error);
    res.status(500).json({
      error: 'Failed to detect weaknesses',
      message: error?.message || 'Unknown error',
    });
  }
}
