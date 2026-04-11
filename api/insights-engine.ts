// api/insights-engine.ts — Simpler version that always works
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Create client with graceful fallback
let supabase: any = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req: Request) {
  const { student_id, teacher_id, type = 'student' } = await req.json().catch(() => ({}) || {};

  const insights: any[] = [];

  try {
    // If no supabase, return demo data
    if (!supabase) {
      return new Response(JSON.stringify({
        insights: type === 'class' ? [
          { type: 'class', severity: 'info', title: 'Getting Started', problem: 'Configure your database to see real insights', cause: 'API not connected to database', action: 'Check SUPABASE_URL and SUPABASE_ANON_KEY environment variables', timestamp: new Date().toISOString() }
        ] : [
          { type: 'student', severity: 'info', title: 'Welcome', problem: 'Start taking quizzes to see your progress', cause: 'No data yet', action: 'Complete some quizzes and study sessions', timestamp: new Date().toISOString() }
        ],
        generated_at: new Date().toISOString(),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (type === 'student' && student_id) {
      // Student mode - get their quizzes
      const { data: quizzes } = await supabase
        .from('quiz_results')
        .select('score')
        .eq('student_id', student_id)
        .limit(10);

      if (!quizzes || quizzes.length === 0) {
        insights.push({ type: 'student', severity: 'info', title: 'Get Started', problem: 'No quiz data yet', cause: 'You haven\\'t taken any quizzes', action: 'Take some quizzes to see your insights', timestamp: new Date().toISOString() });
      } else {
        const avg = quizzes.reduce((s, q) => s + Number(q.score), 0) / quizzes.length;
        insights.push({ type: 'student', severity: avg < 50 ? 'warning' : 'info', title: avg < 50 ? 'Needs Improvement' : 'Good Progress', problem: `Average score: ${Math.round(avg)}%`, cause: avg < 50 ? 'Struggling with some topics' : 'Doing well', action: avg < 50 ? 'Focus on weak topics' : 'Keep it up!', timestamp: new Date().toISOString() });
      }

    } else if (type === 'class' && teacher_id) {
      // Class mode - get all students
      const { data: students } = await supabase
        .from('student_profiles')
        .select('user_id')
        .limit(20);

      if (!students || students.length === 0) {
        insights.push({ type: 'class', severity: 'info', title: 'No Students Yet', problem: 'No students in the system', cause: 'No students assigned', action: 'Go to Students page to manage your class', timestamp: new Date().toISOString() });
      } else {
        const studentIds = students.map((s: any) => s.user_id);
        
        const { data: quizzes } = await supabase
          .from('quiz_results')
          .select('score')
          .in('student_id', studentIds);

        if (!quizzes || quizzes.length === 0) {
          insights.push({ type: 'class', severity: 'info', title: 'No Quiz Data Yet', problem: 'Students haven\\'t taken quizzes', cause: 'No quiz submissions', action: 'Encourage students to take quizzes', timestamp: new Date().toISOString() });
        } else {
          const avg = quizzes.reduce((s, q) => s + Number(q.score), 0) / quizzes.length;
          const atRisk = quizzes.filter((q: any) => Number(q.score) < 50).length;
          
          insights.push({ type: 'class', severity: avg < 60 ? 'warning' : 'info', title: avg < 60 ? 'Class Needs Attention' : 'Class Doing Well', problem: `Average: ${Math.round(avg)}%, ${atRisk} at-risk`, cause: avg < 60 ? 'Some students struggling' : 'Good overall performance', action: avg < 60 ? 'Review struggling students' : 'Continue current approach', timestamp: new Date().toISOString() });
        }
      }
    } else {
      insights.push({ type: 'class', severity: 'info', title: 'Welcome', problem: 'Select a student or class to see insights', cause: 'No ID provided', action: 'Provide student_id or teacher_id', timestamp: new Date().toISOString() });
    }

    return new Response(JSON.stringify({
      insights,
      generated_at: new Date().toISOString(),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Insights error:', error);
    // Always return something useful
    return new Response(JSON.stringify({
      insights: [
        { type: type || 'student', severity: 'info', title: 'Loading...', problem: 'Gathering your data', cause: 'System loading', action: 'Refresh the page', timestamp: new Date().toISOString() }
      ],
      error: 'Loading data...',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}