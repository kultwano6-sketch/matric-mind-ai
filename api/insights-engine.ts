// api/insights-engine.ts — Actionable Insights Generator
// Analyzes data and generates problem → cause → action recommendations

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface Insight {
  type: 'student' | 'class';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  problem: string;
  cause: string;
  action: string;
  affected_count?: number;
  subjects?: string[];
  timestamp: string;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { student_id, teacher_id, type = 'student' } = await req.json();
    
    const insights: Insight[] = [];

    if (type === 'student' && student_id) {
      // === STUDENT INSIGHTS ===
      
      // Get quiz performance trend
      const { data: quizzes } = await supabase
        .from('quiz_results')
        .select('score, subject, completed_at')
        .eq('student_id', student_id)
        .order('completed_at', { ascending: false })
        .limit(20);

      // Get weak topics
      const { data: weakTopics } = await supabase
        .from('topic_performance')
        .select('subject, topic, mastery_level, total_attempts, correct_attempts')
        .eq('student_id', student_id)
        .lt('mastery_level', 50)
        .order('mastery_level', { ascending: true })
        .limit(5);

      // Get study consistency
      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('started_at, duration_minutes')
        .eq('student_id', student_id)
        .order('started_at', { ascending: false })
        .limit(30);

      // Analyze quiz trend
      if (quizzes && quizzes.length >= 5) {
        const recentAvg = quizzes.slice(0, 5).reduce((s, q) => s + q.score, 0) / 5;
        const olderAvg = quizzes.slice(5, 10).reduce((s, q) => s + q.score, 0) / 5;
        const trend = recentAvg - olderAvg;

        if (trend < -10) {
          insights.push({
            type: 'student',
            severity: 'critical',
            title: 'Performance Declining',
            problem: `Average score dropped by ${Math.abs(Math.round(trend))}% recently`,
            cause: recentAvg < olderAvg 
              ? 'Possible lack of practice, difficult topics, or loss of motivation'
              : 'Inconsistent study habits detected',
            action: 'Schedule a check-in conversation. Recommend focusing on recent topics with extra practice questions.',
          });
        } else if (trend > 10) {
          insights.push({
            type: 'student',
            severity: 'info',
            title: 'Performance Improving',
            problem: `Average score improved by ${Math.round(trend)}%`,
            cause: 'Consistent study effort and good topic understanding',
            action: 'Keep up the great work! Challenge with harder exam-style questions.',
          });
        }
      }

      // Analyze weak topics
      if (weakTopics && weakTopics.length > 0) {
        const worstTopic = weakTopics[0];
        insights.push({
          type: 'student',
          severity: 'warning',
          title: `Struggling with ${worstTopic.topic}`,
          problem: `${worstTopic.subject} topic "${worstTopic.topic}" has only ${worstTopic.mastery_level}% mastery`,
          cause: `${worstTopic.total_attempts - worstTopic.correct_attempts} incorrect attempts in this topic`,
          action: `Focus next study session on ${worstTopic.topic}. Start with foundational concepts before attempting practice questions.`,
          subjects: [worstTopic.subject],
        });
      }

      // Analyze study consistency
      const studyDays = sessions?.length || 0;
      if (studyDays < 3) {
        insights.push({
          type: 'student',
          severity: 'critical',
          title: 'Low Study Activity',
          problem: `Only ${studyDays} study sessions recorded recently`,
          cause: 'Insufficient study time or irregular study habits',
          action: 'Establish a daily study routine. Start with 30 minutes and gradually increase. Use the study planner to schedule sessions.',
        });
      }

    } else if (type === 'class' && teacher_id) {
      // === CLASS INSIGHTS ===
      
      // Get all students for this teacher
      const { data: students } = await supabase
        .from('student_profiles')
        .select('user_id, first_name, last_name')
        .eq('assigned_teacher', teacher_id);

      if (students && students.length > 0) {
        const studentIds = students.map(s => s.user_id);

        // Get all quiz data
        const { data: allQuizzes } = await supabase
          .from('quiz_results')
          .select('score, subject, student_id')
          .in('student_id', studentIds);

        // Get weak topics across class
        const { data: classWeakTopics } = await supabase
          .from('topic_performance')
          .select('subject, topic, mastery_level')
          .in('student_id', studentIds)
          .lt('mastery_level', 50);

        // Analyze weakest subjects
        const subjectScores: Record<string, { total: number; count: number }> = {};
        for (const q of allQuizzes || []) {
          if (!subjectScores[q.subject]) subjectScores[q.subject] = { total: 0, count: 0 };
          subjectScores[q.subject].total += q.score;
          subjectScores[q.subject].count++;
        }

        const weakestSubject = Object.entries(subjectScores)
          .map(([subj, data]) => ({ subject: subj, avg: data.total / data.count }))
          .sort((a, b) => a.avg - b.avg)[0];

        if (weakestSubject && weakestSubject.avg < 60) {
          insights.push({
            type: 'class',
            severity: 'warning',
            title: 'Class Struggling with Subject',
            problem: `Class average in ${weakestSubject.subject} is only ${Math.round(weakestSubject.avg)}%`,
            cause: 'Multiple students are finding this subject challenging',
            action: `Plan a remedial lesson for ${weakestSubject.subject}. Create extra practice materials for key topics.`,
            affected_count: students.length,
            subjects: [weakestSubject.subject],
          });
        }

        // Find most failed topics
        const topicFailures: Record<string, { count: number; subject: string }> = {};
        for (const t of classWeakTopics || []) {
          if (!topicFailures[t.topic]) topicFailures[t.topic] = { count: 0, subject: t.subject };
          topicFailures[t.topic].count++;
        }

        const topFailedTopic = Object.entries(topicFailures)
          .sort((a, b) => b[1].count - a[1].count)[0];

        if (topFailedTopic) {
          insights.push({
            type: 'class',
            severity: 'critical',
            title: 'Multiple Students Failing Topic',
            problem: `${topFailedTopic[1].count} students have low mastery in "${topFailedTopic[0]}"`,
            cause: 'Topic may be poorly understood across the class',
            action: `Re-teach ${topFailedTopic[0]} with examples from real exam papers. Assign group work on this topic.`,
            affected_count: topFailedTopic[1].count,
          });
        }

        // Find at-risk students count
        const atRiskCount = (allQuizzes || [])
          .filter(q => q.score < 50)
          .reduce((acc, q) => {
            acc.add(q.student_id);
            return acc;
          }, new Set()).size;

        if (atRiskCount > students.length * 0.2) {
          insights.push({
            type: 'class',
            severity: 'critical',
            title: 'High Number of At-Risk Students',
            problem: `${atRiskCount} students (${Math.round((atRiskCount / students.length) * 100)}%) are performing below 50%`,
            cause: 'Multiple factors including attendance, study habits, or topic difficulty',
            action: 'Review at-risk students individually. Consider after-school tutoring sessions. Send progress reports to parents.',
            affected_count: atRiskCount,
          });
        }
      }
    }

    return new Response(JSON.stringify({
      insights,
      generated_at: new Date().toISOString(),
      type,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Insights engine error:', error);
    return new Response(JSON.stringify({ 
      insights: [],
      error: 'Failed to generate insights' 
    }), { status: 200 });
  }
}