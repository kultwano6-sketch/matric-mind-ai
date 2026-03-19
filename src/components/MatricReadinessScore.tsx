import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { TrendingUp, TrendingDown, Minus, Lightbulb, Target, Award, BookOpen, Clock } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

interface ReadinessScoreProps {
  studentId?: string;
  showDetails?: boolean;
  compact?: boolean;
}

interface SubjectScore {
  subject: MatricSubject;
  score: number;
  testScore: number;
  homeworkScore: number;
  pastPaperScore: number;
  consistencyScore: number;
  coverageScore: number;
}

export function MatricReadinessScore({ studentId, showDetails = true, compact = false }: ReadinessScoreProps) {
  const { user } = useAuth();
  const targetStudentId = studentId || user?.id;

  // Fetch student profile
  const { data: studentProfile } = useQuery({
    queryKey: ['student-profile', targetStudentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_profiles')
        .select('subjects')
        .eq('user_id', targetStudentId!)
        .single();
      return data;
    },
    enabled: !!targetStudentId,
  });

  // Fetch progress data
  const { data: progressData } = useQuery({
    queryKey: ['student-progress', targetStudentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_progress')
        .select('*')
        .eq('student_id', targetStudentId!);
      return data || [];
    },
    enabled: !!targetStudentId,
  });

  // Fetch assignment submissions
  const { data: submissions } = useQuery({
    queryKey: ['student-submissions', targetStudentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('assignment_submissions')
        .select('*, assignments(*)')
        .eq('student_id', targetStudentId!);
      return data || [];
    },
    enabled: !!targetStudentId,
  });

  // Fetch past paper attempts
  const { data: paperAttempts } = useQuery({
    queryKey: ['past-paper-attempts', targetStudentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('past_paper_attempts')
        .select('*, past_papers(*)')
        .eq('student_id', targetStudentId!)
        .eq('is_completed', true);
      return data || [];
    },
    enabled: !!targetStudentId,
  });

  // Fetch study streaks for consistency
  const { data: streaks } = useQuery({
    queryKey: ['study-streaks', targetStudentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('study_streaks')
        .select('login_date')
        .eq('user_id', targetStudentId!)
        .order('login_date', { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!targetStudentId,
  });

  const subjects = (studentProfile?.subjects as MatricSubject[]) || [];

  const subjectScores: SubjectScore[] = useMemo(() => {
    if (!subjects.length) return [];

    return subjects.map(subject => {
      // Test/Quiz performance (40% weight)
      const subjectSubmissions = submissions?.filter(
        s => (s.assignments as any)?.subject === subject && s.score !== null
      ) || [];
      const testScore = subjectSubmissions.length > 0
        ? subjectSubmissions.reduce((acc, s) => acc + (s.score || 0), 0) / subjectSubmissions.length
        : 0;

      // Homework completion (15% weight)
      const totalAssignments = submissions?.filter(
        s => (s.assignments as any)?.subject === subject
      ).length || 0;
      const completedAssignments = subjectSubmissions.length;
      const homeworkScore = totalAssignments > 0 
        ? (completedAssignments / totalAssignments) * 100 
        : 0;

      // Past paper results (25% weight)
      const subjectPaperAttempts = paperAttempts?.filter(
        p => (p.past_papers as any)?.subject === subject
      ) || [];
      const pastPaperScore = subjectPaperAttempts.length > 0
        ? subjectPaperAttempts.reduce((acc, p) => acc + (p.percentage || 0), 0) / subjectPaperAttempts.length
        : 0;

      // Study consistency (10% weight)
      const last30Days = 30;
      const studyDays = streaks?.length || 0;
      const consistencyScore = Math.min((studyDays / last30Days) * 100, 100);

      // Topic coverage (10% weight)
      const subjectProgress = progressData?.filter(p => p.subject === subject) || [];
      const masteredTopics = subjectProgress.filter(p => p.mastery_level >= 70).length;
      const totalTopics = subjectProgress.length || 1;
      const coverageScore = (masteredTopics / totalTopics) * 100;

      // Calculate weighted score
      const score = Math.round(
        testScore * 0.4 +
        homeworkScore * 0.15 +
        pastPaperScore * 0.25 +
        consistencyScore * 0.1 +
        coverageScore * 0.1
      );

      return {
        subject,
        score: Math.min(score, 100),
        testScore: Math.round(testScore),
        homeworkScore: Math.round(homeworkScore),
        pastPaperScore: Math.round(pastPaperScore),
        consistencyScore: Math.round(consistencyScore),
        coverageScore: Math.round(coverageScore),
      };
    });
  }, [subjects, submissions, paperAttempts, streaks, progressData]);

  const overallScore = useMemo(() => {
    if (!subjectScores.length) return 0;
    return Math.round(
      subjectScores.reduce((acc, s) => acc + s.score, 0) / subjectScores.length
    );
  }, [subjectScores]);

  const getScoreColor = (score: number) => {
    if (score >= 76) return 'text-[hsl(var(--teacher-accent))]';
    if (score >= 61) return 'text-yellow-500';
    if (score >= 41) return 'text-orange-500';
    return 'text-destructive';
  };

  const getScoreBg = (score: number) => {
    if (score >= 76) return 'bg-[hsl(var(--teacher-accent))]';
    if (score >= 61) return 'bg-yellow-500';
    if (score >= 41) return 'bg-orange-500';
    return 'bg-destructive';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 76) return 'Ready';
    if (score >= 61) return 'On Track';
    if (score >= 41) return 'Needs Work';
    return 'At Risk';
  };

  const getAITip = (scores: SubjectScore[]) => {
    if (!scores.length) return "Start studying to get personalised tips!";
    
    const lowestSubject = scores.reduce((min, s) => s.score < min.score ? s : min, scores[0]);
    const weakestArea = getWeakestArea(lowestSubject);
    
    return `Focus on ${SUBJECT_LABELS[lowestSubject.subject]}: ${weakestArea}`;
  };

  const getWeakestArea = (score: SubjectScore) => {
    const areas = [
      { name: 'test performance', value: score.testScore },
      { name: 'homework completion', value: score.homeworkScore },
      { name: 'past paper practice', value: score.pastPaperScore },
      { name: 'study consistency', value: score.consistencyScore },
      { name: 'topic coverage', value: score.coverageScore },
    ];
    const weakest = areas.reduce((min, a) => a.value < min.value ? a : min, areas[0]);
    return `improve your ${weakest.name}`;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getScoreBg(overallScore)}`}>
          <span className="text-white font-bold text-lg">{overallScore}</span>
        </div>
        <div>
          <p className="text-sm font-medium">Matric Ready</p>
          <p className={`text-xs ${getScoreColor(overallScore)}`}>{getScoreLabel(overallScore)}</p>
        </div>
      </div>
    );
  }

  return (
    <Card className="glass-card border-2 border-accent/30 overflow-hidden">
      <div className={`h-1 ${getScoreBg(overallScore)}`} />
      <CardContent className="p-6">
        {/* Main Score Display */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-display font-semibold flex items-center gap-2">
              <Target className="w-5 h-5" />
              Matric Readiness Score
            </h3>
            <p className="text-sm text-muted-foreground">Your overall exam preparedness</p>
          </div>
          <div className="text-right">
            <div className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore}%
            </div>
            <Badge className={`mt-1 ${getScoreBg(overallScore)} text-white`}>
              {getScoreLabel(overallScore)}
            </Badge>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>0%</span>
            <span>40%</span>
            <span>60%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden flex">
            <div className="h-full bg-destructive" style={{ width: '40%' }} />
            <div className="h-full bg-orange-500" style={{ width: '20%' }} />
            <div className="h-full bg-yellow-500" style={{ width: '15%' }} />
            <div className="h-full bg-[hsl(var(--teacher-accent))]" style={{ width: '25%' }} />
          </div>
          <div 
            className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-foreground mt-1 transition-all"
            style={{ marginLeft: `calc(${Math.min(overallScore, 100)}% - 6px)` }}
          />
        </div>

        {/* AI Tip */}
        <div className="p-3 rounded-lg bg-[hsl(var(--student-accent))]/10 border border-[hsl(var(--student-accent))]/20 mb-6">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-[hsl(var(--student-accent))] mt-0.5 shrink-0" />
            <p className="text-sm">
              <span className="font-medium">AI Tip:</span> {getAITip(subjectScores)}
            </p>
          </div>
        </div>

        {/* Subject Breakdown */}
        {showDetails && subjectScores.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">By Subject</h4>
            {subjectScores.map(score => (
              <Tooltip key={score.subject}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-help">
                    <span className="text-lg">{SUBJECT_ICONS[score.subject]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">
                          {SUBJECT_LABELS[score.subject]}
                        </span>
                        <span className={`text-sm font-bold ${getScoreColor(score.score)}`}>
                          {score.score}%
                        </span>
                      </div>
                      <Progress value={score.score} className="h-2" />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="w-64 p-3">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1"><Award className="w-3 h-3" /> Tests</span>
                      <span className="font-medium">{score.testScore}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> Homework</span>
                      <span className="font-medium">{score.homeworkScore}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1"><Target className="w-3 h-3" /> Past Papers</span>
                      <span className="font-medium">{score.pastPaperScore}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Consistency</span>
                      <span className="font-medium">{score.consistencyScore}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Coverage</span>
                      <span className="font-medium">{score.coverageScore}%</span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

        {/* Score Legend */}
        <div className="mt-6 pt-4 border-t flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--teacher-accent))]" />
            <span>76-100% Ready</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>61-75% On Track</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span>41-60% Needs Work</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span>0-40% At Risk</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Export a minimal score badge for use in other places
export function ReadinessScoreBadge({ studentId }: { studentId?: string }) {
  return <MatricReadinessScore studentId={studentId} showDetails={false} compact />;
}
