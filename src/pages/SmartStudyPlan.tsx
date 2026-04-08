import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import {
  createStudyPlanEntry,
  completeStudyEntry,
  getStudyPlanEntries,
  generateRecommendations,
  getRecommendations,
  getWeaknesses,
  type StudyRecommendation,
} from '@/services/studentMemory';
import {
  createStudyPlanEntry as createLegacyEntry,
  completeStudyEntry as completeLegacyEntry,
  getStudyPlanEntries as getLegacyEntries,
} from '@/services/studentMemory';
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Sparkles,
  Check, Clock, BookOpen, GripVertical, Loader2, X,
  Trash2, RotateCcw, Brain, Target, TrendingUp, AlertCircle
} from 'lucide-react';

type MatricSubject = string;

interface StudyPlanEntry {
  id: string;
  student_id: string;
  date: string;
  subject: string;
  topic: string;
  duration_min: number;
  completed: boolean;
  created_at: string;
}

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  entries: StudyPlanEntry[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function SmartStudyPlan() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<StudyPlanEntry[]>([]);
  const [recommendations, setRecommendations] = useState<StudyRecommendation[]>([]);
  const [weaknesses, setWeaknesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [draggedEntry, setDraggedEntry] = useState<StudyPlanEntry | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Legacy Study Planner state (merged from StudyPlanner.tsx)
  const [tasks, setTasks] = useState<any[]>(() => {
    const saved = localStorage.getItem('studyTasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [goals, setGoals] = useState<any[]>(() => {
    const saved = localStorage.getItem('studyGoals');
    return saved ? JSON.parse(saved) : [];
  });
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);

  // Add form state
  const [addSubject, setAddSubject] = useState<MatricSubject | ''>('');
  const [addTopic, setAddTopic] = useState('');
  const [addDuration, setAddDuration] = useState('30');

  // Fetch entries for current month
  const fetchEntries = useCallback(async () => {
    if (!user) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;

    try {
      const data = await getStudyPlanEntries(user.id, startDate, endDate);
      setEntries(data as StudyPlanEntry[]);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentDate]);

  // Fetch recommendations and weaknesses
  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      const [recs, weaks] = await Promise.all([
        getRecommendations(user.id),
        getWeaknesses(user.id),
      ]);
      setRecommendations(recs);
      setWeaknesses(weaks);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchEntries();
    fetchData();
  }, [fetchEntries, fetchData]);

  // Generate AI study plan
  const handleGeneratePlan = async () => {
    if (!user) return;

    setGenerating(true);
    try {
      const recs = await generateRecommendations(user.id);
      setRecommendations(recs);

      if (recs.length === 0) {
        toast({
          title: 'No Recommendations',
          description: 'Complete some quizzes first so AI can analyze your weak areas.',
        });
        return;
      }

      // Create study entries for the next 7 days based on recommendations
      const today = new Date();
      let entriesCreated = 0;

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = new Date(today);
        date.setDate(date.getDate() + dayOffset);
        const dateStr = date.toISOString().split('T')[0];

        // Assign 2-3 recommendations per day, cycling through
        const dayRecs = recs.slice((dayOffset * 2) % recs.length, (dayOffset * 2) % recs.length + 2);
        if (dayRecs.length === 0) continue;

        for (const rec of dayRecs) {
          const id = await createStudyPlanEntry(
            user.id,
            dateStr,
            rec.subject,
            rec.topic,
            30
          );
          if (id) entriesCreated++;
        }
      }

      toast({
        title: 'Study Plan Generated! 🎉',
        description: `Created ${entriesCreated} study sessions for the next 7 days.`,
      });

      await fetchEntries();
    } catch (error) {
      console.error('Error generating plan:', error);
      toast({
        title: 'Error',
        description: 'Could not generate study plan. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  // Add manual entry
  const handleAddEntry = async () => {
    if (!user || !addSubject || !addTopic || !selectedDate) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all fields.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const id = await createStudyPlanEntry(
        user.id,
        selectedDate,
        addSubject,
        addTopic,
        parseInt(addDuration) || 30
      );

      if (id) {
        toast({
          title: 'Session Added',
          description: `Study session scheduled for ${selectedDate}.`,
        });
        setShowAddDialog(false);
        setAddSubject('');
        setAddTopic('');
        setAddDuration('30');
        await fetchEntries();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not add study session.',
        variant: 'destructive',
      });
    }
  };

  // Toggle completion
  const handleToggleComplete = async (entry: StudyPlanEntry) => {
    if (entry.completed) return; // Can only complete, not un-complete

    try {
      const success = await completeStudyEntry(entry.id);
      if (success) {
        setEntries(prev => prev.map(e =>
          e.id === entry.id ? { ...e, completed: true } : e
        ));
        toast({
          title: 'Session Completed! ✅',
          description: `Great job completing ${SUBJECT_LABELS[entry.subject as keyof typeof SUBJECT_LABELS] || entry.subject} - ${entry.topic}!`,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not update session.',
        variant: 'destructive',
      });
    }
  };

  // Delete entry
  const handleDeleteEntry = async (entryId: string) => {
    try {
      await supabase.from('study_plan_entries').delete().eq('id', entryId);
      setEntries(prev => prev.filter(e => e.id !== entryId));
      toast({ title: 'Session Removed' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not remove session.',
        variant: 'destructive',
      });
    }
  };

  // Drag & Drop to reschedule
  const handleDragStart = (entry: StudyPlanEntry) => {
    setDraggedEntry(entry);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    if (!draggedEntry || draggedEntry.date === targetDate) {
      setDraggedEntry(null);
      return;
    }

    try {
      await supabase
        .from('study_plan_entries')
        .update({ date: targetDate })
        .eq('id', draggedEntry.id);

      setEntries(prev => prev.map(e =>
        e.id === draggedEntry.id ? { ...e, date: targetDate } : e
      ));

      toast({
        title: 'Session Moved',
        description: `Moved to ${new Date(targetDate + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'long', month: 'short', day: 'numeric' })}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not move session.',
        variant: 'destructive',
      });
    }

    setDraggedEntry(null);
  };

  // Calendar generation
  const calendarDays = useMemo((): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: CalendarDay[] = [];

    // Previous month days
    const prevMonth = new Date(year, month, 0);
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonth.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        date,
        day: prevMonth.getDate() - i,
        isCurrentMonth: false,
        isToday: false,
        entries: entries.filter(e => e.date === dateStr),
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        date,
        day,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        entries: entries.filter(e => e.date === dateStr),
      });
    }

    // Next month days to fill remaining cells
    const remainingCells = 42 - days.length; // 6 rows
    for (let day = 1; day <= remainingCells; day++) {
      const date = new Date(year, month + 1, day);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        date,
        day,
        isCurrentMonth: false,
        isToday: false,
        entries: entries.filter(e => e.date === dateStr),
      });
    }

    return days;
  }, [currentDate, entries]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayEntries = entries.filter(e => e.date === today);
    const completedToday = todayEntries.filter(e => e.completed);
    const totalMinutes = entries.filter(e => e.completed).reduce((sum, e) => sum + e.duration_min, 0);

    return {
      todayTotal: todayEntries.length,
      todayCompleted: completedToday.length,
      totalCompletedMinutes: totalMinutes,
      totalEntries: entries.length,
      completionRate: entries.length > 0
        ? Math.round((entries.filter(e => e.completed).length / entries.length) * 100)
        : 0,
    };
  }, [entries]);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const openAddDialog = (date: string) => {
    setSelectedDate(date);
    setShowAddDialog(true);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl gradient-gold flex items-center justify-center shadow-lg shadow-primary/20">
              <Calendar className="w-7 h-7 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Study Planner</h1>
              <p className="text-muted-foreground">AI-powered study scheduling based on your weaknesses</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-primary/20 hover:bg-primary/10" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" disabled className="border-primary/20">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </Button>
            <Button variant="outline" className="border-primary/20 hover:bg-primary/10" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-lg">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.todayCompleted}/{stats.todayTotal}</p>
                  <p className="text-xs text-muted-foreground">Today's Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-lg">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.totalEntries}</p>
                  <p className="text-xs text-muted-foreground">Total Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-lg">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{Math.round(stats.totalCompletedMinutes / 60)}h</p>
                  <p className="text-xs text-muted-foreground">Study Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-lg">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.completionRate}%</p>
                  <p className="text-xs text-muted-foreground">Completion Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card className="glass-card border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Study Calendar</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleGeneratePlan} disabled={generating}>
                      {generating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Auto-Generate Plan
                    </Button>
                  </div>
                </div>
                <CardDescription>Drag sessions to reschedule them</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAYS.map(day => (
                    <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, idx) => {
                    const dateStr = day.date.toISOString().split('T')[0];
                    return (
                      <div
                        key={idx}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, dateStr)}
                        onClick={() => openAddDialog(dateStr)}
                        className={`
                          min-h-[80px] p-1 rounded-lg border cursor-pointer transition-colors
                          ${day.isCurrentMonth ? 'bg-background' : 'bg-muted/30'}
                          ${day.isToday ? 'border-primary border-2' : 'border-border/50'}
                          hover:bg-muted/50
                        `}
                      >
                        <div className={`
                          text-xs font-medium mb-1
                          ${day.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50'}
                          ${day.isToday ? 'text-primary font-bold' : ''}
                        `}>
                          {day.day}
                        </div>

                        <div className="space-y-0.5">
                          {day.entries.slice(0, 3).map(entry => (
                            <div
                              key={entry.id}
                              draggable={!entry.completed}
                              onDragStart={() => handleDragStart(entry)}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!entry.completed) handleToggleComplete(entry);
                              }}
                              className={`
                                text-[10px] px-1 py-0.5 rounded truncate flex items-center gap-0.5
                                ${entry.completed
                                  ? 'bg-green-500/10 text-green-700 line-through'
                                  : 'bg-primary/10 text-primary hover:bg-primary/20'
                                }
                              `}
                            >
                              {!entry.completed && <GripVertical className="w-2 h-2 shrink-0" />}
                              {entry.completed && <Check className="w-2 h-2 shrink-0" />}
                              <span className="truncate">{entry.topic}</span>
                            </div>
                          ))}
                          {day.entries.length > 3 && (
                            <div className="text-[10px] text-muted-foreground px-1">
                              +{day.entries.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* AI Recommendations */}
            <Card className="glass-card border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  AI Recommendations
                </CardTitle>
                <CardDescription>What to study based on your weak areas</CardDescription>
              </CardHeader>
              <CardContent>
                {recommendations.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-3">No recommendations yet</p>
                    <Button size="sm" variant="outline" onClick={handleGeneratePlan} disabled={generating}>
                      {generating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                      Generate
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {recommendations.slice(0, 8).map((rec, idx) => (
                      <motion.div
                        key={rec.id || idx}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-2 rounded-lg bg-muted/50 text-sm"
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {SUBJECT_LABELS[rec.subject as keyof typeof SUBJECT_LABELS] || rec.subject}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            P{rec.priority}
                          </span>
                        </div>
                        <p className="font-medium text-xs">{rec.topic}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{rec.reason}</p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weak Topics */}
            <Card className="glass-card border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-destructive" />
                  Areas to Focus
                </CardTitle>
              </CardHeader>
              <CardContent>
                {weaknesses.filter(w => w.mastery_pct < 60).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No weak areas identified yet. Keep taking quizzes! 🎯
                  </p>
                ) : (
                  <div className="space-y-2">
                    {weaknesses
                      .filter(w => w.mastery_pct < 60)
                      .sort((a, b) => a.mastery_pct - b.mastery_pct)
                      .slice(0, 6)
                      .map((weakness, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <div>
                            <p className="text-xs font-medium">{weakness.topic}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {SUBJECT_LABELS[weakness.subject as keyof typeof SUBJECT_LABELS] || weakness.subject}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              weakness.mastery_pct < 30 ? 'border-red-500 text-red-600' :
                              weakness.mastery_pct < 50 ? 'border-yellow-500 text-yellow-600' :
                              'border-blue-500 text-blue-600'
                            }`}
                          >
                            {weakness.mastery_pct}%
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Today's Plan */}
            <Card className="glass-card border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Today's Plan</CardTitle>
              </CardHeader>
              <CardContent>
                {entries.filter(e => e.date === new Date().toISOString().split('T')[0]).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No sessions scheduled for today
                  </p>
                ) : (
                  <div className="space-y-2">
                    {entries
                      .filter(e => e.date === new Date().toISOString().split('T')[0])
                      .map(entry => (
                        <div
                          key={entry.id}
                          className={`
                            p-2 rounded-lg border flex items-center justify-between
                            ${entry.completed ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/30 border-border/50'}
                          `}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleComplete(entry)}
                              className={`
                                w-5 h-5 rounded-full border-2 flex items-center justify-center
                                ${entry.completed
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-muted-foreground/30 hover:border-primary'
                                }
                              `}
                            >
                              {entry.completed && <Check className="w-3 h-3" />}
                            </button>
                            <div>
                              <p className={`text-xs font-medium ${entry.completed ? 'line-through text-muted-foreground' : ''}`}>
                                {entry.topic}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {SUBJECT_LABELS[entry.subject as keyof typeof SUBJECT_LABELS] || entry.subject} · {entry.duration_min}min
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6"
                            onClick={() => handleDeleteEntry(entry.id)}
                          >
                            <X className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Add Session Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Study Session</DialogTitle>
              <DialogDescription>
                Schedule a study session for {selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Subject</Label>
                <Select value={addSubject} onValueChange={(v) => setAddSubject(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_SUBJECTS.map(s => (
                      <SelectItem key={s} value={s}>
                        {SUBJECT_ICONS[s as keyof typeof SUBJECT_ICONS] || '📖'} {SUBJECT_LABELS[s as keyof typeof SUBJECT_LABELS] || s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Topic</Label>
                <Input
                  value={addTopic}
                  onChange={(e) => setAddTopic(e.target.value)}
                  placeholder="e.g., Quadratic Equations"
                />
              </div>
              <div>
                <Label>Duration (minutes)</Label>
                <Select value={addDuration} onValueChange={setAddDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                <Button onClick={handleAddEntry}>Add Session</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
