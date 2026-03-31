import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Shield, Users, Activity, UserCog, GraduationCap, BookOpen, Bell,
  Database, Search, AlertTriangle, CheckCircle, Clock, Server,
  TrendingUp, FileText, PieChart
} from 'lucide-react';
import type { Database as DB } from '@/integrations/supabase/types';

type AppRole = DB['public']['Enums']['app_role'];

const ROLE_LABELS: Record<AppRole, string> = {
  student: 'Learner',
  teacher: 'Teacher',
  head_teacher: 'Head Teacher',
  admin: 'Admin',
};

const ROLE_BADGE_STYLES: Record<AppRole, string> = {
  student: 'bg-[hsl(200,80%,50%)]/10 text-[hsl(200,80%,50%)] border-[hsl(200,80%,50%)]/30',
  teacher: 'bg-[hsl(150,60%,40%)]/10 text-[hsl(150,60%,40%)] border-[hsl(150,60%,40%)]/30',
  head_teacher: 'bg-[hsl(45,85%,55%)]/10 text-[hsl(45,85%,40%)] border-[hsl(45,85%,55%)]/30',
  admin: 'bg-[hsl(0,65%,50%)]/10 text-[hsl(0,65%,50%)] border-[hsl(0,65%,50%)]/30',
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

  const { data: pendingApprovals } = useQuery({
    queryKey: ['admin-pending-approvals'],
    queryFn: async () => {
      const { data } = await supabase.from('teacher_approval_requests').select('*').eq('status', 'pending');
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

  const { data: submissions } = useQuery({
    queryKey: ['admin-all-submissions'],
    queryFn: async () => {
      const { data } = await supabase.from('assignment_submissions').select('id, score');
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
  const totalSubmissions = submissions?.length || 0;
  const gradedSubmissions = submissions?.filter(s => s.score !== null).length || 0;

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
    <div className="space-y-6 animate-fade-in">
      {/* Admin Header Banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 lg:p-8" style={{
        background: 'linear-gradient(135deg, hsl(0, 65%, 50%), hsl(0, 65%, 35%), hsl(220, 70%, 22%))'
      }}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)',
          backgroundSize: '30px 30px'
        }} />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">System Control Center</h1>
                <p className="text-white/70 text-sm">{profile?.full_name} • Full platform oversight</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/admin/system')} variant="secondary" size="sm" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
              <Server className="w-4 h-4 mr-1" /> System Health
            </Button>
            <Button onClick={() => navigate('/announcements')} size="sm" className="bg-white text-[hsl(0,65%,40%)] hover:bg-white/90">
              <Bell className="w-4 h-4 mr-1" /> Broadcast
            </Button>
          </div>
        </div>
      </div>

      {/* System Metrics - Horizontal bar style */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {pendingApprovals && pendingApprovals.length > 0 && (
          <div 
            className="relative overflow-hidden rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4 cursor-pointer hover:shadow-md transition-all lg:col-span-2"
            onClick={() => navigate('/admin/teachers')}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <UserCog className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{pendingApprovals.length}</p>
                <p className="text-xs text-muted-foreground">Pending Teacher Approvals</p>
              </div>
            </div>
          </div>
        )}
        {[
          { label: 'Total Users', value: totalUsers, icon: Users, color: '220, 70%, 22%' },
          { label: 'Learners', value: studentCount, icon: GraduationCap, color: '200, 80%, 50%' },
          { label: 'Teachers', value: teacherCount, icon: BookOpen, color: '150, 60%, 40%' },
          { label: 'Lesson Plans', value: lessonPlans?.length || 0, icon: FileText, color: '270, 60%, 50%' },
          { label: 'Assignments', value: allAssignments?.length || 0, icon: PieChart, color: '30, 80%, 50%' },
        ].map(stat => (
          <div key={stat.label} className="relative overflow-hidden rounded-xl border bg-card p-4">
            <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: `hsl(${stat.color})` }} />
            <stat.icon className="w-4 h-4 mb-2" style={{ color: `hsl(${stat.color})` }} />
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main Admin Content - Tabbed interface */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="users" className="gap-1"><UserCog className="w-4 h-4" /> Users</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1"><Activity className="w-4 h-4" /> Activity</TabsTrigger>
          <TabsTrigger value="overview" className="gap-1"><Database className="w-4 h-4" /> Overview</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search users..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Filter role" /></SelectTrigger>
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
              <div className="divide-y">
                {filteredUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0"
                        style={{ backgroundColor: `hsl(${u.role === 'admin' ? '0,65%,50%' : u.role === 'teacher' ? '150,60%,40%' : u.role === 'head_teacher' ? '45,85%,55%' : '200,80%,50%'} / 0.15)` }}>
                        {u.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{u.name}</p>
                        <Badge variant="outline" className={`text-[10px] ${ROLE_BADGE_STYLES[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </Badge>
                      </div>
                    </div>
                    <Select value={u.role} onValueChange={(v) => updateRole.mutate({ userId: u.user_id, newRole: v as AppRole })}>
                      <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Learner</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="head_teacher">Head Teacher</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {filteredUsers.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No users found</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader><CardTitle className="text-lg">System Activity Log</CardTitle></CardHeader>
            <CardContent>
              {activityLog && activityLog.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-4">
                    {activityLog.map(log => (
                      <div key={log.id} className="flex gap-4 pl-8 relative">
                        <div className="absolute left-[11px] top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{log.action}</p>
                          <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Platform Health */}
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Server className="w-5 h-5" /> Platform Health</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Database', status: 'Operational', icon: CheckCircle, ok: true },
                  { label: 'Authentication', status: 'Active', icon: CheckCircle, ok: true },
                  { label: 'Edge Functions', status: 'Running', icon: CheckCircle, ok: true },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm">{item.label}</span>
                    <div className="flex items-center gap-1.5">
                      <item.icon className={`w-4 h-4 ${item.ok ? 'text-[hsl(150,60%,40%)]' : 'text-destructive'}`} />
                      <span className="text-xs text-muted-foreground">{item.status}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Grading Stats */}
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Grading Progress</CardTitle></CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className="text-4xl font-bold">{totalSubmissions > 0 ? Math.round((gradedSubmissions / totalSubmissions) * 100) : 0}%</p>
                  <p className="text-sm text-muted-foreground mt-1">Submissions graded</p>
                  <p className="text-xs text-muted-foreground mt-1">{gradedSubmissions} of {totalSubmissions} total</p>
                </div>
              </CardContent>
            </Card>

            {/* Recent Announcements */}
            <Card className="sm:col-span-2">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Bell className="w-5 h-5" /> Recent Announcements</CardTitle></CardHeader>
              <CardContent>
                {announcements && announcements.length > 0 ? (
                  <div className="space-y-3">
                    {announcements.map(a => (
                      <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{a.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{a.content}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{new Date(a.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No announcements yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
