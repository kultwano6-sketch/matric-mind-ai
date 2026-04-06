// api/generate-quiz.ts — Generate a quiz using AI

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export const maxDuration = 60;
export const runtime = 'nodejs';

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { subject, topic, difficulty, count, question_types } = body;

  if (!subject) {
    return new Response(JSON.stringify({ error: 'subject is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
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
      return new Response(JSON.stringify({ error: 'Failed to generate quiz content' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: 'Failed to parse generated quiz' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      return new Response(JSON.stringify({ error: 'Invalid quiz format generated' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(quizData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Generate Quiz API Error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate quiz',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
