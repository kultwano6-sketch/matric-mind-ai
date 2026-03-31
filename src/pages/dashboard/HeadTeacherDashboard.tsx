import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, Bell, FileText, TrendingDown, BookOpen, ClipboardList, Eye, Award, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

export default function HeadTeacherDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: allProgress } = useQuery({
    queryKey: ['all-progress-ht'],
    queryFn: async () => {
      const { data } = await supabase.from('student_progress').select('*');
      return data || [];
    },
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['all-profiles-ht'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    },
  });

  const { data: teacherProfiles } = useQuery({
    queryKey: ['teacher-profiles-ht'],
    queryFn: async () => {
      const { data } = await supabase.from('teacher_profiles').select('*');
      return data || [];
    },
  });

  const { data: lessonPlans } = useQuery({
    queryKey: ['all-lesson-plans-ht'],
    queryFn: async () => {
      const { data } = await supabase.from('lesson_plans').select('*').order('updated_at', { ascending: false });
      return data || [];
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ['all-assignments-ht'],
    queryFn: async () => {
      const { data } = await supabase.from('assignments').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ['user-roles-ht'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('*');
      return data || [];
    },
  });

  const studentCount = userRoles?.filter(r => r.role === 'student').length || 0;
  const teacherCount = userRoles?.filter(r => r.role === 'teacher').length || 0;

  // Subject performance
  const subjectStats = new Map<string, { total: number; count: number }>();
  allProgress?.forEach(p => {
    const s = subjectStats.get(p.subject) || { total: 0, count: 0 };
    s.total += p.mastery_level;
    s.count += 1;
    subjectStats.set(p.subject, s);
  });

  const subjectChartData = Array.from(subjectStats.entries()).map(([subject, s]) => ({
    subject: SUBJECT_LABELS[subject as MatricSubject]?.slice(0, 15) || subject,
    fullName: SUBJECT_LABELS[subject as MatricSubject] || subject,
    avg: Math.round(s.total / s.count),
  })).sort((a, b) => b.avg - a.avg);

  // Struggling topics
  const topicFailures = new Map<string, number>();
  allProgress?.filter(p => p.mastery_level < 40).forEach(p => {
    const key = `${p.topic} (${SUBJECT_LABELS[p.subject as MatricSubject]})`;
    topicFailures.set(key, (topicFailures.get(key) || 0) + 1);
  });
  const worstTopics = Array.from(topicFailures.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const schoolAvg = allProgress && allProgress.length > 0
    ? Math.round(allProgress.reduce((a, p) => a + p.mastery_level, 0) / allProgress.length) : 0;

  // Calculate School Health Score
  const strugglingCount = allProgress?.filter(p => p.mastery_level < 40).length || 0;
  const goodCount = allProgress?.filter(p => p.mastery_level >= 60).length || 0;
  const healthScore = allProgress && allProgress.length > 0
    ? Math.round((goodCount / allProgress.length) * 100)
    : 0;

  // Get pending teacher approvals count
  const { data: pendingApprovals } = useQuery({
    queryKey: ['pending-approvals-count'],
    queryFn: async () => {
      const { data } = await supabase.from('teacher_approval_requests').select('id').eq('status', 'pending');
      return data?.length || 0;
    },
  });

  const getBarColor = (avg: number) => {
    if (avg >= 70) return 'hsl(150, 60%, 40%)';
    if (avg >= 50) return 'hsl(45, 85%, 55%)';
    return 'hsl(0, 65%, 50%)';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Head Teacher Header - Gold themed */}
      <div className="relative overflow-hidden rounded-2xl p-6 lg:p-8" style={{
        background: 'linear-gradient(135deg, hsl(45, 85%, 55%), hsl(45, 90%, 40%), hsl(30, 80%, 35%))'
      }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{
          background: 'radial-gradient(circle, white, transparent)',
          transform: 'translate(30%, -30%)'
        }} />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-12 h-12 rounded-xl bg-white/25 backdrop-blur flex items-center justify-center">
                <Eye className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">Academic Oversight</h1>
                <p className="text-white/80 text-sm">{profile?.full_name} • School-wide performance</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/teachers')} size="sm" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
              <Users className="w-4 h-4 mr-1" /> Teachers
            </Button>
            <Button onClick={() => navigate('/announcements')} size="sm" className="bg-white text-[hsl(45,90%,30%)] hover:bg-white/90">
              <Bell className="w-4 h-4 mr-1" /> Announce
            </Button>
          </div>
        </div>
      </div>

      {/* Key Academic Metrics - Large number style */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* School Health Score - Prominent */}
        <Card className="lg:col-span-1 border-l-4" style={{ borderLeftColor: healthScore >= 70 ? 'hsl(150, 60%, 40%)' : healthScore >= 50 ? 'hsl(45, 85%, 55%)' : 'hsl(0, 65%, 50%)' }}>
          <CardContent className="p-4">
            <p className="text-3xl font-bold">{healthScore}%</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Award className="w-3 h-3" /> School Health Score</p>
          </CardContent>
        </Card>
        
        {/* Alerts */}
        {(pendingApprovals || 0) > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/admin/teachers')}>
            <CardContent className="p-4">
              <p className="text-3xl font-bold text-amber-600">{pendingApprovals}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Pending Approvals</p>
            </CardContent>
          </Card>
        )}
        
        <Card>
          <CardContent className="p-4">
            <p className="text-3xl font-bold">{studentCount}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Learners</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-3xl font-bold">{teacherCount}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Teachers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-destructive">{strugglingCount}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Struggling</p>
          </CardContent>
        </Card>
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Subject Performance Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[hsl(45,85%,55%)]" />
              Subject Performance Ranking
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subjectChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subjectChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="subject" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(value: number) => [`${value}%`, 'Average Mastery']} />
                  <Bar dataKey="avg" radius={[0, 6, 6, 0]} barSize={20}>
                    {subjectChartData.map((entry, index) => (
                      <Cell key={index} fill={getBarColor(entry.avg)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-16">
                <BarChart3 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No performance data yet. Data will appear as learners complete activities.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Struggling Topics Sidebar */}
        <div className="space-y-4">
          {worstTopics.length > 0 && (
            <Card className="border-destructive/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-destructive" />
                  Attention Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {worstTopics.map(([topic, count]) => (
                    <div key={topic}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="truncate pr-2">{topic}</span>
                        <Badge variant="destructive" className="shrink-0">{count}</Badge>
                      </div>
                      <Progress value={Math.min(count * 20, 100)} className="h-1.5 [&>div]:bg-destructive" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick stats card */}
          <Card className="bg-muted/30">
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Quick Insights</h3>
              <Separator />
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Top performing</span>
                  <span className="font-medium">{subjectChartData[0]?.fullName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Needs support</span>
                  <span className="font-medium">{subjectChartData[subjectChartData.length - 1]?.fullName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active topics</span>
                  <span className="font-medium">{allProgress?.length || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Teacher Activity Grid */}
      {teacherProfiles && teacherProfiles.length > 0 && (
        <div>
          <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-[hsl(45,85%,55%)]" /> Teacher Performance
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teacherProfiles.map(tp => {
              const prof = allProfiles?.find(p => p.user_id === tp.user_id);
              const subjects = (tp.subjects as MatricSubject[]) || [];
              const teacherPlans = lessonPlans?.filter(lp => lp.teacher_id === tp.user_id) || [];
              const teacherAssignments = assignments?.filter(a => a.created_by === tp.user_id) || [];
              return (
                <Card key={tp.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm"
                        style={{ backgroundColor: 'hsl(150, 60%, 40%, 0.1)', color: 'hsl(150, 60%, 40%)' }}>
                        {(prof?.full_name || 'T').charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold">{prof?.full_name || 'Teacher'}</p>
                        <p className="text-xs text-muted-foreground">{subjects.length} subject{subjects.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {subjects.map(s => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-muted">
                          {SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}
                        </span>
                      ))}
                    </div>
                    <Separator className="my-3" />
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div>
                        <p className="text-xl font-bold">{teacherPlans.length}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Plans</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold">{teacherAssignments.length}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Assigned</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Lesson Plans */}
      {lessonPlans && lessonPlans.length > 0 && (
        <div>
          <h2 className="text-xl font-display font-semibold mb-4">Recent Lesson Plans</h2>
          <div className="space-y-2">
            {lessonPlans.slice(0, 5).map(plan => {
              const teacher = allProfiles?.find(p => p.user_id === plan.teacher_id);
              return (
                <div key={plan.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="text-xl shrink-0">{SUBJECT_ICONS[plan.subject]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{plan.topic}</p>
                    <p className="text-xs text-muted-foreground">{teacher?.full_name || 'Teacher'} • {SUBJECT_LABELS[plan.subject]}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(plan.updated_at).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
