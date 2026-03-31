import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, BookOpen, AlertTriangle, Plus, ClipboardList, PenTool, GraduationCap, CheckCircle2, Clock } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

type TeacherProfile = { subjects?: MatricSubject[] } | null;
type StudentProfile = { id: string; user_id: string; subjects?: MatricSubject[]; profiles?: { full_name?: string } };

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

  const { data: studentProfiles } = useQuery<StudentProfile[]>({
    queryKey: ['students-in-my-subjects', teacherProfile?.subjects],
    queryFn: async () => {
      const { data } = await supabase.from('student_profiles').select('*, profiles:profiles(full_name, avatar_url)');
      return (data as StudentProfile[]) || [];
    },
    enabled: !!teacherProfile,
  });
  
  const learnerProfiles = studentProfiles;

  const { data: studentProgress } = useQuery({
    queryKey: ['teacher-student-progress'],
    queryFn: async () => {
      const { data } = await supabase.from('student_progress').select('*');
      return data || [];
    },
    enabled: !!user,
  });

  const subjects = teacherProfile?.subjects || [];

  const getLearnersForSubject = (subject: MatricSubject) => {
    return studentProfiles?.filter(sp =>
      (sp.subjects as MatricSubject[])?.includes(subject)
    ) || [];
  };

  const totalLearners = new Set(
    subjects.flatMap(s => getLearnersForSubject(s).map(l => l.user_id))
  ).size;

  const pendingSubmissions = submissions?.filter(s => s.score === null).length || 0;
  const totalAssignments = assignments?.length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Teacher Header - Green themed */}
      <div className="relative overflow-hidden rounded-2xl p-6 lg:p-8" style={{
        background: 'linear-gradient(135deg, hsl(150, 60%, 40%), hsl(150, 50%, 30%), hsl(170, 50%, 25%))'
      }}>
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white' fill-opacity='1'%3E%3Cpath d='M20 0L40 20L20 40L0 20z'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '40px 40px'
        }} />
        <div className="relative">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center font-bold text-xl text-white">
                {profile?.full_name?.charAt(0) || 'T'}
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">
                  {profile?.full_name}'s Classroom
                </h1>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {subjects.map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white">
                      {SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/lesson-plans')} size="sm" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                <FileText className="w-4 h-4 mr-1" /> Lesson Plans
              </Button>
              <Button onClick={() => navigate('/assignments')} size="sm" className="bg-white text-[hsl(150,50%,30%)] hover:bg-white/90">
                <Plus className="w-4 h-4 mr-1" /> New Assignment
              </Button>
            </div>
          </div>

          {/* Inline stats in header */}
          <div className="grid grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Subjects', value: subjects.length, icon: BookOpen },
              { label: 'Learners', value: totalLearners, icon: GraduationCap },
              { label: 'Assignments', value: totalAssignments, icon: ClipboardList },
              { label: 'To Grade', value: pendingSubmissions, icon: PenTool },
            ].map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                <s.icon className="w-4 h-4 text-white/70 mx-auto mb-1" />
                <p className="text-xl font-bold text-white">{s.value}</p>
                <p className="text-[10px] text-white/60 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subject-focused tabs */}
      {subjects.length > 0 ? (
        <Tabs defaultValue={subjects[0]} className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            {subjects.map(subject => (
              <TabsTrigger key={subject} value={subject} className="gap-1.5 text-xs">
                <span>{SUBJECT_ICONS[subject]}</span>
                {SUBJECT_LABELS[subject]}
              </TabsTrigger>
            ))}
          </TabsList>

          {subjects.map(subject => {
            const learners = getLearnersForSubject(subject);
            const subjectProgress = studentProgress?.filter(p => p.subject === subject) || [];
            const avgMastery = subjectProgress.length > 0
              ? Math.round(subjectProgress.reduce((a, p) => a + p.mastery_level, 0) / subjectProgress.length) : 0;
            const subjectAssignments = assignments?.filter(a => a.subject === subject) || [];
            const plans = lessonPlans?.filter(lp => lp.subject === subject) || [];
            const struggling = subjectProgress.filter(p => p.mastery_level < 40);

            return (
              <TabsContent key={subject} value={subject} className="space-y-4">
                {/* Subject summary row */}
                <div className="grid sm:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-5 text-center">
                      <span className="text-4xl block mb-2">{SUBJECT_ICONS[subject]}</span>
                      <h3 className="font-display font-bold text-lg">{SUBJECT_LABELS[subject]}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{learners.length} learner{learners.length !== 1 ? 's' : ''} enrolled</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4" style={{ borderLeftColor: avgMastery >= 70 ? 'hsl(150,60%,40%)' : avgMastery >= 50 ? 'hsl(45,85%,55%)' : 'hsl(0,65%,50%)' }}>
                    <CardContent className="p-5">
                      <p className="text-sm text-muted-foreground mb-1">Class Average Mastery</p>
                      <p className="text-3xl font-bold">{avgMastery}%</p>
                      <Progress value={avgMastery} className="h-2 mt-2" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-5">
                      <p className="text-sm text-muted-foreground mb-2">Content Created</p>
                      <div className="flex gap-4">
                        <div>
                          <p className="text-2xl font-bold">{plans.length}</p>
                          <p className="text-xs text-muted-foreground">Lesson Plans</p>
                        </div>
                        <Separator orientation="vertical" />
                        <div>
                          <p className="text-2xl font-bold">{subjectAssignments.length}</p>
                          <p className="text-xs text-muted-foreground">Assignments</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Learner list for this subject */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-[hsl(150,60%,40%)]" />
                      Learners in {SUBJECT_LABELS[subject]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {learners.length > 0 ? (
                      <div className="divide-y">
                        {learners.map(learner => {
                          const prof = learner.profiles;
                          const name = prof?.full_name || 'Unknown';
                          const prog = studentProgress?.filter(p => p.student_id === learner.user_id && p.subject === subject) || [];
                          const avg = prog.length > 0 ? Math.round(prog.reduce((a, p) => a + p.mastery_level, 0) / prog.length) : 0;
                          return (
                            <div key={learner.id} className="flex items-center gap-3 py-3">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                style={{ backgroundColor: 'hsl(150, 60%, 40%, 0.1)', color: 'hsl(150, 60%, 40%)' }}>
                                {name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Progress value={avg} className="h-1.5 flex-1 max-w-[200px]" />
                                  <span className="text-xs text-muted-foreground w-10">{avg}%</span>
                                </div>
                              </div>
                              {avg >= 70 && <CheckCircle2 className="w-4 h-4 text-[hsl(150,60%,40%)] shrink-0" />}
                              {avg > 0 && avg < 40 && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">No learners enrolled in this subject yet</p>
                    )}
                  </CardContent>
                </Card>

                {/* Subject assignments */}
                {subjectAssignments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ClipboardList className="w-5 h-5" /> Assignments & Tests
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {subjectAssignments.slice(0, 5).map(a => {
                          const subs = submissions?.filter(s => s.assignment_id === a.id) || [];
                          const graded = subs.filter(s => s.score !== null).length;
                          return (
                            <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                              <div>
                                <p className="font-medium text-sm">{a.title}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px]">{a.assignment_type}</Badge>
                                  {a.due_date && (
                                    <span className="flex items-center gap-0.5">
                                      <Clock className="w-3 h-3" /> Due {new Date(a.due_date).toLocaleDateString()}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <Badge variant={graded === subs.length && subs.length > 0 ? 'default' : 'secondary'} className="shrink-0">
                                {graded}/{subs.length} graded
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Struggling learners alert */}
                {struggling.length > 0 && (
                  <Card className="border-destructive/20 bg-destructive/5">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                        <h3 className="font-semibold text-sm">Attention Needed - {SUBJECT_LABELS[subject]}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">These students need extra support:</p>
                      <div className="space-y-2">
                        {struggling.slice(0, 4).map(s => {
                          const learnerName = learnerProfiles?.find(l => l.user_id === s.student_id)?.profiles?.full_name || 'Unknown';
                          return (
                            <div key={s.id} className="flex items-center justify-between text-sm bg-background rounded-lg p-2">
                              <span className="font-medium">{learnerName}</span>
                              <Badge variant="destructive" className="text-[10px]">{s.mastery_level}% - {s.topic}</Badge>
                            </div>
                          );
                        })}
                      </div>
                      <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => navigate(`/students?subject=${subject}`)}>
                        View All Students
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Quick actions for this subject */}
                <div className="flex gap-3 flex-wrap">
                  <Button onClick={() => navigate(`/assignments?subject=${subject}`)} size="sm">
                    <Plus className="w-4 h-4 mr-1" /> Create Homework
                  </Button>
                  <Button onClick={() => navigate(`/assignments?subject=${subject}&type=test`)} variant="outline" size="sm">
                    <PenTool className="w-4 h-4 mr-1" /> Create Test
                  </Button>
                  <Button onClick={() => navigate('/lesson-plans')} variant="outline" size="sm">
                    <FileText className="w-4 h-4 mr-1" /> Lesson Plans
                  </Button>
                  <Button onClick={() => navigate(`/students?subject=${subject}`)} variant="ghost" size="sm">
                    <Users className="w-4 h-4 mr-1" /> View All Learners
                  </Button>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No subjects assigned yet</p>
            <p className="text-sm mt-1">Update your profile with the subjects you teach to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
