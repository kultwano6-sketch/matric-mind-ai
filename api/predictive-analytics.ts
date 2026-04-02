// api/predictive-analytics.ts — Predictive exam score analytics
import type { Request, Response } from 'express';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, subject, quiz_history, study_data } = req.body;

  if (!student_id || !subject) {
    return res.status(400).json({ error: 'student_id and subject are required' });
  }

  try {
    const scores = (quiz_history || []).map((q: any) => q.score || 0);
    const avgScore = scores.length > 0
      ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
      : 0;

    // Calculate trend
    let trajectory: 'improving' | 'stable' | 'declining' = 'stable';
    if (scores.length >= 4) {
      const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
      const secondHalf = scores.slice(Math.floor(scores.length / 2));
      const firstAvg = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;
      if (secondAvg > firstAvg + 5) trajectory = 'improving';
      else if (secondAvg < firstAvg - 5) trajectory = 'declining';
    }

    // Predicted score with confidence range
    const predicted = Math.round(avgScore);
    const variance = Math.max(5, 15 - scores.length);

    // AI insights via generateText
    let aiInsights = '';
    try {
      const { text } = await generateText({
        model: groq(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'),
        system: 'You are a South African matric performance analyst. Provide brief, actionable insights about this student\'s predicted exam performance. Max 150 words. Be encouraging but honest.',
        prompt: `Subject: ${subject}\nPredicted score: ${predicted}%\nTrajectory: ${trajectory}\nQuiz count: ${scores.length}\nStudy hours: ${study_data?.total_hours || 0}`,
        maxTokens: 512,
        temperature: 0.6,
      });
      aiInsights = text;
    } catch {
      // Non-fatal
    }

    res.json({
      predicted_exam_score: predicted,
      confidence_level: Math.min(95, 50 + scores.length * 2),
      improvement_trajectory: trajectory,
      predicted_pass_rate: predicted >= 30 ? Math.min(95, 50 + predicted / 2) : Math.max(10, predicted),
      ai_insights: aiInsights,
      score_range: {
        low: Math.max(0, predicted - variance),
        high: Math.min(100, predicted + variance),
      },
      recommended_actions: [
        ...(trajectory === 'declining' ? ['Review recent topics where scores dropped'] : []),
        ...(avgScore < 50 ? ['Focus on fundamental concepts'] : []),
        ...(scores.length < 5 ? ['Complete more practice quizzes for better prediction accuracy'] : []),
        ...(avgScore >= 70 ? ['Maintain current study routine'] : ['Increase daily study time']),
      ],
    });
  } catch (error: any) {
    console.error('Predictive Analytics Error:', error);
    res.status(500).json({
      error: 'Failed to generate analytics',
      message: error?.message || 'Unknown error',
    });
  }
}
