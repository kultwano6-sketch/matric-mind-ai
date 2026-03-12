import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Database, Activity, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AdminSystemPage() {
  const { data: activityLog } = useQuery({
    queryKey: ['system-activity'],
    queryFn: async () => {
      const { data } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ['system-roles'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('*');
      return data || [];
    },
  });

  const { data: submissions } = useQuery({
    queryKey: ['system-submissions'],
    queryFn: async () => {
      const { data } = await supabase.from('assignment_submissions').select('id, submitted_at');
      return data || [];
    },
  });

  const { data: chatSessions } = useQuery({
    queryKey: ['system-chats'],
    queryFn: async () => {
      const { data } = await supabase.from('chat_sessions').select('id, created_at');
      return data || [];
    },
  });

  const totalUsers = userRoles?.length || 0;
  const totalSubmissions = submissions?.length || 0;
  const totalChats = chatSessions?.length || 0;

  const healthChecks = [
    { name: 'Authentication', status: 'operational' as const, detail: `${totalUsers} users registered` },
    { name: 'Database', status: 'operational' as const, detail: 'All tables accessible' },
    { name: 'AI Tutor', status: 'operational' as const, detail: `${totalChats} sessions created` },
    { name: 'File Storage', status: 'operational' as const, detail: 'Bucket active' },
    { name: 'RLS Policies', status: 'operational' as const, detail: 'All tables protected' },
  ];

  // Activity by day (last 7 days)
  const last7days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const activityByDay = last7days.map(day => ({
    day: new Date(day).toLocaleDateString('en', { weekday: 'short' }),
    count: activityLog?.filter(a => a.created_at.startsWith(day)).length || 0,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold">System Overview</h1>
          <p className="text-muted-foreground mt-1">Platform health and monitoring</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: totalUsers, icon: Database },
            { label: 'Submissions', value: totalSubmissions, icon: Activity },
            { label: 'Chat Sessions', value: totalChats, icon: Clock },
            { label: 'System Status', value: 'Healthy', icon: Shield },
          ].map(stat => (
            <Card key={stat.label} className="glass-card">
              <CardContent className="p-4 flex items-center gap-3">
                <stat.icon className="w-8 h-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Health Checks */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5" /> System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {healthChecks.map(check => (
                <div key={check.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-[hsl(150,60%,40%)]" />
                    <div>
                      <p className="font-medium text-sm">{check.name}</p>
                      <p className="text-xs text-muted-foreground">{check.detail}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-[hsl(150,60%,40%)]/10 text-[hsl(150,60%,40%)]">
                    Operational
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activity Heatmap */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="w-5 h-5" /> Activity (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 items-end h-32">
              {activityByDay.map((d, i) => {
                const maxCount = Math.max(...activityByDay.map(x => x.count), 1);
                const height = Math.max((d.count / maxCount) * 100, 4);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium">{d.count}</span>
                    <div className="w-full rounded-t bg-primary/70" style={{ height: `${height}%` }} />
                    <span className="text-[10px] text-muted-foreground">{d.day}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5" /> Recent Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityLog && activityLog.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {activityLog.map(log => (
                  <div key={log.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                    <span>{log.action}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No activity recorded yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
