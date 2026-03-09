import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import StudentDashboard from './dashboard/StudentDashboard';
import TeacherDashboard from './dashboard/TeacherDashboard';
import HeadTeacherDashboard from './dashboard/HeadTeacherDashboard';
import AdminDashboard from './dashboard/AdminDashboard';

export default function Dashboard() {
  const { role } = useAuth();

  const renderDashboard = () => {
    switch (role) {
      case 'student': return <StudentDashboard />;
      case 'teacher': return <TeacherDashboard />;
      case 'head_teacher': return <HeadTeacherDashboard />;
      case 'admin': return <AdminDashboard />;
      default: return <StudentDashboard />;
    }
  };

  return (
    <DashboardLayout>
      {renderDashboard()}
    </DashboardLayout>
  );
}
