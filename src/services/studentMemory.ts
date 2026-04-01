import { supabase } from '@/integrations/supabase/client';

export interface QuizQuestionResult {
  question: string;
  topic: string;
  correct_answer: string;
  student_answer: string;
  is_correct: boolean;
}

export interface Weakness {
  id: string;
  student_id: string;
  subject: string;
  topic: string;
  error_count: number;
  total_attempts: number;
  mastery_pct: number;
  last_error_at: string | null;
  created_at: string;
}

export interface StudyRecommendation {
  id: string;
  student_id: string;
  subject: string;
  topic: string;
  reason: string;
  priority: number;
  created_at: string;
  dismissed_at: string | null;
}

/**
 * Records a quiz result and updates the student's weakness profile.
 * Calls the weakness-detection API endpoint.
 */
export async function recordQuizResult(
  studentId: string,
  subject: string,
  score: number,
  questions: QuizQuestionResult[],
  weakTopics: string[]
): Promise<{
  success: boolean;
  weak_areas: Array<{ topic: string; mastery_pct: number; questions_wrong: number }>;
  ai_insights: string;
}> {
  try {
    const response = await fetch('/api/weakness-detection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        subject,
        score,
        questions,
        weak_topics: weakTopics,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to record quiz result');
    }

    return await response.json();
  } catch (error) {
    console.error('Error recording quiz result:', error);
    
    // Fallback: directly insert into Supabase
    try {
      await supabase.from('quiz_results').insert({
        student_id: studentId,
        subject,
        score,
        questions_json: questions,
        weak_topics: weakTopics,
        completed_at: new Date().toISOString(),
      });
    } catch (fbError) {
      console.error('Fallback insert also failed:', fbError);
    }

    return {
      success: false,
      weak_areas: weakTopics.map(t => ({ topic: t, mastery_pct: 0, questions_wrong: 1 })),
      ai_insights: 'Recorded locally. AI analysis unavailable.',
    };
  }
}

/**
 * Fetches all weaknesses for a student, optionally filtered by subject.
 */
export async function getWeaknesses(
  studentId: string,
  subject?: string
): Promise<Weakness[]> {
  try {
    let query = supabase
      .from('student_weaknesses')
      .select('*')
      .eq('student_id', studentId)
      .order('mastery_pct', { ascending: true });

    if (subject) {
      query = query.eq('subject', subject);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data as Weakness[]) || [];
  } catch (error) {
    console.error('Error fetching weaknesses:', error);
    return [];
  }
}

/**
 * Fetches active (non-dismissed) study recommendations for a student.
 */
export async function getRecommendations(studentId: string): Promise<StudyRecommendation[]> {
  try {
    const { data, error } = await supabase
      .from('study_recommendations')
      .select('*')
      .eq('student_id', studentId)
      .is('dismissed_at', null)
      .order('priority', { ascending: true });

    if (error) throw error;
    return (data as StudyRecommendation[]) || [];
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return [];
  }
}

/**
 * Dismisses a study recommendation by setting dismissed_at.
 */
export async function dismissRecommendation(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('study_recommendations')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error dismissing recommendation:', error);
    return false;
  }
}

/**
 * Generates new AI-powered study recommendations by calling the API.
 */
export async function generateRecommendations(
  studentId: string
): Promise<StudyRecommendation[]> {
  try {
    const response = await fetch('/api/study-recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId }),
    });

    if (!response.ok) throw new Error('Failed to generate recommendations');

    const data = await response.json();
    return data.recommendations || [];
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return [];
  }
}

/**
 * Records a completed study plan entry.
 */
export async function completeStudyEntry(
  entryId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('study_plan_entries')
      .update({ completed: true })
      .eq('id', entryId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error completing study entry:', error);
    return false;
  }
}

/**
 * Creates a new study plan entry.
 */
export async function createStudyPlanEntry(
  studentId: string,
  date: string,
  subject: string,
  topic: string,
  durationMin: number = 30
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('study_plan_entries')
      .insert({
        student_id: studentId,
        date,
        subject,
        topic,
        duration_min: durationMin,
        completed: false,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    console.error('Error creating study plan entry:', error);
    return null;
  }
}

/**
 * Fetches study plan entries for a date range.
 */
export async function getStudyPlanEntries(
  studentId: string,
  startDate: string,
  endDate: string
): Promise<Array<{
  id: string;
  student_id: string;
  date: string;
  subject: string;
  topic: string;
  duration_min: number;
  completed: boolean;
  created_at: string;
}>> {
  try {
    const { data, error } = await supabase
      .from('study_plan_entries')
      .select('*')
      .eq('student_id', studentId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching study plan entries:', error);
    return [];
  }
}
