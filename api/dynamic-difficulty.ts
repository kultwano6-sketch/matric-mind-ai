// api/dynamic-difficulty.ts — Adaptive difficulty adjustment

import type { Request, Response } from 'express';
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })



export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, subject, current_difficulty, recent_scores, response_times } = req.body;

  if (!student_id || !subject) {
    return res.status(400).json({ error: 'student_id and subject are required' });
  }

  try {
    // Calculate adaptive difficulty based on performance
    const scores = recent_scores || [];
    const avgScore = scores.length > 0
      ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
      : 50;

    let recommendedDifficulty = current_difficulty || 'medium';
    let adjustmentReason = '';

    if (avgScore >= 85) {
      recommendedDifficulty = 'hard';
      adjustmentReason = 'Consistently high scores (>85%). Ready for harder questions.';
    } else if (avgScore >= 70) {
      recommendedDifficulty = 'medium';
      adjustmentReason = 'Good performance (70-85%). Maintain this level.';
    } else if (avgScore >= 50) {
      recommendedDifficulty = 'medium';
      adjustmentReason = 'Moderate performance (50-70%). Focus on building fundamentals.';
    } else {
      recommendedDifficulty = 'easy';
      adjustmentReason = 'Scores below 50%. Let\'s strengthen the basics first.';
    }

    // Get AI-generated study tip
    let aiTip = '';
    try {
      const { text } = await openai.chat.completions.create({
        model: openai || 'llama-3.3-70b-versatile'),
        system: 'Give one brief, specific study tip for a South African matric student. Max 2 sentences.',
        prompt: `Subject: ${subject}\nAverage score: ${avgScore.toFixed(1)}%\nDifficulty: ${recommendedDifficulty}`,
        maxTokens: 100,
        temperature: 0.7,
      });
      aiTip = text || '';
    } catch {
      // Non-fatal
    }

    return res.json({
      recommended_difficulty: recommendedDifficulty,
      adjustment_reason: adjustmentReason,
      average_score: Math.round(avgScore),
      ai_tip: aiTip,
    });
  } catch (error: any) {
    console.error('Dynamic Difficulty Error:', error);
    return res.status(500).json({
      error: 'Failed to adjust difficulty',
      message: error?.message || 'Unknown error',
    });
  }
}
