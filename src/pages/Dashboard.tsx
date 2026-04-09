import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import StudentDashboard from './dashboard/StudentDashboard';
import TeacherDashboard from './dashboard/TeacherDashboard';
import HeadTeacherDashboard from './dashboard/HeadTeacherDashboard';
import AdminDashboard from './dashboard/AdminDashboard';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const { user, effectiveRole } = useAuth();

  // Get real student data for readiness score calculation
  const { data: studentProgress } = useQuery({
    queryKey: ['student-progress', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('student_progress')
        .select('mastery_level, topic, subject')
        .eq('student_id', user.id);
      return data || [];
    },
    enabled: !!user && effectiveRole === 'student',
  });

  const { data: quizAttempts } = useQuery({
    queryKey: ['quiz-attempts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('quiz_attempts')
        .select('score, total_questions')
        .eq('user_id', user.id);
      return data || [];
    },
    enabled: !!user && effectiveRole === 'student',
  });

  const { data: assignments } = useQuery({
    queryKey: ['student-assignments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('assignment_submissions')
        .select('score, total_points')
        .eq('student_id', user.id);
      return data || [];
    },
    enabled: !!user && effectiveRole === 'student',
  });

  // Calculate real readiness score from actual data
  const calculateRealScore = () => {
    if (!user || effectiveRole !== 'student') return 0;

    const hasAnyData = studentProgress?.length || quizAttempts?.length || assignments?.length;
    
    if (!hasAnyData) {
      return 0; // No data yet - show 0%
    }

    let totalScore = 0;
    let weightTotal = 0;

    // Quiz performance (40% weight)
    if (quizAttempts && quizAttempts.length > 0) {
      const quizAvg = quizAttempts.reduce((sum, q) => {
        const score = q.total_points > 0 ? (q.score / q.total_points) * 100 : 0;
        return sum + score;
      }, 0) / quizAttempts.length;
      totalScore += quizAvg * 0.4;
      weightTotal += 0.4;
    }

    // Topic mastery from progress (30% weight)
    if (studentProgress && studentProgress.length > 0) {
      const masteryAvg = studentProgress.reduce((sum, p) => sum + (p.mastery_level || 0), 0) / studentProgress.length;
      totalScore += masteryAvg * 0.3;
      weightTotal += 0.3;
    }

    // Assignment/homework performance (30% weight)
    if ( assignments && assignments.length > 0) {
      const assignmentAvg = assignments.reduce((sum, a) => {
        const score = a.total_points > 0 ? (a.score / a.total_points) * 100 : 0;
        return sum + score;
      }, 0) / assignments.length;
      totalScore += assignmentAvg * 0.3;
      weightTotal += 0.3;
    }

    // If we have some data but not all categories, normalize
    if (weightTotal > 0 && weightTotal < 1) {
      return Math.round(totalScore / weightTotal);
    }

    return Math.round(totalScore);
  };

  const realScore = calculateRealScore();

  const renderDashboard = () => {
    switch (effectiveRole) {
      case 'student': 
        return <StudentDashboard readinessScore={realScore} />;
      case 'teacher': 
        return <TeacherDashboard />;
      case 'head_teacher': 
        return <HeadTeacherDashboard />;
      case 'admin': 
        return <AdminDashboard />;
      default: 
        return <StudentDashboard readinessScore={realScore} />;
    }
  };

  return (
    <DashboardLayout>
      {renderDashboard()}
    </DashboardLayout>
  );
}