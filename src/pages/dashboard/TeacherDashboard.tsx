import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, BookOpen, AlertTriangle } from 'lucide-react';

export default function TeacherDashboard() {
  const { profile } = useAuth();

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold">Teacher Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome, {profile?.full_name}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: '0', icon: Users, color: 'hsl(150,60%,40%)' },
          { label: 'Lesson Plans', value: '0', icon: FileText, color: 'hsl(200,80%,50%)' },
          { label: 'Assignments', value: '0', icon: BookOpen, color: 'hsl(45,85%,55%)' },
          { label: 'Struggling Students', value: '0', icon: AlertTriangle, color: 'hsl(0,65%,50%)' },
        ].map(stat => (
          <Card key={stat.label} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}15` }}>
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card">
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>Teacher features are coming soon. You'll be able to manage lesson plans, view student progress, and create assignments.</p>
        </CardContent>
      </Card>
    </div>
  );
}
