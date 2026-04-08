// api/exam-simulator.ts — Exam simulation with AI-generated papers

import type { Request, Response } from 'express';
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })



// CAPS Curriculum Guide for Exam Simulator
const EXAM_CURRICULUM_GUIDE = `
SOUTH AFRICAN CAPS CURRICULUM - GRADE 12 (MATRIC) EXAM PAPER

MATHEMATICS:
- Paper 1: Algebra, Functions, Calculus, Finance, Sequences
- Paper 2: Geometry, Trigonometry, Statistics, Probability
- Include calculation steps and final answers

PHYSICAL SCIENCES:
- Paper 1 (Physics): Mechanics, Waves, Electricity, Optics
- Paper 2 (Chemistry): Matter, Chemical reactions, Equilibrium, Acids/Bases
- Include formulas and working

LIFE SCIENCES:
- Paper 1: Cell biology, Genetics, Evolution
- Paper 2: Ecology, Human systems, Diversity

ALL EXAMS:
- Follow NSC (National Senior Certificate) format
- Include variety of question types: MCQ, short answer, essay
- Time: 3 hours (150-180 minutes)
- Total marks: 150-200
- Sections with different mark allocations
`;

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, subject, difficulty } = req.body;

  if (!subject) {
    return res.status(400).json({ error: 'subject is required' });
  }

  try {
    const { text } = await openai.chat.completions.create({
      model: openai || 'llama-3.3-70b-versatile'),
      system: `You are a South African Matric (Grade 12) exam paper generator following CAPS curriculum.
      
${EXAM_CURRICULUM_GUIDE}

Generate a realistic NSC-style exam for: ${subject}
Difficulty: ${difficulty || 'medium'}

REQUIREMENTS:
- Follow CAPS assessment guidelines for ${subject}
- Include NSC-style question formats
- Time: 3 hours, 150-200 marks
- Questions from curriculum-appropriate topics
- Include marking rubrics with criteria
- Step-by-step working for math/science

Return ONLY valid JSON:
{
  "exam_id": "exam_${Date.now()}",
  "title": "${subject} Matric Mock Exam (CAPS)",
  "instructions": "Answer all questions in 3 hours. Show all working.",
  "total_marks": 150,
  "time_limit_min": 180,
  "sections": [{"name": "Section A", "questions": [1, 2, 3], "marks": 30}],
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "question": "...",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct_answer": "A",
      "marks": 5,
      "topic": "curriculum topic",
      "marking_criteria": ["step 1", "step 2", "final answer"]
    }
  ],
  "marking_rubric": [{"id": 1, "topic": "...", "marks": 10, "criteria": ["..."]}]
}
Generate 10-15 curriculum-aligned questions. Return ONLY JSON - no markdown, no backticks.`,
      prompt: `Generate a ${difficulty || 'medium'} difficulty CAPS-aligned matric exam for ${subject}.`,
      maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '4096', 10),
      temperature: 0.7,
    });

    const content = text;
    if (!content) {
      return res.status(500).json({ error: 'Failed to generate exam' });
    }

    const cleaned = content.replace(/```json\s?|\s?```/g, '').trim();
    const examData = JSON.parse(cleaned);

    return res.json(examData);
  } catch (error: any) {
    console.error('Exam Simulator Error:', error);
    return res.status(500).json({
      error: 'Failed to generate exam',
      message: error?.message || 'Unknown error',
    });
  }
}
