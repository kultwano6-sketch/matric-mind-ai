// api/teacher-assistant.ts — AI Assistant for Teachers (FIXED: Uses Groq, proper fallbacks)

import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 60;
export const runtime = 'nodejs';

const FALLBACK_CONTENT = {
  lesson_plan: {
    title: "Lesson Plan",
    duration_minutes: 60,
    objectives: ["Learn key concepts", "Practice skills", "Apply knowledge"],
    materials: ["Textbook", "Worksheets"],
    introduction: "Introduction to the topic",
    main_content: [{ time: "30 min", activity: "Main lesson activity", type: "direct" }],
    assessment: "Class discussion and questions",
    homework: "Complete practice exercises",
    teacher_notes: "Adjust pacing as needed"
  },
  worksheet: {
    title: "Practice Worksheet",
    instructions: "Complete all questions. Show your working.",
    questions: [
      { number: 1, type: "short", question: "Sample question 1", marks: 5, answer: "Sample answer" }
    ],
    total_marks: 5,
    memo: "Teacher answer key"
  },
  quiz: {
    title: "Quiz",
    time_limit_minutes: 20,
    questions: [
      { id: 1, type: "mcq", options: { A: "Option A", B: "Option B", C: "Option C", D: "Option D" }, correct_answer: "A", marks: 2, topic: "Topic", explanation: "Explanation" }
    ],
    total_marks: 10
  }
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { 
      action, // 'lesson_plan' | 'worksheet' | 'quiz'
      subject, 
      topic, 
      grade = 12,
      num_questions = 10,
      difficulty = 'medium'
    } = await req.json();

    if (!subject || !action) {
      return new Response(JSON.stringify({ 
        error: 'Subject and action required',
        generated_content: FALLBACK_CONTENT[action] || null
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // CAPS Curriculum guide for Grade 12
    const CAPS_GUIDE = `SOUTH AFRICAN CAPS CURRICULUM - GRADE ${grade}. Follow the National Senior Certificate (NSC) standards.`;

    let prompt = '';
    switch (action) {
      case 'lesson_plan':
        prompt = `${CAPS_GUIDE}
        
Generate a complete lesson plan for:
- Subject: ${subject}
- Topic: ${topic}
- Grade: ${grade}
Return ONLY valid JSON with this structure:
{"title": "Lesson title", "duration_minutes": 60, "objectives": ["obj1", "obj2"], "materials": ["mat1"], "introduction": "intro text", "main_content": [{"time": "10 min", "activity": "activity", "type": "direct"}], "assessment": "assessment", "homework": "homework", "teacher_notes": "notes"}`;
        break;
      case 'worksheet':
        prompt = `${CAPS_GUIDE}
        
Generate a practice worksheet for:
- Subject: ${subject}
- Topic: ${topic}
- Number of questions: ${num_questions}
- Difficulty: ${difficulty}
Return ONLY valid JSON: {"title": "title", "instructions": "text", "questions": [{"number": 1, "type": "mcq|short|long", "question": "text", "marks": 5, "answer": "answer"}], "total_marks": 50, "memo": "memo"}`;
        break;
      case 'quiz':
        prompt = `${CAPS_GUIDE}
        
Generate a quiz for:
- Subject: ${subject}
- Topic: ${topic}
- Questions: ${num_questions}
Return ONLY valid JSON: {"title": "title", "time_limit_minutes": 20, "questions": [{"id": 1, "type": "mcq", "options": {"A": "a", "B": "b"}, "correct_answer": "A", "marks": 2, "topic": "topic", "explanation": "exp"}], "total_marks": ${num_questions * 2}}`;
        break;
      default:
        return new Response(JSON.stringify({ 
          error: 'Invalid action',
          generated_content: null
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
    });

    let result;
    try {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = FALLBACK_CONTENT[action];
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      result = FALLBACK_CONTENT[action];
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      subject,
      topic,
      generated_content: result,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Teacher assistant error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate content',
      generated_content: null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}