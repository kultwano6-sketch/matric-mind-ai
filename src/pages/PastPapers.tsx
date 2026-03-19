import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { FileText, Clock, Award, TrendingUp, Play, History, Filter, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

interface PastPaper {
  id: string;
  subject: MatricSubject;
  year: number;
  paper_number: number;
  title: string;
  duration_minutes: number;
  total_marks: number;
  questions: any[];
}

interface PaperAttempt {
  id: string;
  paper_id: string;
  score: number | null;
  percentage: number | null;
  time_taken_seconds: number | null;
  is_completed: boolean;
  completed_at: string | null;
  past_papers: PastPaper;
}

export default function PastPapers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // Fetch student profile to get enrolled subjects
  const { data: studentProfile } = useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_profiles')
        .select('subjects')
        .eq('user_id', user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Fetch all past papers
  const { data: papers, isLoading: papersLoading } = useQuery({
    queryKey: ['past-papers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('past_papers')
        .select('*')
        .eq('is_active', true)
        .order('year', { ascending: false })
        .order('paper_number', { ascending: true });
      if (error) throw error;
      return data as PastPaper[];
    },
  });

  // Fetch student's attempts
  const { data: attempts } = useQuery({
    queryKey: ['past-paper-attempts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('past_paper_attempts')
        .select('*, past_papers(*)')
        .eq('student_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PaperAttempt[];
    },
    enabled: !!user,
  });

  const enrolledSubjects = (studentProfile?.subjects as MatricSubject[]) || [];
  const availableYears = useMemo(() => {
    if (!papers) return [];
    const years = [...new Set(papers.map(p => p.year))];
    return years.sort((a, b) => b - a);
  }, [papers]);

  const filteredPapers = useMemo(() => {
    if (!papers) return [];
    return papers.filter(paper => {
      const subjectMatch = selectedSubject === 'all' || paper.subject === selectedSubject;
      const yearMatch = selectedYear === 'all' || paper.year === parseInt(selectedYear);
      return subjectMatch && yearMatch;
    });
  }, [papers, selectedSubject, selectedYear]);

  // Group papers by subject
  const papersBySubject = useMemo(() => {
    return filteredPapers.reduce((acc, paper) => {
      if (!acc[paper.subject]) acc[paper.subject] = [];
      acc[paper.subject].push(paper);
      return acc;
    }, {} as Record<MatricSubject, PastPaper[]>);
  }, [filteredPapers]);

  // Calculate stats
  const completedAttempts = attempts?.filter(a => a.is_completed) || [];
  const averageScore = completedAttempts.length > 0
    ? Math.round(completedAttempts.reduce((acc, a) => acc + (a.percentage || 0), 0) / completedAttempts.length)
    : 0;

  const getBestAttempt = (paperId: string) => {
    const paperAttempts = attempts?.filter(a => a.paper_id === paperId && a.is_completed) || [];
    if (paperAttempts.length === 0) return null;
    return paperAttempts.reduce((best, current) => 
      (current.percentage || 0) > (best.percentage || 0) ? current : best
    );
  };

  const getAttemptCount = (paperId: string) => {
    return attempts?.filter(a => a.paper_id === paperId && a.is_completed).length || 0;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-[hsl(var(--teacher-accent))]';
    if (percentage >= 60) return 'text-accent';
    if (percentage >= 40) return 'text-orange-500';
    return 'text-destructive';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <FileText className="w-8 h-8" />
            Past Papers
          </h1>
          <p className="text-muted-foreground mt-1">
            Practice with real NSC exam papers under timed conditions
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--student-accent))]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[hsl(var(--student-accent))]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{papers?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Available Papers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--teacher-accent))]/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-[hsl(var(--teacher-accent))]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedAttempts.length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{averageScore}%</p>
                <p className="text-xs text-muted-foreground">Average Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {Math.round((completedAttempts.reduce((acc, a) => acc + (a.time_taken_seconds || 0), 0) / 3600))}h
                </p>
                <p className="text-xs text-muted-foreground">Practice Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="browse" className="space-y-4">
        <TabsList>
          <TabsTrigger value="browse">Browse Papers</TabsTrigger>
          <TabsTrigger value="history">My History</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {enrolledSubjects.map(subject => (
                  <SelectItem key={subject} value={subject}>
                    {SUBJECT_ICONS[subject]} {SUBJECT_LABELS[subject]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Papers Grid */}
          {papersLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="glass-card animate-pulse">
                  <CardContent className="p-6 h-48" />
                </Card>
              ))}
            </div>
          ) : Object.keys(papersBySubject).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(papersBySubject).map(([subject, subjectPapers]) => (
                <div key={subject}>
                  <h2 className="text-lg font-display font-semibold mb-3 flex items-center gap-2">
                    <span>{SUBJECT_ICONS[subject as MatricSubject]}</span>
                    {SUBJECT_LABELS[subject as MatricSubject]}
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subjectPapers.map(paper => {
                      const bestAttempt = getBestAttempt(paper.id);
                      const attemptCount = getAttemptCount(paper.id);

                      return (
                        <Card key={paper.id} className="glass-card hover:shadow-xl transition-all group">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <Badge variant="outline" className="mb-2">
                                  {paper.year} - Paper {paper.paper_number}
                                </Badge>
                                <h3 className="font-semibold text-sm leading-tight">{paper.title}</h3>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {formatDuration(paper.duration_minutes)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Award className="w-4 h-4" />
                                {paper.total_marks} marks
                              </span>
                            </div>

                            {bestAttempt ? (
                              <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Best Score</span>
                                  <span className={`font-bold ${getScoreColor(bestAttempt.percentage || 0)}`}>
                                    {bestAttempt.percentage?.toFixed(0)}%
                                  </span>
                                </div>
                                <Progress value={bestAttempt.percentage || 0} className="h-2" />
                                <p className="text-xs text-muted-foreground">
                                  Attempted {attemptCount} time{attemptCount !== 1 ? 's' : ''}
                                </p>
                              </div>
                            ) : (
                              <div className="py-3 text-center text-sm text-muted-foreground mb-4">
                                Not attempted yet
                              </div>
                            )}

                            <Button
                              className="w-full gap-2"
                              onClick={() => navigate(`/past-papers/${paper.id}`)}
                            >
                              <Play className="w-4 h-4" />
                              {bestAttempt ? 'Try Again' : 'Start Paper'}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Papers Found</h3>
                <p className="text-muted-foreground">
                  {selectedSubject !== 'all' || selectedYear !== 'all'
                    ? 'Try adjusting your filters to see more papers.'
                    : 'No past papers are available yet. Check back soon!'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {completedAttempts.length > 0 ? (
            <div className="space-y-3">
              {completedAttempts.map(attempt => (
                <Card key={attempt.id} className="glass-card hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xl">
                          {SUBJECT_ICONS[attempt.past_papers.subject]}
                        </div>
                        <div>
                          <h3 className="font-semibold">{attempt.past_papers.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            Completed {new Date(attempt.completed_at!).toLocaleDateString()} 
                            {attempt.time_taken_seconds && ` in ${formatDuration(Math.round(attempt.time_taken_seconds / 60))}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${getScoreColor(attempt.percentage || 0)}`}>
                            {attempt.percentage?.toFixed(0)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {attempt.score}/{attempt.past_papers.total_marks}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/past-papers/${attempt.paper_id}/review/${attempt.id}`)}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-12 text-center">
                <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No History Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Complete your first past paper to see your history here.
                </p>
                <Button onClick={() => document.querySelector('[data-state="inactive"]')?.click()}>
                  Browse Papers
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
