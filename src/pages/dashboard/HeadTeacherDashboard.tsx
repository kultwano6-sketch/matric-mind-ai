import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, Bell, FileText, TrendingDown, BookOpen, ClipboardList } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
    subject: SUBJECT_LABELS[subject as MatricSubject]?.slice(0, 12) || subject,
    avg: Math.round(s.total / s.count),
  })).sort((a, b) => a.avg - b.avg);

  // Struggling topics
  const topicFailures = new Map<string, number>();
  allProgress?.filter(p => p.mastery_level < 40).forEach(p => {
    const key = `${p.topic} (${SUBJECT_LABELS[p.subject as MatricSubject]})`;
    topicFailures.set(key, (topicFailures.get(key) || 0) + 1);
  });
  const worstTopics = Array.from(topicFailures.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Head Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-1">School-wide academic overview — {profile?.full_name}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/teachers')} variant="outline" size="sm">
            <Users className="w-4 h-4 mr-1" /> Teachers
          </Button>
          <Button onClick={() => navigate('/announcements')} size="sm">
            <Bell className="w-4 h-4 mr-1" /> Announcements
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Learners', value: studentCount.toString(), icon: GraduationCap, color: 'hsl(var(--student-accent))' },
          { label: 'Teachers', value: teacherCount.toString(), icon: Users, color: 'hsl(var(--teacher-accent))' },
          { label: 'Lesson Plans', value: (lessonPlans?.length || 0).toString(), icon: FileText, color: 'hsl(var(--head-teacher-accent))' },
          { label: 'Assignments', value: (assignments?.length || 0).toString(), icon: ClipboardList, color: 'hsl(var(--admin-accent))' },
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

      {/* Subject Performance Chart */}
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-lg">Subject Performance Overview</CardTitle></CardHeader>
        <CardContent>
          {subjectChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={subjectChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="avg" fill="hsl(200,80%,50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">No progress data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Teachers Overview */}
      {teacherProfiles && teacherProfiles.length > 0 && (
        <div>
          <h2 className="text-xl font-display font-semibold mb-4">Teacher Overview</h2>
          <div className="space-y-3">
            {teacherProfiles.map(tp => {
              const prof = allProfiles?.find(p => p.user_id === tp.user_id);
              const subjects = (tp.subjects as MatricSubject[]) || [];
              const teacherPlans = lessonPlans?.filter(lp => lp.teacher_id === tp.user_id) || [];
              const teacherAssignments = assignments?.filter(a => a.created_by === tp.user_id) || [];
              return (
                <Card key={tp.id} className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-medium">
                          {(prof?.full_name || 'T').charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{prof?.full_name || 'Teacher'}</p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {subjects.map(s => (
                              <Badge key={s} variant="secondary" className="text-[10px]">
                                {SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">{teacherPlans.length} plans • {teacherAssignments.length} assignments</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Struggling Topics */}
      {worstTopics.length > 0 && (
        <Card className="glass-card border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-destructive" />
              Most Challenging Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {worstTopics.map(([topic, count]) => (
                <div key={topic} className="flex items-center justify-between text-sm">
                  <span>{topic}</span>
                  <Badge variant="destructive">{count} struggling</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Lesson Plans */}
      {lessonPlans && lessonPlans.length > 0 && (
        <div>
          <h2 className="text-xl font-display font-semibold mb-4">Recent Lesson Plans</h2>
          <div className="space-y-3">
            {lessonPlans.slice(0, 5).map(plan => {
              const teacher = allProfiles?.find(p => p.user_id === plan.teacher_id);
              return (
                <Card key={plan.id} className="glass-card">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{SUBJECT_ICONS[plan.subject]}</span>
                      <div>
                        <p className="font-medium">{plan.topic}</p>
                        <p className="text-xs text-muted-foreground">{teacher?.full_name || 'Teacher'} • {SUBJECT_LABELS[plan.subject]}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(plan.updated_at).toLocaleDateString()}</span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}