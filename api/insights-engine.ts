// api/insights-engine.ts — Actionable Insights Generator
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface Insight {
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
      const { data: quizzes } = await supabase
        .from('quiz_results')
        .select('score, subject, completed_at')
        .eq('student_id', student_id)
        .order('completed_at', { ascending: false })
        .limit(20);

      const { data: weakTopics } = await supabase
        .from('topic_performance')
        .select('subject, topic, mastery_level')
        .eq('student_id', student_id)
        .lt('mastery_level', 50)
        .order('mastery_level', { ascending: true })
        .limit(5);

      if (quizzes && quizzes.length >= 5) {
        const recentAvg = quizzes.slice(0, 5).reduce((s, q) => s + Number(q.score), 0) / 5;
        const olderAvg = quizzes.slice(5, 10).reduce((s, q) => s + Number(q.score), 0) / 5;
        const trend = recentAvg - olderAvg;
        
        if (trend < -10) {
          insights.push({
            type: 'student',
            severity: 'critical',
            title: 'Performance Declining',
            problem: `Average score dropped by ${Math.abs(Math.round(trend))}% recently`,
            cause: 'Possible lack of practice or difficult topics',
            action: 'Focus on recent topics with extra practice questions.',
            timestamp: new Date().toISOString(),
          });
        } else if (trend > 10) {
          insights.push({
            type: 'student',
            severity: 'info',
            title: 'Performance Improving',
            problem: `Average score improved by ${Math.round(trend)}%`,
            cause: 'Consistent study effort',
            action: 'Keep up the great work!',
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (weakTopics && weakTopics.length > 0) {
        const worstTopic = weakTopics[0];
        insights.push({
          type: 'student',
          severity: 'warning',
          title: `Struggling with ${worstTopic.topic}`,
          problem: `Mastery level is only ${worstTopic.mastery_level}%`,
          cause: 'Difficulty understanding this topic',
          action: `Review ${worstTopic.topic} fundamentals and practice more questions.`,
          subjects: [worstTopic.subject],
          timestamp: new Date().toISOString(),
        });
      }

    } else if (type === 'class' && teacher_id) {
      // === CLASS INSIGHTS ===
      const { data: students } = await supabase
        .from('student_profiles')
        .select('user_id, grade')
        .limit(50);

      if (!students || students.length === 0) {
        insights.push({
          type: 'class',
          severity: 'info',
          title: 'No Students Yet',
          problem: 'No students in the system.',
          cause: 'No students assigned yet.',
          action: 'Use the Students page to manage your class.',
          timestamp: new Date().toISOString(),
        });
      } else {
        const studentIds = students.map(s => s.user_id);
        
        const { data: allQuizzes } = await supabase
          .from('quiz_results')
          .select('score, subject, student_id')
          .in('student_id', studentIds);

        const { data: classWeakTopics } = await supabase
          .from('topic_performance')
          .select('subject, topic, mastery_level')
          .in('student_id', studentIds)
          .lt('mastery_level', 50);

        // Calculate average per subject
        const subjectScores: Record<string, { total: number; count: number }> = {};
        for (const q of allQuizzes || []) {
          if (!subjectScores[q.subject]) subjectScores[q.subject] = { total: 0, count: 0 };
          subjectScores[q.subject].total += Number(q.score);
          subjectScores[q.subject].count++;
        }

        const subjectAvgs = Object.entries(subjectScores)
          .map(([subject, data]) => ({ subject, avg: data.total / data.count }))
          .sort((a, b) => a.avg - b.avg);

        if (subjectAvgs.length > 0 && subjectAvgs[0].avg < 60) {
          const weakest = subjectAvgs[0];
          insights.push({
            type: 'class',
            severity: 'warning',
            title: 'Class Struggling with Subject',
            problem: `Class average in ${weakest.subject} is only ${Math.round(weakest.avg)}%`,
            cause: 'Multiple students finding this challenging',
            action: `Plan remedial lesson for ${weakest.subject}`,
            affected_count: students.length,
            subjects: [weakest.subject],
            timestamp: new Date().toISOString(),
          });
        }

        // At-risk students
        const atRiskCount = new Set(
          (allQuizzes || []).filter(q => Number(q.score) < 50).map(q => q.student_id)
        ).size;

        if (atRiskCount > 0) {
          insights.push({
            type: 'class',
            severity: 'critical',
            title: 'At-Risk Students',
            problem: `${atRiskCount} students performing below 50%`,
            cause: 'Various factors including attendance and study habits',
            action: 'Review at-risk students individually',
            affected_count: atRiskCount,
            timestamp: new Date().toISOString(),
          });
        }

        // Good news if things are going well
        if (insights.length === 0) {
          insights.push({
            type: 'class',
            severity: 'info',
            title: 'Class Doing Well',
            problem: 'No major issues detected',
            cause: 'Students are progressing well',
            action: 'Continue with planned curriculum',
            timestamp: new Date().toISOString(),
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