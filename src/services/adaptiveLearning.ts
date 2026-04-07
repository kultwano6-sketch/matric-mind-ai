// ============================================================
// Matric Mind AI - Adaptive Learning Engine
// Tracks student performance, identifies weak topics, recommends next study
// ============================================================

import { supabase } from '@/integrations/supabase/client';

export interface TopicPerformance {
  topic: string;
  subject: string;
  total_attempts: number;
  correct_attempts: number;
  mastery_level: number; // 0-100
  last_attempt: string | null;
  avg_time_seconds: number;
}

export interface StudentWeakTopic {
  subject: string;
  topic: string;
  mastery_level: number; // 0-100
  error_count: number;
  recommended_difficulty: 'easy' | 'medium' | 'hard';
  reason: string;
}

export interface LearningRecommendation {
  subject: string;
  topic: string;
  reason: string;
  priority: number;
  suggested_difficulty: 'easy' | 'medium' | 'hard';
  estimated_time_minutes: number;
}

export interface ReadinessScore {
  overall_score: number;
  quiz_performance: number;
  study_consistency: number;
  topic_completion: number;
  color: 'red' | 'orange' | 'yellow' | 'green';
  ai_tip: string;
}

// ============================================================
// Track Performance Per Subject & Topic
// ============================================================

/**
 * Records a quiz result and updates topic mastery
 */
export async function recordQuizPerformance(
  studentId: string,
  subject: string,
  score: number,
  totalMarks: number,
  questions: Array<{
    id: number;
    topic: string;
    correct_answer: string;
    student_answer: string;
    is_correct: boolean;
    time_taken_seconds?: number;
  }>
): Promise<{ success: boolean; topics_updated: number }> {
  try {
    // Calculate percentage
    const percentage = Math.round((score / totalMarks) * 100);

    // Store quiz result
    await supabase.from('quiz_results').insert({
      student_id: studentId,
      subject,
      score: percentage,
      total_marks: totalMarks,
      questions_json: questions,
      completed_at: new Date().toISOString(),
    });

    // Update topic performance for each question topic
    const topics = [...new Set(questions.map(q => q.topic))];
    let topicsUpdated = 0;

    for (const topic of topics) {
      const topicQuestions = questions.filter(q => q.topic === topic);
      const correctCount = topicQuestions.filter(q => q.is_correct).length;
      const topicMastery = Math.round((correctCount / topicQuestions.length) * 100);
      const avgTime = topicQuestions.reduce((sum, q) => sum + (q.time_taken_seconds || 0), 0) / topicQuestions.length;

      // Upsert topic performance
      const { error } = await supabase.from('topic_performance').upsert({
        student_id: studentId,
        subject,
        topic,
        total_attempts: topicQuestions.length,
        correct_attempts: correctCount,
        mastery_level: topicMastery,
        last_attempt: new Date().toISOString(),
        avg_time_seconds: Math.round(avgTime),
      }, {
        onConflict: 'student_id,subject,topic',
      });

      if (!error) topicsUpdated++;
    }

    return { success: true, topics_updated: topicsUpdated };
  } catch (error) {
    console.error('Error recording quiz performance:', error);
    return { success: false, topics_updated: 0 };
  }
}

// ============================================================
// Identify Weak Topics Per Student
// ============================================================

/**
 * Get weak topics for a student (mastery < 60%)
 */
export async function getWeakTopics(studentId: string): Promise<StudentWeakTopic[]> {
  try {
    const { data, error } = await supabase
      .from('topic_performance')
      .select('*')
      .eq('student_id', studentId)
      .lt('mastery_level', 60)
      .order('mastery_level', { ascending: true })
      .limit(20);

    if (error) throw error;

    return (data || []).map(topic => ({
      subject: topic.subject,
      topic: topic.topic,
      mastery_level: topic.mastery_level,
      error_count: topic.total_attempts - topic.correct_attempts,
      recommended_difficulty: topic.mastery_level < 30 ? 'easy' : 'medium',
      reason: topic.mastery_level < 30 
        ? 'Fundamental understanding needed'
        : 'Needs more practice',
    }));
  } catch (error) {
    console.error('Error getting weak topics:', error);
    return [];
  }
}

/**
 * Get performance by subject
 */
export async function getSubjectPerformance(
  studentId: string
): Promise<Record<string, { avg_mastery: number; topics_count: number }>> {
  try {
    const { data, error } = await supabase
      .from('topic_performance')
      .select('subject, mastery_level')
      .eq('student_id', studentId);

    if (error) throw error;

    const subjectStats: Record<string, { total: number; count: number }> = {};
    
    for (const row of data || []) {
      if (!subjectStats[row.subject]) {
        subjectStats[row.subject] = { total: 0, count: 0 };
      }
      subjectStats[row.subject].total += row.mastery_level;
      subjectStats[row.subject].count++;
    }

    const result: Record<string, { avg_mastery: number; topics_count: number }> = {};
    for (const [subject, stats] of Object.entries(subjectStats)) {
      result[subject] = {
        avg_mastery: Math.round(stats.total / stats.count),
        topics_count: stats.count,
      };
    }

    return result;
  } catch (error) {
    console.error('Error getting subject performance:', error);
    return {};
  }
}

// ============================================================
// AI Recommendation Engine
// ============================================================

/**
 * Get recommended next topics to study
 */
