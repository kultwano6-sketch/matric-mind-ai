import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Shield, Users, Settings, Activity, UserCog, GraduationCap, BookOpen, Bell, Database, FileText, Search } from 'lucide-react';
import type { Database as DB } from '@/integrations/supabase/types';

type AppRole = DB['public']['Enums']['app_role'];

const ROLE_LABELS: Record<AppRole, string> = {
  student: 'Learner',
  teacher: 'Teacher',
  head_teacher: 'Head Teacher',
  admin: 'Admin',
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

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

  const { data: announcements } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(5);
      return data || [];
    },
  });

  const { data: lessonPlans } = useQuery({
    queryKey: ['admin-lesson-plans'],
    queryFn: async () => {
      const { data } = await supabase.from('lesson_plans').select('id');
      return data || [];
    },
  });

  const { data: allAssignments } = useQuery({
    queryKey: ['admin-all-assignments'],
    queryFn: async () => {
      const { data } = await supabase.from('assignments').select('id');
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
  const htCount = userRoles?.filter(r => r.role === 'head_teacher').length || 0;
  const adminCount = userRoles?.filter(r => r.role === 'admin').length || 0;

  const users = userRoles?.map(ur => {
    const prof = profiles?.find(p => p.user_id === ur.user_id);
    return { ...ur, name: prof?.full_name || 'Unknown', avatar: prof?.avatar_url };
  }) || [];

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">System Administration</h1>
          <p className="text-muted-foreground mt-1">Full platform oversight — {profile?.full_name}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/admin/system')} variant="outline" size="sm">
            <Database className="w-4 h-4 mr-1" /> System Health
          </Button>
          <Button onClick={() => navigate('/announcements')} size="sm">
            <Bell className="w-4 h-4 mr-1" /> Announcements
          </Button>
        </div>
      </div>

      {/* Platform Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: totalUsers.toString(), icon: Users, color: 'hsl(var(--student-accent))' },
          { label: 'Learners', value: studentCount.toString(), icon: GraduationCap, color: 'hsl(var(--teacher-accent))' },
          { label: 'Teachers', value: teacherCount.toString(), icon: BookOpen, color: 'hsl(var(--head-teacher-accent))' },
          { label: 'Head Teachers', value: htCount.toString(), icon: Shield, color: 'hsl(var(--admin-accent))' },
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

      {/* Platform Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{lessonPlans?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Lesson Plans</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{allAssignments?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Assignments</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{announcements?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Announcements</p>
          </CardContent>
        </Card>
      </div>

      {/* User Management */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCog className="w-5 h-5" /> User Management
          </CardTitle>
          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="student">Learners</SelectItem>
                <SelectItem value="teacher">Teachers</SelectItem>
                <SelectItem value="head_teacher">Head Teachers</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredUsers.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-medium text-sm">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{u.name}</p>
                    <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[u.role]}</Badge>
                  </div>
                </div>
                <Select value={u.role} onValueChange={(v) => updateRole.mutate({ userId: u.user_id, newRole: v as AppRole })}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Learner</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="head_teacher">Head Teacher</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            {filteredUsers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No users found</p>}
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