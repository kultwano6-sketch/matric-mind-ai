import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Users, GraduationCap, BarChart3, Bell } from 'lucide-react';

export default function HeadTeacherDashboard() {
  const { profile } = useAuth();

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold">Master Dashboard</h1>
        <p className="text-muted-foreground mt-1">School-wide overview — Welcome, {profile?.full_name}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: '0', icon: GraduationCap, color: 'hsl(200,80%,50%)' },
          { label: 'Total Teachers', value: '0', icon: Users, color: 'hsl(150,60%,40%)' },
          { label: 'Active Today', value: '0', icon: BarChart3, color: 'hsl(45,85%,55%)' },
          { label: 'Announcements', value: '0', icon: Bell, color: 'hsl(280,60%,50%)' },
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
          <p>Head Teacher dashboard with school-wide analytics, teacher monitoring, and announcements is coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
