import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, BookOpen, AlertTriangle, Plus, TrendingUp } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

export default function TeacherDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const { data: teacherProfile } = useQuery({
    queryKey: ['teacher-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('teacher_profiles').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: lessonPlans } = useQuery({
    queryKey: ['lesson-plans', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('lesson_plans').select('*').eq('teacher_id', user!.id).order('updated_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: assignments } = useQuery({
    queryKey: ['teacher-assignments', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('assignments').select('*').eq('created_by', user!.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: studentProgress } = useQuery({
    queryKey: ['all-student-progress'],
    queryFn: async () => {
      const { data } = await supabase.from('student_progress').select('*');
      return data || [];
    },
    enabled: !!user,
  });

  const subjects = (teacherProfile?.subjects as MatricSubject[]) || [];
  const struggling = studentProgress?.filter(p => p.mastery_level < 40) || [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome, {profile?.full_name}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/lesson-plans')} variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-1" /> Lesson Plans
          </Button>
          <Button onClick={() => navigate('/assignments')} size="sm">
            <Plus className="w-4 h-4 mr-1" /> New Assignment
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'My Subjects', value: subjects.length.toString(), icon: BookOpen, color: 'hsl(var(--student-accent))' },
          { label: 'Lesson Plans', value: (lessonPlans?.length || 0).toString(), icon: FileText, color: 'hsl(var(--teacher-accent))' },
          { label: 'Assignments', value: (assignments?.length || 0).toString(), icon: BookOpen, color: 'hsl(var(--head-teacher-accent))' },
          { label: 'Struggling Students', value: struggling.length.toString(), icon: AlertTriangle, color: 'hsl(var(--admin-accent))' },
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

      {/* My Subjects */}
      <div>
        <h2 className="text-xl font-display font-semibold mb-4">My Subjects</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map(subject => {
            const subjectProgress = studentProgress?.filter(p => p.subject === subject) || [];
            const avgMastery = subjectProgress.length > 0
              ? Math.round(subjectProgress.reduce((a, p) => a + p.mastery_level, 0) / subjectProgress.length) : 0;
            const plans = lessonPlans?.filter(lp => lp.subject === subject) || [];
            return (
              <Card key={subject} className="glass-card hover:shadow-xl transition-shadow cursor-pointer" onClick={() => navigate(`/students?subject=${subject}`)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-2xl">{SUBJECT_ICONS[subject]}</span>
                      <h3 className="font-semibold mt-1">{SUBJECT_LABELS[subject]}</h3>
                    </div>
                    <Badge variant="secondary">{plans.length} plans</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg Student Mastery</span>
                      <span className="font-medium">{avgMastery}%</span>
                    </div>
                    <Progress value={avgMastery} className="h-2" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {subjectProgress.length} student topics tracked
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Lesson Plans */}
      {lessonPlans && lessonPlans.length > 0 && (
        <div>
          <h2 className="text-xl font-display font-semibold mb-4">Recent Lesson Plans</h2>
          <div className="space-y-3">
            {lessonPlans.slice(0, 5).map(plan => (
              <Card key={plan.id} className="glass-card">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{SUBJECT_ICONS[plan.subject]}</span>
                    <div>
                      <p className="font-medium">{plan.topic}</p>
                      <p className="text-xs text-muted-foreground">{SUBJECT_LABELS[plan.subject]} • {plan.syllabus_position || 'No position set'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(plan.updated_at).toLocaleDateString()}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Struggling Students Alert */}
      {struggling.length > 0 && (
        <Card className="glass-card border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Students Needing Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {struggling.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span>{s.topic} ({SUBJECT_LABELS[s.subject]})</span>
                  <Badge variant="destructive">{s.mastery_level}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {subjects.length === 0 && (
        <Card className="glass-card">
          <CardContent className="p-8 text-center text-muted-foreground">
            No subjects assigned yet. Update your profile with the subjects you teach.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
