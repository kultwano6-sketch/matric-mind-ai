// api/teacher-assistant.ts — AI Assistant for Teachers

import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
// ============================================================
// TEACHER AI ASSISTANT
// Generates lesson plans, worksheets, and quizzes for teachers
export async function POST(request: Request) {
  try {
    const { 
      action, // 'lesson_plan' | 'worksheet' | 'quiz'
      subject, 
      topic, 
      grade = 12,
      num_questions = 10,
      difficulty = 'medium'
    } = await request.json();
    if (!subject || !action) {
      return Response.json({ error: 'Subject and action required' }, { status: 400 });
    }
    // CAPS Curriculum guide for Grade 12
    const CAPS_GUIDE = `
    SOUTH AFRICAN CAPS CURRICULUM - GRADE ${grade}
    Follow the National Senior Certificate (NSC) standards.
    Use CAPS terminology and assessment guidelines.
    `;
    let prompt = '';
    let response_schema = {};
    switch (action) {
      case 'lesson_plan':
        prompt = `${CAPS_GUIDE}
        
Generate a complete lesson plan for:
- Subject: ${subject}
- Topic: ${topic}
- Grade: ${grade}
Return ONLY valid JSON with this structure:
{
  "title": "Lesson title",
  "duration_minutes": 60,
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "materials": ["material 1", "material 2"],
  "introduction": "5-10 min intro description",
  "main_content": [
    {"time": "10 min", "activity": "activity description", "type": "direct|interactive|guided"}
  ],
  "assessment": "formative assessment description",
  "homework": "homework assignment",
  "teacher_notes": "tips for delivery"
}
Respond with ONLY JSON, no markdown.`;
        response_schema = {
          title: 'string',
          duration_minutes: 'number',
          objectives: 'array',
          materials: 'array',
          introduction: 'string',
          main_content: 'array',
          assessment: 'string',
          homework: 'string',
          teacher_notes: 'string',
        };
        break;
      case 'worksheet':
Generate a practice worksheet for:
- Number of questions: ${num_questions}
- Difficulty: ${difficulty}
  "title": "Worksheet title",
  "instructions": "General instructions for students",
  "questions": [
    {
      "number": 1,
      "type": "mcq|short|long",
      "question": "question text",
      "marks": 5,
      "answer": "model answer or option key"
  "total_marks": total,
  "memo": "Teacher memo/answer key with workings"
          instructions: 'string',
          questions: 'array',
          total_marks: 'number',
          memo: 'string',
      case 'quiz':
Generate a short quiz for:
- Questions: ${num_questions}
  "title": "Quiz title",
  "time_limit_minutes": 20,
      "id": 1,
      "type": "mcq",
      "options": {"A": "opt1", "B": "opt2", "C": "opt3", "D": "opt4"},
      "correct_answer": "A",
      "marks": 2,
      "topic": "curriculum topic",
      "explanation": "why correct answer"
  "total_marks": total
          time_limit_minutes: 'number',
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    const { text } = await openai.chat.completions.create({
      model: openai || 'llama-3.3-70b-versatile'),
      messages: [{ role: 'user', content: prompt }],
    });
    let result;
    try {
      result = JSON.parse(text.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return Response.json({ 
        error: 'Failed to parse generated content',
        raw: text.substring(0, 500)
      }, { status: 500 });
    return Response.json({
      success: true,
      action,
      subject,
      topic,
      generated_content: result,
      timestamp: new Date().toISOString(),
  } catch (error) {
    console.error('Teacher assistant error:', error);
    return Response.json({ error: 'Failed to generate content' }, { status: 500 });
  }
