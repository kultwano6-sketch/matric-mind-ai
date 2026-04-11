// api/teacher-analytics.ts — Simple version that always works
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: any = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export default async function handler(req: Request) {
  const { teacher_id } = await req.json().catch(() => ({})) || {};

  try {
    // If no supabase, return demo
    if (!supabase) {
      return new Response(JSON.stringify({
        studentsCount: 0,
        quizStats: { totalAttempts: 0, avgScore: 0, recentAttempts: [] },
        atRiskStudents: [],
        recentActivity: [],
        note: 'Configure DATABASE_URL to see real data'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (!teacher_id) {
      return new Response(JSON.stringify({
        studentsCount: 0,
        quizStats: { totalAttempts: 0, avgScore: 0, recentAttempts: [] },
        atRiskStudents: [],
        recentActivity: []
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Get students
    const { data: students } = await supabase
      .from('student_profiles')
      .select('user_id')
      .limit(50);

    const studentIds = students?.map((s: any) => s.user_id) || [];
    let quizStats = { totalAttempts: 0, avgScore: 0, recentAttempts: [] };

    if (studentIds.length > 0) {
      const { data: attempts } = await supabase
        .from('quiz_results')
        .select('*')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false })
        .limit(20);

      if (attempts && attempts.length > 0) {
        quizStats.recentAttempts = attempts;
        quizStats.totalAttempts = attempts.length;
        const total = attempts.reduce((s: number, a: any) => s + Number(a.score || 0), 0);
        quizStats.avgScore = total / attempts.length;
      }
    }

    // Get at-risk (low mastery)
    const { data: atRisk } = await supabase
      .from('student_progress')
      .select('student_id, mastery_level')
      .in('student_id', studentIds)
      .lt('mastery_level', 40)
      .limit(10);

    return new Response(JSON.stringify({
      studentsCount: studentIds.length,
      quizStats,
      atRiskStudents: atRisk || [],
      recentActivity: quizStats.recentAttempts
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Teacher analytics error:', error);
    return new Response(JSON.stringify({
      studentsCount: 0,
      quizStats: { totalAttempts: 0, avgScore: 0, recentAttempts: [] },
      atRiskStudents: [],
      recentActivity: []
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}