import { getSupabase } from '../server/supabaseClient';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 120;
export const runtime = 'edge';

interface ExamQuestion {
  id: number;
  type: 'mcq' | 'short_answer' | 'long_answer';
  question: string;
  options?: Record<string, string>;
  correct_answer: string;
  marks: number;
  topic: string;
  marking_criteria: string[];
}

interface ExamConfig {
  mathematics: { time: number; marks: number; sections: string[] };
  physical_sciences: { time: number; marks: number; sections: string[] };
  life_sciences: { time: number; marks: number; sections: string[] };
  english_home_language: { time: number; marks: number; sections: string[] };
  [key: string]: { time: number; marks: number; sections: string[] };
}

const EXAM_CONFIGS: ExamConfig = {
  mathematics: { time: 180, marks: 150, sections: ['Algebra', 'Calculus', 'Geometry', 'Trigonometry', 'Statistics'] },
  physical_sciences: { time: 180, marks: 150, sections: ['Physics', 'Chemistry', 'Mechanics', 'Energy', 'Reactions'] },
  life_sciences: { time: 150, marks: 150, sections: ['Cells', 'Genetics', 'Evolution', 'Ecology', 'Human Biology'] },
  english_home_language: { time: 180, marks: 150, sections: ['Comprehension', 'Language', 'Literature', 'Creative Writing', 'Grammar'] },
  accounting: { time: 180, marks: 150, sections: ['Financial Accounting', 'Cost Management', 'Financial Statements', 'Reconciliation'] },
  business_studies: { time: 150, marks: 100, sections: ['Business Environment', 'Entrepreneurship', 'Management', 'Marketing', 'Finance'] },
  economics: { time: 150, marks: 100, sections: ['Microeconomics', 'Macroeconomics', 'Economic Systems', 'International Trade'] },
  history: { time: 150, marks: 100, sections: ['South African History', 'World History', 'Cold War', 'Apartheid Era'] },
  geography: { time: 150, marks: 100, sections: ['Physical Geography', 'Human Geography', 'Climate', 'Settlement', 'Mapwork'] },
  mathematical_literacy: { time: 150, marks: 100, sections: ['Finance', 'Measurement', 'Maps', 'Data Handling', 'Probability'] },
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { student_id, subject, difficulty = 'medium' } = await req.json();

    if (!student_id || !subject) {
      return new Response(JSON.stringify({ error: 'Missing student_id or subject' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get student's weak areas for targeted questions
    const { data: weaknesses } = await supabase
      .from('student_weaknesses')
      .select('*')
      .eq('student_id', student_id)
      .eq('subject', subject)
      .order('mastery_pct', { ascending: true })
      .limit(5);

    const weakTopics = weaknesses?.map(w => w.topic).filter(Boolean) || [];
    const config = EXAM_CONFIGS[subject] || { time: 120, marks: 100, sections: ['General'] };

    const difficultyMap: Record<string, { mcq: number; short: number; long: number }> = {
      easy: { mcq: 8, short: 4, long: 1 },
      medium: { mcq: 6, short: 3, long: 2 },
      hard: { mcq: 4, short: 2, long: 3 },
      expert: { mcq: 3, short: 2, long: 4 },
    };
    const counts = difficultyMap[difficulty] || difficultyMap.medium;

    const examPrompt = `You are a South African CAPS curriculum exam creator for Grade 12 ${subject}.

Generate a complete exam paper with the following specifications:
- Subject: ${subject}
- Difficulty: ${difficulty}
- Total Marks: ${config.marks}
- Time Limit: ${config.time} minutes
- Sections: ${config.sections.join(', ')}
- Student Weak Areas (focus more on these): ${weakTopics.length > 0 ? weakTopics.join(', ') : 'None identified yet'}

Exam structure requirements:
- ${counts.mcq} Multiple Choice Questions (MCQ) — ${Math.round(config.marks * 0.3 / counts.mcq)} marks each
- ${counts.short} Short Answer Questions — ${Math.round(config.marks * 0.3 / counts.short)} marks each  
- ${counts.long} Long/Structured Answer Questions — ${Math.round(config.marks * 0.4 / counts.long)} marks each

IMPORTANT: Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "title": "Exam title",
  "instructions": "Exam instructions for students",
  "total_marks": ${config.marks},
  "time_limit_min": ${config.time},
  "sections": [
    {
      "name": "Section A: Multiple Choice",
      "questions": [
        {
          "id": 1,
          "type": "mcq",
          "question": "Question text here",
          "options": { "A": "Option A text", "B": "Option B text", "C": "Option C text", "D": "Option D text" },
          "correct_answer": "A",
          "marks": ${Math.round(config.marks * 0.3 / counts.mcq)},
          "topic": "Specific topic from CAPS syllabus",
          "marking_criteria": ["Award marks for identifying correct concept"]
        }
      ]
    },
    {
      "name": "Section B: Short Answer",
      "questions": [
        {
          "id": ${counts.mcq + 1},
          "type": "short_answer",
          "question": "Question text",
          "correct_answer": "Model answer text",
          "marks": ${Math.round(config.marks * 0.3 / counts.short)},
          "topic": "Specific topic",
          "marking_criteria": ["Criterion 1", "Criterion 2"]
        }
      ]
    },
    {
      "name": "Section C: Long Answer",
      "questions": [
        {
          "id": ${counts.mcq + counts.short + 1},
          "type": "long_answer",
          "question": "Complex multi-part question",
          "correct_answer": "Comprehensive model answer",
          "marks": ${Math.round(config.marks * 0.4 / counts.long)},
          "topic": "Specific topic",
          "marking_criteria": ["Part A marks", "Part B marks", "Communication marks"]
        }
      ]
    }
  ]
}

Make questions CAPS-aligned, realistic for Grade 12, and progressively harder within each section.`;

    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: 'You are a South African CAPS exam creator. You ONLY output valid JSON. No markdown, no code fences, no explanation. Just the raw JSON object.',
      prompt: examPrompt,
      maxOutputTokens: 4096,
      temperature: 0.7,
    });

    // Parse the AI response
    let examData;
    try {
      // Try to extract JSON from the response (in case there's any extra text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        examData = JSON.parse(jsonMatch[0]);
      } else {
        examData = JSON.parse(text);
      }
    } catch (parseError) {
      console.error('Failed to parse exam JSON:', parseError);
      console.error('Raw response:', text.substring(0, 500));
      // Return a fallback exam
      examData = generateFallbackExam(subject, config, counts, difficulty);
    }

    // Flatten questions for easier handling
    const allQuestions: ExamQuestion[] = [];
    let questionId = 1;

    if (examData.sections && Array.isArray(examData.sections)) {
      for (const section of examData.sections) {
        if (section.questions && Array.isArray(section.questions)) {
          for (const q of section.questions) {
            allQuestions.push({
              ...q,
              id: questionId++,
            });
          }
        }
      }
    }

    // Save exam simulation record
    const { data: examRecord } = await supabase
      .from('exam_simulations')
      .insert({
        student_id,
        subject,
        total_marks: examData.total_marks || config.marks,
        time_limit_min: examData.time_limit_min || config.time,
        questions_json: allQuestions as any,
        difficulty,
      })
      .select()
      .single();

    return new Response(JSON.stringify({
      success: true,
      exam_id: examRecord?.id,
      title: examData.title || `${subject} Practice Exam`,
      instructions: examData.instructions || 'Answer all questions. Read each question carefully before answering.',
      total_marks: examData.total_marks || config.marks,
      time_limit_min: examData.time_limit_min || config.time,
      sections: examData.sections || [],
      questions: allQuestions,
      marking_rubric: allQuestions.map(q => ({
        id: q.id,
        topic: q.topic,
        marks: q.marks,
        criteria: q.marking_criteria,
      })),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Exam simulator error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate exam',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function generateFallbackExam(subject: string, config: any, counts: any, difficulty: string) {
  const mcqMarks = Math.round(config.marks * 0.3 / counts.mcq);
  const shortMarks = Math.round(config.marks * 0.3 / counts.short);
  const longMarks = Math.round(config.marks * 0.4 / counts.long);

  return {
    title: `${subject} Practice Exam`,
    instructions: 'Answer all questions. Read each question carefully before answering.',
    total_marks: config.marks,
    time_limit_min: config.time,
    sections: [
      {
        name: 'Section A: Multiple Choice',
        questions: Array.from({ length: counts.mcq }, (_, i) => ({
          id: i + 1,
          type: 'mcq',
          question: `Question ${i + 1}: ${subject} concept check`,
          options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
          correct_answer: 'A',
          marks: mcqMarks,
          topic: config.sections[i % config.sections.length],
          marking_criteria: ['Identify correct concept'],
        })),
      },
      {
        name: 'Section B: Short Answer',
        questions: Array.from({ length: counts.short }, (_, i) => ({
          id: counts.mcq + i + 1,
          type: 'short_answer',
          question: `Explain the concept of ${config.sections[i % config.sections.length]} in ${subject}.`,
          correct_answer: 'A comprehensive explanation of the concept.',
          marks: shortMarks,
          topic: config.sections[i % config.sections.length],
          marking_criteria: ['Definition', 'Example', 'Application'],
        })),
      },
      {
        name: 'Section C: Long Answer',
        questions: Array.from({ length: counts.long }, (_, i) => ({
          id: counts.mcq + counts.short + i + 1,
          type: 'long_answer',
          question: `Provide a detailed analysis of ${config.sections[i % config.sections.length]} in ${subject}. Include examples and applications.`,
          correct_answer: 'A detailed, structured response covering all aspects of the topic.',
          marks: longMarks,
          topic: config.sections[i % config.sections.length],
          marking_criteria: ['Depth of understanding', 'Correct terminology', 'Examples provided', 'Clear structure'],
        })),
      },
    ],
  };
}
