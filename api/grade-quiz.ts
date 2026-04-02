// api/grade-quiz.ts — Grade a quiz using AI
import type { Request, Response } from 'express';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { questions, answers, subject } = req.body;

  if (!questions || !Array.isArray(questions) || !answers) {
    return res.status(400).json({ error: 'questions (array) and answers are required' });
  }

  try {
    // For MCQ questions, grade locally (no AI needed)
    let totalMarks = 0;
    let earnedMarks = 0;
    const results = questions.map((q: any, i: number) => {
      const studentAnswer = answers[i] || answers[q.id] || '';
      const isCorrect =
        q.type === 'mcq'
          ? studentAnswer.toUpperCase() === (q.correct_answer || '').toUpperCase()
          : null; // Open-ended needs AI

      const marks = parseInt(q.marks, 10) || 1;
      totalMarks += marks;

      if (isCorrect) {
        earnedMarks += marks;
      }

      return {
        id: q.id,
        question: q.question,
        student_answer: studentAnswer,
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        marks_earned: isCorrect ? marks : 0,
        max_marks: marks,
        topic: q.topic || 'General',
      };
    });

    // If there are open-ended questions, use AI to grade
    const openEnded = results.filter((r: any) => r.is_correct === null);
    if (openEnded.length > 0) {
      const { text: gradingContent } = await generateText({
        model: groq(GROQ_MODEL),
        messages: [
          {
            role: 'system',
            content: `You are a grading assistant for South African matric ${subject || 'Mathematics'} exams.
Grade each answer on a scale of 0 to max_marks. Be fair and lenient for partially correct answers.
Return ONLY valid JSON array like: [{"id": 1, "marks_earned": 2, "feedback": "..."}]`,
          },
          {
            role: 'user',
            content: JSON.stringify(
              openEnded.map((r: any) => ({
                id: r.id,
                question: r.question,
                student_answer: r.student_answer,
                correct_answer: r.correct_answer,
                max_marks: r.max_marks,
              }))
            ),
          },
        ],
        maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '2048', 10),
        temperature: 0.3,
      });

      if (gradingContent) {
        try {
          const cleaned = gradingContent.replace(/```json\s?|\s?```/g, '').trim();
          const aiGrades = JSON.parse(cleaned);
          for (const grade of aiGrades) {
            const result = results.find((r: any) => r.id === grade.id);
            if (result) {
              result.marks_earned = Math.min(
                Math.max(parseInt(grade.marks_earned, 10) || 0, 0),
                result.max_marks
              );
              result.is_correct = result.marks_earned === result.max_marks;
              result.feedback = grade.feedback || '';
              earnedMarks += result.marks_earned;
            }
          }
        } catch (e) {
          console.error('Failed to parse AI grading:', gradingContent);
        }
      }
    }

    const percentage = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;

    res.json({
      score: earnedMarks,
      total_marks: totalMarks,
      percentage,
      results,
    });
  } catch (error: any) {
    console.error('Grade Quiz API Error:', error);
    res.status(500).json({
      error: 'Failed to grade quiz',
      message: error?.message || 'Unknown error',
    });
  }
}
