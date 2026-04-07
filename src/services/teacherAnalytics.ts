// ============================================================
// Matric Mind AI - Teacher Analytics Service
// Class performance tracking, weak subjects, at-risk students
// ============================================================

import { supabase } from '@/integrations/supabase/client';

export interface ClassStats {
  total_students: number;
  avg_readiness_score: number;
  avg_quiz_score: number;
  active_students_30d: number;
}

export interface SubjectStats {
  subject: string;
  avg_mastery: number;
  total_attempts: number;
  weak_students: number;
}

export interface TopicFailure {
  topic: string;
  subject: string;
  failure_rate: number;
  total_attempts: number;
}

export interface StudentAtRisk {
  student_id: string;
  student_name: string;
  readiness_score: number;
  weak_subjects: string[];
  last_activity: string | null;
}

// ============================================================
// Class-wide Analytics
// ============================================================

/**
 * Get overall class statistics
 */
export async function getClassStats(teacherId: string): Promise<ClassStats> {
  try {
    // Get teacher's assigned students
    const { data: students } = await supabase
      .from('student_profiles')
      .select('user_id')
      .eq('assigned_teacher', teacherId);

    if (!students || students.length === 0) {
      return {
        total_students: 0,
        avg_readiness_score: 0,
        avg_quiz_score: 0,
        active_students_30d: 0,
      };
    }

    const studentIds = students.map(s => s.user_id);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get quiz performance
    const { data: quizzes } = await supabase
      .from('quiz_results')
      .select('score, completed_at')
      .in('student_id', studentIds);

    // Get active students (activity in last 30 days)
    const activeStudents = quizzes?.filter(q => 
      new Date(q.completed_at) >= thirtyDaysAgo
    ).map(q => q.student_id) || [...new Set(quizzes?.map(q => q.student_id) || [])];

    const avgQuizScore = quizzes && quizzes.length > 0
      ? quizzes.reduce((sum, q) => sum + q.score, 0) / quizzes.length
      : 0;

    return {
      total_students: studentIds.length,
      avg_readiness_score: 65, // Placeholder - would calculate from readiness table
      avg_quiz_score: Math.round(avgQuizScore),
      active_students_30d: activeStudents.length,
    };
  } catch (error) {
    console.error('Error getting class stats:', error);
    return {
      total_students: 0,
      avg_readiness_score: 0,
      avg_quiz_score: 0,
      active_students_30d: 0,
    };
  }
}

/**
 * Get performance by subject across class
 */
export async function getSubjectStats(teacherId: string): Promise<SubjectStats[]> {
  try {
    const { data: students } = await supabase
      .from('student_profiles')
      .select('user_id')
      .eq('assigned_teacher', teacherId);

    if (!students || students.length === 0) return [];

    const studentIds = students.map(s => s.user_id);

    const { data: topicData } = await supabase
      .from('topic_performance')
      .select('subject, mastery_level, total_attempts')
      .in('student_id', studentIds);

    // Group by subject
    const subjectStats: Record<string, { totalMastery: number; count: number; attempts: number }> = {};
    
    for (const row of topicData || []) {
      if (!subjectStats[row.subject]) {
        subjectStats[row.subject] = { totalMastery: 0, count: 0, attempts: 0 };
      }
      subjectStats[row.subject].totalMastery += row.mastery_level;
      subjectStats[row.subject].count++;
      subjectStats[row.subject].attempts += row.total_attempts;
    }

    return Object.entries(subjectStats).map(([subject, stats]) => ({
      subject,
      avg_mastery: Math.round(stats.totalMastery / stats.count),
      total_attempts: stats.attempts,
      weak_students: 0, // Would calculate from individual student mastery
    }));
  } catch (error) {
    console.error('Error getting subject stats:', error);
    return [];
  }
}

/**
 * Get most failed topics across class
 */
export async function getTopFailedTopics(teacherId: string): Promise<TopicFailure[]> {
  try {
    const { data: students } = await supabase
      .from('student_profiles')
      .select('user_id')
      .eq('assigned_teacher', teacherId);

    if (!students || students.length === 0) return [];

    const studentIds = students.map(s => s.user_id);

    const { data: topicData } = await supabase
      .from('topic_performance')
      .select('subject, topic, total_attempts, correct_attempts')
      .in('student_id', studentIds)
      .lt('mastery_level', 50);

    // Group by topic
    const topicStats: Record<string, { subject: string; attempts: number; failures: number }> = {};
    
    for (const row of topicData || []) {
      if (!topicStats[row.topic]) {
        topicStats[row.topic] = { subject: row.subject, attempts: 0, failures: 0 };
      }
      topicStats[row.topic].attempts += row.total_attempts;
      topicStats[row.topic].failures += (row.total_attempts - row.correct_attempts);
    }

    return Object.entries(topicStats)
      .map(([topic, stats]) => ({
        topic,
        subject: stats.subject,
        failure_rate: Math.round((stats.failures / stats.attempts) * 100),
        total_attempts: stats.attempts,
      }))
      .sort((a, b) => b.failure_rate - a.failure_rate)
      .slice(0, 10);
  } catch (error) {
    console.error('Error getting failed topics:', error);
    return [];
  }
}

/**
 * Get students at risk (low readiness)
 */
export async function getAtRiskStudents(teacherId: string): Promise<StudentAtRisk[]> {
  try {
    const { data: students } = await supabase
      .from('student_profiles')
      .select('user_id, first_name, last_name')
      .eq('assigned_teacher', teacherId);

    if (!students || students.length === 0) return [];

    const atRisk: StudentAtRisk[] = [];

    for (const student of students) {
      // Get quiz performance
      const { data: quizzes } = await supabase
        .from('quiz_results')
        .select('score, completed_at')
        .eq('student_id', student.user_id)
        .order('completed_at', { ascending: false })
        .limit(10);

      if (!quizzes || quizzes.length === 0) {
        atRisk.push({
          student_id: student.user_id,
          student_name: `${student.first_name} ${student.last_name}`,
          readiness_score: 0,
          weak_subjects: [],
          last_activity: null,
        });
        continue;
      }

      const avgScore = quizzes.reduce((sum, q) => sum + q.score, 0) / quizzes.length;
      
      if (avgScore < 50) {
        // Get weak subjects
        const { data: weakTopics } = await supabase
          .from('topic_performance')
          .select('subject')
          .eq('student_id', student.user_id)
          .lt('mastery_level', 50);

        const weakSubjects = [...new Set(weakTopics?.map(t => t.subject) || [])];

        atRisk.push({
          student_id: student.user_id,
          student_name: `${student.first_name} ${student.last_name}`,
          readiness_score: Math.round(avgScore),
          weak_subjects: weakSubjects,
          last_activity: quizzes[0]?.completed_at || null,
        });
      }
    }

    return atRisk.sort((a, b) => a.readiness_score - b.readiness_score);
  } catch (error) {
    console.error('Error getting at-risk students:', error);
    return [];
  }
}
