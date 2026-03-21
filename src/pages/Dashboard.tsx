import { calculateScore } from "../utils/readiness";
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import StudentDashboard from './dashboard/StudentDashboard';
import TeacherDashboard from './dashboard/TeacherDashboard';
import HeadTeacherDashboard from './dashboard/HeadTeacherDashboard';
import AdminDashboard from './dashboard/AdminDashboard';

export default function Dashboard() {
  const { effectiveRole } = useAuth();

  const score = calculateScore({
    tests: 80,
    homework: 70,
    past: 75,
    consistency: 60,
  });

  const renderDashboard = () => {
    switch (effectiveRole) {
      case 'student': return <StudentDashboard readinessScore={score} />;
      case 'teacher': return <TeacherDashboard />;
      case 'head_teacher': return <HeadTeacherDashboard />;
      case 'admin': return <AdminDashboard />;
      default: return <StudentDashboard readinessScore={score} />;
    }
  };

  return (
    <DashboardLayout>
      {renderDashboard()}
    </DashboardLayout>
  );
}