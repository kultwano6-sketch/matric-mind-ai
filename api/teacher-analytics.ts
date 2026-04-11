// api/teacher-analytics.ts — Teacher Analytics Dashboard
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Get teacher analytics
router.post('/', async (req, res) => {
  try {
    const { teacher_id } = req.body;

    if (!teacher_id) {
      return res.status(400).json({ error: 'teacher_id is required' });
    }

    // Get teacher's assigned students
    const { data: students, error: studentsError } = await supabase
      .from('teacher_students')
      .select('student_id, student_profiles!inner(*)')
      .eq('teacher_id', teacher_id);

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
    }

    // Get quiz attempts for teacher's students
    const studentIds = students?.map(s => s.student_id) || [];
    
    let quizStats = {
      totalAttempts: 0,
      avgScore: 0,
      recentAttempts: []
    };

    if (studentIds.length > 0) {
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('*')
        .in('user_id', studentIds)
        .order('created_at', { ascending: false })
        .limit(20);

      if (attempts && attempts.length > 0) {
        quizStats.recentAttempts = attempts;
        quizStats.totalAttempts = attempts.length;
        const totalScore = attempts.reduce((sum, a) => {
          const score = a.total_points > 0 ? (a.score / a.total_points) * 100 : 0;
          return sum + score;
        }, 0);
        quizStats.avgScore = totalScore / attempts.length;
      }
    }

    // Get at-risk students
    const { data: atRiskStudents } = await supabase
      .from('student_progress')
      .select('student_id, mastery_level, subject')
      .in('student_id', studentIds)
      .lt('mastery_level', 40)
      .order('mastery_level', { ascending: true })
      .limit(10);

    res.json({
      studentsCount: studentIds.length,
      quizStats,
      atRiskStudents: atRiskStudents || [],
      recentActivity: quizStats.recentAttempts
    }));
  } catch (error) {
    console.error('Teacher analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;