export async function getNextStudyRecommendations(
  studentId: string
): Promise<LearningRecommendation[]> {
  try {
    // Get weak topics
    const weakTopics = await getWeakTopics(studentId);
    
    if (weakTopics.length === 0) {
      return [{
        subject: 'All',
        topic: 'Review & Practice',
        reason: 'Great job! Keep practicing to maintain your skills.',
        priority: 1,
        suggested_difficulty: 'medium',
        estimated_time_minutes: 30,
      }];
    }

    // Build recommendations from weak topics
    const recommendations: LearningRecommendation[] = weakTopics.slice(0, 5).map((topic, index) => ({
      subject: topic.subject,
      topic: topic.topic,
      reason: topic.reason,
      priority: index + 1,
      suggested_difficulty: topic.recommended_difficulty,
      estimated_time_minutes: topic.mastery_level < 30 ? 45 : 30,
    }));

    return recommendations;
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return [];
  }
}

// ============================================================
// Adaptive Difficulty Adjustment
// ============================================================

/**
 * Adjust difficulty based on recent performance
 */
export async function getAdaptiveDifficulty(
  studentId: string,
  subject: string
): Promise<'easy' | 'medium' | 'hard'> {
  try {
    // Get recent performance for subject (last 5 quizzes)
    const { data, error } = await supabase
      .from('quiz_results')
      .select('score')
      .eq('student_id', studentId)
      .eq('subject', subject)
      .order('completed_at', { ascending: false })
      .limit(5);

    if (error || !data || data.length === 0) {
      return 'medium'; // Default
    }

    const avgScore = data.reduce((sum, r) => sum + r.score, 0) / data.length;

    if (avgScore >= 80) return 'hard';
    if (avgScore >= 60) return 'medium';
    return 'easy';
  } catch (error) {
    return 'medium';
  }
}

// ============================================================
// Matric Readiness Score Calculator
// ============================================================

/**
 * Calculate overall readiness score (0-100%)
 */
export async function calculateReadinessScore(
  studentId: string
): Promise<ReadinessScore> {
  try {
    // 1. Quiz Performance (40% weight)
    const { data: quizData } = await supabase
      .from('quiz_results')
      .select('score')
      .eq('student_id', studentId);

    const quizPerformance = quizData && quizData.length > 0
      ? quizData.reduce((sum, r) => sum + r.score, 0) / quizData.length
      : 50;

    // 2. Study Consistency (30% weight) - based on recent activity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentActivity } = await supabase
      .from('study_plan_entries')
      .select('completed')
      .eq('student_id, student_id', studentId)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

    const studyDays = recentActivity?.filter(e => e.completed).length || 0;
    const studyConsistency = Math.min((studyDays / 30) * 100, 100);

    // 3. Topic Completion (30% weight)
    const { data: topicsData } = await supabase
      .from('topic_performance')
      .select('mastery_level')
      .eq('student_id', studentId)
      .gte('mastery_level', 60);

    const topicCompletion = topicsData ? Math.min((topicsData.length / 20) * 100, 100) : 0;

    // Calculate weighted overall
    const overallScore = Math.round(
      (quizPerformance * 0.4) + 
      (studyConsistency * 0.3) + 
      (topicCompletion * 0.3)
    );

    // Determine color
    let color: 'red' | 'orange' | 'yellow' | 'green';
    if (overallScore <= 40) color = 'red';
    else if (overallScore <= 60) color = 'orange';
    else if (overallScore <= 75) color = 'yellow';
    else color = 'green';

    // Generate AI tip
    let aiTip: string;
    if (color === 'red') {
      aiTip = 'Focus on mastering one subject at a time. Start with your weakest topic and build a strong foundation before moving on.';
    } else if (color === 'orange') {
      aiTip = 'You\'re making progress! Increase your study sessions to 45 minutes daily and focus on practice questions.';
    } else if (color === 'yellow') {
      aiTip = 'Good progress! Keep up the consistent study schedule and try some exam-style practice questions.';
    } else {
      aiTip = 'Excellent! You\'re well prepared. Focus on maintaining your knowledge and practicing under exam conditions.';
    }

    return {
      overall_score: overallScore,
      quiz_performance: Math.round(quizPerformance),
      study_consistency: Math.round(studyConsistency),
      topic_completion: Math.round(topicCompletion),
      color,
      ai_tip: aiTip,
    };
  } catch (error) {
    console.error('Error calculating readiness score:', error);
    return {
      overall_score: 0,
      quiz_performance: 0,
      study_consistency: 0,
      topic_completion: 0,
      color: 'red',
      ai_tip: 'Complete some quizzes to see your readiness score.',
    };
  }
}

// ============================================================
// Study Time Tracking
// ============================================================

/**
 * Record study time spent on a topic
 */
export async function recordStudyTime(
  studentId: string,
  subject: string,
  topic: string,
  durationMinutes: number
): Promise<boolean> {
  try {
    const { error } = await supabase.from('study_sessions').insert({
      student_id: studentId,
      subject,
      topic,
      duration_minutes: durationMinutes,
      started_at: new Date().toISOString(),
    });

    return !error;
  } catch (error) {
    console.error('Error recording study time:', error);
    return false;
  }
}

/**
 * Get total study time per subject
 */
export async function getStudyTimeBySubject(
  studentId: string
): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from('study_sessions')
      .select('subject, duration_minutes')
      .eq('student_id', studentId);

    if (error) throw error;

    const timeBySubject: Record<string, number> = {};
    for (const row of data || []) {
      timeBySubject[row.subject] = (timeBySubject[row.subject] || 0) + row.duration_minutes;
    }

    return timeBySubject;
  } catch (error) {
    console.error('Error getting study time:', error);
    return {};
  }
}