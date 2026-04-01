// api/motivation.ts — AI-generated motivational messages
import type { Request, Response } from 'express';
import { groq, GROQ_MODEL } from '../server/production.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_name, context, streak_days, recent_score } = req.body;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are Matric Mind AI motivator. Generate a brief, personalised motivational message for a South African matric student.
Keep it 2-3 sentences. Be warm, genuine, and culturally relevant. Use South African English (e.g., "You've got this, boet!").
${streak_days ? `They have a ${streak_days}-day study streak.` : ''}
${recent_score ? `Their recent score was ${recent_score}%.` : ''}`,
        },
        {
          role: 'user',
          content: `Student name: ${student_name || 'Student'}\nContext: ${context || 'general motivation'}`,
        },
      ],
      model: GROQ_MODEL,
      max_tokens: 256,
      temperature: 0.8,
    });

    const message =
      completion.choices[0]?.message?.content ?? 'You\'ve got this! Keep pushing! 💪';

    res.json({ message });
  } catch (error: any) {
    console.error('Motivation API Error:', error);
    // Fallback motivational message
    res.json({
      message: `${student_name || 'Hey'}! Every day you study brings you closer to your goals. Keep going! 💪`,
    });
  }
}
