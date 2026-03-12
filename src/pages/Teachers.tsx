import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { Users, BookOpen, FileText, TrendingUp } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

export default function TeachersPage() {
  const { data: teacherProfiles } = useQuery({
    queryKey: ['ht-teacher-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('teacher_profiles').select('*');
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['ht-all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    },
  });

  const { data: lessonPlans } = useQuery({
    queryKey: ['ht-all-lesson-plans'],
    queryFn: async () => {
      const { data } = await supabase.from('lesson_plans').select('*');
      return data || [];
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ['ht-all-assignments'],
    queryFn: async () => {
      const { data } = await supabase.from('assignments').select('*').eq('is_ai_generated', false);
      return data || [];
    },
  });

  const { data: studentProgress } = useQuery({
    queryKey: ['ht-all-progress'],
    queryFn: async () => {
      const { data } = await supabase.from('student_progress').select('*');
      return data || [];
    },
  });

  const teachers = teacherProfiles?.map(tp => {
    const prof = profiles?.find(p => p.user_id === tp.user_id);
    const plans = lessonPlans?.filter(lp => lp.teacher_id === tp.user_id) || [];
    const teacherAssignments = assignments?.filter(a => a.created_by === tp.user_id) || [];
    const subjects = (tp.subjects as MatricSubject[]) || [];

    // Calculate avg student performance in teacher's subjects
    const relevantProgress = studentProgress?.filter(p => subjects.includes(p.subject as MatricSubject)) || [];
    const avgPerformance = relevantProgress.length > 0
      ? Math.round(relevantProgress.reduce((a, p) => a + p.mastery_level, 0) / relevantProgress.length)
      : 0;

    return {
      id: tp.id,
      userId: tp.user_id,
      name: prof?.full_name || 'Unknown',
      avatar: prof?.avatar_url,
      subjects,
      planCount: plans.length,
      assignmentCount: teacherAssignments.length,
      avgPerformance,
      lastPlan: plans.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0],
    };
  }) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold">Teacher Overview</h1>
          <p className="text-muted-foreground mt-1">Monitor teacher activity and performance</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Teachers', value: teachers.length, icon: Users },
            { label: 'Total Lesson Plans', value: lessonPlans?.length || 0, icon: FileText },
            { label: 'Total Assignments', value: assignments?.length || 0, icon: BookOpen },
            { label: 'Avg Performance', value: `${teachers.length > 0 ? Math.round(teachers.reduce((a, t) => a + t.avgPerformance, 0) / teachers.length) : 0}%`, icon: TrendingUp },
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

        <div className="space-y-4">
          {teachers.map(teacher => (
            <Card key={teacher.id} className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-lg">
                      {teacher.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold">{teacher.name}</h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {teacher.subjects.map(s => (
                          <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Lesson Plans</p>
                    <p className="font-semibold text-lg">{teacher.planCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Assignments</p>
                    <p className="font-semibold text-lg">{teacher.assignmentCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Student Avg</p>
                    <p className="font-semibold text-lg">{teacher.avgPerformance}%</p>
                  </div>
                </div>

                <div className="mt-3">
                  <Progress value={teacher.avgPerformance} className="h-2" />
                </div>

                {teacher.lastPlan && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last plan: "{teacher.lastPlan.topic}" — {new Date(teacher.lastPlan.updated_at).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
          {teachers.length === 0 && (
            <Card className="glass-card">
              <CardContent className="p-8 text-center text-muted-foreground">
                No teachers registered yet.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
