// api/generate-quiz.ts — Generate a quiz using AI

import type { Request, Response } from 'express';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subject, topic, difficulty, count, question_types } = req.body;

  if (!subject) {
    return res.status(400).json({ error: 'subject is required' });
  }

  const questionCount = Math.min(Math.max(parseInt(count, 10) || 5, 1), 20);
  const difficultyLevel = difficulty || 'medium';

  try {
    const { text: content } = await generateText({
      model: groq(GROQ_MODEL),
      messages: [
        {
          role: 'system',
          content: `You are Matric Mind AI quiz generator. Generate a quiz with exactly ${questionCount} questions for South African matric students.
Subject: ${subject}
Topic: ${topic || 'General'}
Difficulty: ${difficultyLevel}
Question types: ${question_types || 'mcq'}

Return ONLY valid JSON with this structure:
{
  "title": "Quiz title",
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "question": "Question text",
      "options": {"A": "option1", "B": "option2", "C": "option3", "D": "option4"},
      "correct_answer": "A",
      "marks": 1,
      "topic": "${topic || 'General'}",
      "explanation": "Why this answer is correct"
    }
  ]
}

IMPORTANT: Return ONLY the JSON object, no markdown, no backticks, no commentary.`,
        },
      ],
      maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '4096', 10),
      temperature: 0.7,
    });

    if (!content) {
      return res.status(500).json({ error: 'Failed to generate quiz content' });
    }

    // Parse the JSON response - strip markdown code fences if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let quizData;
    try {
      quizData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse quiz JSON:', cleanedContent);
      return res.status(500).json({ error: 'Failed to parse generated quiz' });
    }

    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      return res.status(500).json({ error: 'Invalid quiz format generated' });
    }

    return res.json(quizData);
  } catch (error: any) {
    console.error('Generate Quiz API Error:', error);
    return res.status(500).json({
      error: 'Failed to generate quiz',
      message: error?.message || 'Unknown error',
    });
  }
}
