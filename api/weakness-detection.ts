import { createClient } from '@supabase/supabase-js';
import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const maxDuration = 60;
export const runtime = 'edge';

interface QuizQuestion {
  question: string;
  topic: string;
  correct_answer: string;
  student_answer: string;
  is_correct: boolean;
}

/**
 * POST /api/weakness-detection
 * 
 * Receives quiz results, identifies weak topics using Groq AI analysis,
 * updates the student_weaknesses table, and returns weak areas with insights.
 * 
 * Body:
 * {
 *   student_id: string,
 *   subject: string,
 *   score: number,
 *   questions: QuizQuestion[]
 * }
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { student_id, subject, score, questions } = body;

    if (!student_id || !subject || typeof score !== 'number' || !Array.isArray(questions)) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: student_id, subject, score, questions' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract weak topics from incorrect answers
    const weakTopics: string[] = [];
    const topicPerformance: Record<string, { correct: number; total: number }> = {};

    for (const q of questions) {
      const topic = q.topic || 'General';
      if (!topicPerformance[topic]) {
        topicPerformance[topic] = { correct: 0, total: 0 };
      }
      topicPerformance[topic].total++;
      if (q.is_correct) {
        topicPerformance[topic].correct++;
      } else {
        if (!weakTopics.includes(topic)) {
          weakTopics.push(topic);
        }
      }
    }

    // Use Groq to analyze patterns and provide deeper insights
    let aiInsights = '';
    try {
      const incorrectQuestions = questions.filter((q: QuizQuestion) => !q.is_correct);
      const analysisPrompt = `You are a South African Matric tutor. Analyze these quiz results and identify the student's weak areas.

Subject: ${subject}
Score: ${score}%
Incorrect questions (topic + question):
${incorrectQuestions.map((q: QuizQuestion) => `- Topic: ${q.topic}\n  Q: ${q.question}\n  Student answered: ${q.student_answer}\n  Correct answer: ${q.correct_answer}`).join('\n\n')}

Provide a brief analysis (2-3 sentences) of the student's weak areas and patterns. Focus on underlying concepts they struggle with.`;

      const result = streamText({
        model: groq('llama-3.1-8b-instant'),
        system: 'You are a concise Matric study advisor. Be direct and actionable.',
        prompt: analysisPrompt,
        maxOutputTokens: 256,
        temperature: 0.3,
      });

      // Collect the streamed text
      const textResult = await result.text;
      aiInsights = textResult;
    } catch (aiError) {
      console.error('Groq analysis error:', aiError);
      aiInsights = 'AI analysis unavailable. Focus on the topics marked as weak.';
    }

    // Save quiz result to database
    const { error: quizError } = await supabase
      .from('quiz_results')
      .insert({
        student_id,
        subject,
        score,
        questions_json: questions,
        weak_topics: weakTopics,
        completed_at: new Date().toISOString(),
      });

    if (quizError) {
      console.error('Error saving quiz result:', quizError);
    }

    // Update student_weaknesses for each weak topic
    for (const topic of weakTopics) {
      const topicData = topicPerformance[topic];
      const masteryPct = topicData.total > 0 
        ? Math.round((topicData.correct / topicData.total) * 100) 
        : 0;

      const { error: weaknessError } = await supabase
        .from('student_weaknesses')
        .upsert({
          student_id,
          subject,
          topic,
          error_count: topicData.total - topicData.correct,
          total_attempts: topicData.total,
          mastery_pct: masteryPct,
          last_error_at: new Date().toISOString(),
        }, {
          onConflict: 'student_id,subject,topic',
        });

      if (weaknessError) {
        console.error('Error upserting weakness:', weaknessError);
      }
    }

    // Also update mastery for correct topics (they improve)
    for (const [topic, data] of Object.entries(topicPerformance)) {
      if (!weakTopics.includes(topic)) {
        const masteryPct = data.total > 0 
          ? Math.round((data.correct / data.total) * 100) 
          : 100;

        await supabase
          .from('student_weaknesses')
          .upsert({
            student_id,
            subject,
            topic,
            error_count: 0,
            total_attempts: data.total,
            mastery_pct: masteryPct,
          }, {
            onConflict: 'student_id,subject,topic',
          });
      }
    }

    // Return weak areas with insights
    const weakAreas = weakTopics.map(topic => ({
      topic,
      subject,
      mastery_pct: topicPerformance[topic] 
        ? Math.round((topicPerformance[topic].correct / topicPerformance[topic].total) * 100)
        : 0,
      questions_wrong: topicPerformance[topic] 
        ? topicPerformance[topic].total - topicPerformance[topic].correct 
        : 0,
    }));

    return new Response(JSON.stringify({
      success: true,
      score,
      weak_areas: weakAreas,
      ai_insights: aiInsights,
      recommendations_generated: weakAreas.length > 0,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Weakness detection error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to analyze quiz results',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
