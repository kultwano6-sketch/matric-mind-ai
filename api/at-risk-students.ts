// api/at-risk-students.ts — Advanced At-Risk Student Detection System
// Categorizes students: Red (<50%), Orange (50-65%), Green (>65%)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface AtRiskStudent {
  student_id: string;
  student_name: string;
  risk_level: 'red' | 'orange' | 'green';
  current_score: number;
  reasons: string[];
  recommended_actions: string[];
  suggested_topics: string[];
  intervention_plan: string;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { teacher_id, subject } = await req.json();

    // Get teacher's students
    const { data: students } = await supabase
      .from('student_profiles')
      .select('user_id, full_name, first_name, last_name')
      .eq('assigned_teacher', teacher_id);

    if (!students || students.length === 0) {
      return new Response(JSON.stringify({ 
        at_risk_students: [],
        summary: { red: 0, orange: 0, green: 0, total: 0 }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const studentIds = students.map(s => s.user_id);
    const atRiskStudents: AtRiskStudent[] = [];

    // Get quiz results for all students
    const { data: quizResults } = await supabase
      .from('quiz_results')
      .select('student_id, score, subject, topic')
      .in('student_id', studentIds)
      .order('completed_at', { ascending: false });

    // Get topic performance
    const { data: topicPerformance } = await supabase
      .from('topic_performance')
      .select('student_id, subject, topic, mastery_level')
      .in('student_id', studentIds)
      .lt('mastery_level', 60);

    // Get study sessions (consistency)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: studySessions } = await supabase
      .from('study_sessions')
      .select('student_id, started_at')
      .in('student_id', studentIds)
      .gte('started_at', thirtyDaysAgo.toISOString());

    // Analyze each student
    for (const student of students) {
      const studentQuizzes = quizResults?.filter(q => q.student_id === student.user_id) || [];
      const studentTopics = topicPerformance?.filter(t => t.student_id === student.user_id) || [];
      const studentSessions = studySessions?.filter(s => s.student_id === student.user_id) || [];

      // Calculate current score (average of recent quizzes)
      const recentQuizzes = studentQuizzes.slice(0, 10);
      const currentScore = recentQuizzes.length > 0
        ? Math.round(recentQuizzes.reduce((sum, q) => sum + q.score, 0) / recentQuizzes.length)
        : 0;

      // Determine risk level
      let riskLevel: 'red' | 'orange' | 'green';
      if (currentScore < 50) riskLevel = 'red';
      else if (currentScore < 65) riskLevel = 'orange';
      else riskLevel = 'green';

      // Skip students with good scores
      if (riskLevel === 'green') continue;

      // Identify reasons for being at risk
      const reasons: string[] = [];
      if (currentScore < 50) reasons.push('Score below 50%');
      if (studentTopics.length > 3) reasons.push(`${studentTopics.length} weak topics identified`);
      if (studentSessions.length < 5) reasons.push('Low study consistency');
      if (studentTopics.some(t => t.mastery_level < 30)) reasons.push('Critical mastery gaps');

      // Get suggested topics to revise
      const weakTopics = studentTopics
        .filter(t => t.mastery_level < 50)
        .sort((a, b) => a.mastery_level - b.mastery_level)
        .slice(0, 3)
        .map(t => `${t.subject}: ${t.topic}`);

      // Generate recommended actions
      const recommendedActions: string[] = [];
      if (currentScore < 50) {
        recommendedActions.push('Schedule one-on-one tutoring session');
        recommendedActions.push('Send progress report to parents');
        recommendedActions.push('Recommend intensive practice on weak topics');
      }
      if (studentSessions.length < 5) {
        recommendedActions.push('Help student create study schedule');
        recommendedActions.push('Set up daily study reminders');
      }
      recommendedActions.push('Assign targeted practice exercises');

      // Generate intervention plan
      let interventionPlan = '';
      if (riskLevel === 'red') {
        interventionPlan = `Immediate intervention required. Start with foundational concepts in ${weakTopics[0] || 'core topics'}. Schedule 3 sessions per week for 2 weeks, then reassess.`;
      } else {
        interventionPlan = `Weekly check-ins recommended. Focus on ${weakTopics.slice(0, 2).join(', ') || 'practice questions'}. Encourage 30min daily study.`;
      }

      atRiskStudents.push({
        student_id: student.user_id,
        student_name: student.full_name || `${student.first_name} ${student.last_name}`,
        risk_level: riskLevel,
        current_score: currentScore,
        reasons,
        recommended_actions: recommendedActions,
        suggested_topics: weakTopics,
        intervention_plan: interventionPlan,
      });
    }

    // Sort by risk level (red first)
    atRiskStudents.sort((a, b) => {
      const order = { red: 0, orange: 1, green: 2 };
      return order[a.risk_level] - order[b.risk_level];
    });

    // Summary
    const summary = {
      red: atRiskStudents.filter(s => s.risk_level === 'red').length,
      orange: atRiskStudents.filter(s => s.risk_level === 'orange').length,
      green: atRiskStudents.filter(s => s.risk_level === 'green').length,
      total: atRiskStudents.length,
    };

    return new Response(JSON.stringify({
      at_risk_students: atRiskStudents,
      summary,
      generated_at: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('At-risk students error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to analyze at-risk students',
      at_risk_students: [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;