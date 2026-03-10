import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Shield, Users, Settings, Activity, Trash2, UserCog } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const ROLE_LABELS: Record<AppRole, string> = {
  student: 'Student',
  teacher: 'Teacher',
  head_teacher: 'Head Teacher',
  admin: 'Admin',
};

const ROLE_COLORS: Record<AppRole, string> = {
  student: 'default',
  teacher: 'secondary',
  head_teacher: 'outline',
  admin: 'destructive',
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: userRoles } = useQuery({
    queryKey: ['admin-user-roles'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('*');
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    },
  });

  const { data: activityLog } = useQuery({
    queryKey: ['admin-activity-log'],
    queryFn: async () => {
      const { data } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(20);
      return data || [];
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error } = await supabase.from('user_roles').update({ role: newRole }).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] });
      toast.success('Role updated!');
    },
    onError: (e) => toast.error(e.message),
  });

  const totalUsers = userRoles?.length || 0;
  const studentCount = userRoles?.filter(r => r.role === 'student').length || 0;
  const teacherCount = userRoles?.filter(r => r.role === 'teacher').length || 0;

  const users = userRoles?.map(ur => {
    const prof = profiles?.find(p => p.user_id === ur.user_id);
    return { ...ur, name: prof?.full_name || 'Unknown', avatar: prof?.avatar_url };
  }) || [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold">System Admin Panel</h1>
        <p className="text-muted-foreground mt-1">Full system control — {profile?.full_name}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: totalUsers.toString(), icon: Users, color: 'hsl(var(--student-accent))' },
          { label: 'Students', value: studentCount.toString(), icon: Activity, color: 'hsl(var(--teacher-accent))' },
          { label: 'Teachers', value: teacherCount.toString(), icon: Settings, color: 'hsl(var(--head-teacher-accent))' },
          { label: 'Security', value: 'OK', icon: Shield, color: 'hsl(var(--admin-accent))' },
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

      {/* User Management */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCog className="w-5 h-5" /> User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-medium text-sm">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.user_id.slice(0, 8)}...</p>
                  </div>
                </div>
                <Select value={u.role} onValueChange={(v) => updateRole.mutate({ userId: u.user_id, newRole: v as AppRole })}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="head_teacher">Head Teacher</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            {users.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No users found</p>}
          </div>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-5 h-5" /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityLog && activityLog.length > 0 ? (
            <div className="space-y-2">
              {activityLog.map(log => (
                <div key={log.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                  <span>{log.action}</span>
                  <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No activity recorded yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
