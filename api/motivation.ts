// api/motivation.ts — AI-generated motivational messages

import type { Request, Response } from 'express';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return Response.json({ error: 405).json({ error: 'Method not allowed' });
  }

  const { student_name, context, streak_days, recent_score } = req.body;

  try {
    const { text } = await generateText({
      model: groq(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'),
      system: `You are Matric Mind AI motivator. Generate a brief, personalised motivational message for a South African matric student.
Keep it 2-3 sentences. Be warm, genuine, and culturally relevant. Use South African English (e.g., "You've got this, boet!").
${streak_days ? `They have a ${streak_days}-day study streak.` : ''}
${recent_score ? `Their recent score was ${recent_score}%.` : ''}`,
      prompt: `Student name: ${student_name || 'Student'}\nContext: ${context || 'general motivation'}`,
      maxTokens: 256,
      temperature: 0.8,
    });

    const message = text || 'You\'ve got this! Keep pushing! 💪';
    return Response.json({ message });
  } catch (error: any) {
    console.error('Motivation API Error:', error);
    // Fallback motivational message
    return Response.json({
      message: `${student_name || 'Hey'}! Every day you study brings you closer to your goals. Keep going! 💪`,
    });
  }
}
