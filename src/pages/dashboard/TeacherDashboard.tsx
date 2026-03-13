import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, BookOpen, AlertTriangle, Plus, ClipboardList, PenTool, GraduationCap } from 'lucide-react';
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

  const { data: submissions } = useQuery({
    queryKey: ['teacher-submissions', user?.id],
    queryFn: async () => {
      if (!assignments || assignments.length === 0) return [];
      const assignmentIds = assignments.map(a => a.id);
      const { data } = await supabase.from('assignment_submissions').select('*, assignments(*)').in('assignment_id', assignmentIds);
      return data || [];
    },
    enabled: !!assignments,
  });

  const { data: studentProfiles } = useQuery({
    queryKey: ['students-in-my-subjects', teacherProfile?.subjects],
    queryFn: async () => {
      const { data } = await supabase.from('student_profiles').select('*, profiles:profiles(full_name, avatar_url)');
      return data || [];
    },
    enabled: !!teacherProfile,
  });

  const { data: studentProgress } = useQuery({
    queryKey: ['teacher-student-progress'],
    queryFn: async () => {
      const { data } = await supabase.from('student_progress').select('*');
      return data || [];
    },
    enabled: !!user,
  });

  const subjects = (teacherProfile?.subjects as MatricSubject[]) || [];

  // Get learners per subject
  const getLearnersForSubject = (subject: MatricSubject) => {
    return studentProfiles?.filter(sp => 
      (sp.subjects as MatricSubject[])?.includes(subject)
    ) || [];
  };

  const totalLearners = new Set(
    subjects.flatMap(s => getLearnersForSubject(s).map(l => l.user_id))
  ).size;

  const pendingSubmissions = submissions?.filter(s => s.score === null).length || 0;
  const struggling = studentProgress?.filter(p => 
    subjects.includes(p.subject as MatricSubject) && p.mastery_level < 40
  ) || [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome, {profile?.full_name}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => navigate('/lesson-plans')} variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-1" /> Lesson Plans
          </Button>
          <Button onClick={() => navigate('/assignments')} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Create Assignment
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'My Subjects', value: subjects.length.toString(), icon: BookOpen, color: 'hsl(var(--student-accent))' },
          { label: 'My Learners', value: totalLearners.toString(), icon: GraduationCap, color: 'hsl(var(--teacher-accent))' },
          { label: 'Assignments', value: (assignments?.length || 0).toString(), icon: ClipboardList, color: 'hsl(var(--head-teacher-accent))' },
          { label: 'To Grade', value: pendingSubmissions.toString(), icon: PenTool, color: 'hsl(var(--admin-accent))' },
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

      {/* My Subjects with Learner Counts */}
      <div>
        <h2 className="text-xl font-display font-semibold mb-4">My Subjects & Learners</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map(subject => {
            const learners = getLearnersForSubject(subject);
            const subjectProgress = studentProgress?.filter(p => p.subject === subject) || [];
            const avgMastery = subjectProgress.length > 0
              ? Math.round(subjectProgress.reduce((a, p) => a + p.mastery_level, 0) / subjectProgress.length) : 0;
            const subjectAssignments = assignments?.filter(a => a.subject === subject) || [];
            const plans = lessonPlans?.filter(lp => lp.subject === subject) || [];

            return (
              <Card key={subject} className="glass-card hover:shadow-xl transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-2xl">{SUBJECT_ICONS[subject]}</span>
                      <h3 className="font-semibold mt-1">{SUBJECT_LABELS[subject]}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-lg font-bold">{learners.length}</p>
                      <p className="text-[10px] text-muted-foreground">Learners</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-lg font-bold">{plans.length}</p>
                      <p className="text-[10px] text-muted-foreground">Plans</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-lg font-bold">{subjectAssignments.length}</p>
                      <p className="text-[10px] text-muted-foreground">Tasks</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg Mastery</span>
                      <span className="font-medium">{avgMastery}%</span>
                    </div>
                    <Progress value={avgMastery} className="h-2" />
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => navigate(`/students?subject=${subject}`)}>
                      <Users className="w-3 h-3 mr-1" /> Learners
                    </Button>
                    <Button size="sm" className="flex-1 text-xs" onClick={() => navigate(`/assignments?subject=${subject}`)}>
                      <Plus className="w-3 h-3 mr-1" /> Assign
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Learners in My Subjects */}
      {subjects.length > 0 && studentProfiles && studentProfiles.length > 0 && (
        <div>
          <h2 className="text-xl font-display font-semibold mb-4">Learners Overview</h2>
          {subjects.map(subject => {
            const learners = getLearnersForSubject(subject);
            if (learners.length === 0) return null;
            return (
              <div key={subject} className="mb-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span>{SUBJECT_ICONS[subject]}</span> {SUBJECT_LABELS[subject]}
                  <Badge variant="secondary">{learners.length} learners</Badge>
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {learners.slice(0, 6).map(learner => {
                    const prof = (learner as any).profiles;
                    const name = prof?.full_name || 'Unknown';
                    const prog = studentProgress?.filter(p => p.student_id === learner.user_id && p.subject === subject) || [];
                    const avg = prog.length > 0 ? Math.round(prog.reduce((a, p) => a + p.mastery_level, 0) / prog.length) : 0;
                    return (
                      <div key={learner.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <div className="flex items-center gap-2">
                            <Progress value={avg} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground">{avg}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {learners.length > 6 && (
                  <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => navigate(`/students?subject=${subject}`)}>
                    View all {learners.length} learners →
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Assignments */}
      {assignments && assignments.length > 0 && (
        <div>
          <h2 className="text-xl font-display font-semibold mb-4">Recent Assignments & Tests</h2>
          <div className="space-y-3">
            {assignments.slice(0, 5).map(a => {
              const subs = submissions?.filter(s => s.assignment_id === a.id) || [];
              const graded = subs.filter(s => s.score !== null).length;
              return (
                <Card key={a.id} className="glass-card">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{SUBJECT_ICONS[a.subject]}</span>
                      <div>
                        <p className="font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {SUBJECT_LABELS[a.subject]} • {a.assignment_type}
                          {a.due_date && ` • Due ${new Date(a.due_date).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={subs.length > 0 ? 'secondary' : 'outline'}>
                        {graded}/{subs.length} graded
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Struggling Learners */}
      {struggling.length > 0 && (
        <Card className="glass-card border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Learners Needing Attention
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