import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Calendar, Clock, Target, Plus, Trash2, BookOpen, 
  TrendingUp, CheckCircle2, AlertCircle, Sparkles, 
  ChevronRight, Play, Pause, RotateCcw
} from 'lucide-react';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

interface StudyTask {
  id: string;
  subject: MatricSubject;
  topic: string;
  duration: number; // minutes
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  scheduledDate: string;
}

interface StudyGoal {
  subject: MatricSubject;
  targetGrade: number;
  currentGrade: number;
  hoursPerWeek: number;
  examDate: string;
}

export default function StudyPlanner() {
  const [tasks, setTasks] = useState<StudyTask[]>(() => {
    const saved = localStorage.getItem('studyTasks');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [goals, setGoals] = useState<StudyGoal[]>(() => {
    const saved = localStorage.getItem('studyGoals');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Pomodoro Timer
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerMode, setTimerMode] = useState<'focus' | 'break'>('focus');
  
  // New task form
  const [newTask, setNewTask] = useState({
    subject: '' as MatricSubject,
    topic: '',
    duration: 30,
    priority: 'medium' as const,
    scheduledDate: selectedDate
  });
  
  // New goal form
  const [newGoal, setNewGoal] = useState({
    subject: '' as MatricSubject,
    targetGrade: 70,
    currentGrade: 50,
    hoursPerWeek: 5,
    examDate: ''
  });
  
  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('studyTasks', JSON.stringify(tasks));
  }, [tasks]);
  
  useEffect(() => {
    localStorage.setItem('studyGoals', JSON.stringify(goals));
  }, [goals]);
  
  // Pomodoro timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(s => s - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setTimerActive(false);
      if (timerMode === 'focus') {
        setTimerMode('break');
        setTimerSeconds(5 * 60);
      } else {
        setTimerMode('focus');
        setTimerSeconds(25 * 60);
      }
    }
    return () => clearInterval(interval);
  }, [timerActive, timerSeconds, timerMode]);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const addTask = () => {
    if (!newTask.subject || !newTask.topic) return;
    
    const task: StudyTask = {
      id: Date.now().toString(),
      ...newTask,
      completed: false
    };
    setTasks([...tasks, task]);
    setNewTask({
      subject: '' as MatricSubject,
      topic: '',
      duration: 30,
      priority: 'medium',
      scheduledDate: selectedDate
    });
    setShowAddTask(false);
  };
  
  const addGoal = () => {
    if (!newGoal.subject || !newGoal.examDate) return;
    
    setGoals([...goals, newGoal]);
    setNewGoal({
      subject: '' as MatricSubject,
      targetGrade: 70,
      currentGrade: 50,
      hoursPerWeek: 5,
      examDate: ''
    });
    setShowAddGoal(false);
  };
  
  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };
  
  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };
  
  const deleteGoal = (subject: MatricSubject) => {
    setGoals(goals.filter(g => g.subject !== subject));
  };
  
  const todaysTasks = tasks.filter(t => t.scheduledDate === selectedDate);
  const completedToday = todaysTasks.filter(t => t.completed).length;
  const totalMinutesToday = todaysTasks.reduce((sum, t) => sum + t.duration, 0);
  const completedMinutesToday = todaysTasks.filter(t => t.completed).reduce((sum, t) => sum + t.duration, 0);
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-muted';
    }
  };
  
  const getDaysUntilExam = (examDate: string) => {
    const days = Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
              Study Planner
            </h1>
            <p className="text-muted-foreground mt-1">
              Plan your study sessions and track your progress towards your goals
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowAddGoal(true)} variant="outline" className="gap-2">
              <Target className="h-4 w-4" />
              Add Goal
            </Button>
            <Button onClick={() => setShowAddTask(true)} className="gap-2 bg-gradient-to-r from-primary to-amber-600 hover:from-primary/90 hover:to-amber-600/90">
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedToday}/{todaysTasks.length}</p>
                  <p className="text-xs text-muted-foreground">Tasks Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass-card border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{Math.round(completedMinutesToday / 60 * 10) / 10}h</p>
                  <p className="text-xs text-muted-foreground">of {Math.round(totalMinutesToday / 60 * 10) / 10}h planned</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass-card border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{goals.length}</p>
                  <p className="text-xs text-muted-foreground">Active Goals</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass-card border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <BookOpen className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tasks.filter(t => t.completed).length}</p>
                  <p className="text-xs text-muted-foreground">Total Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Date Selector & Tasks */}
            <Card className="glass-card border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <CardTitle>Daily Schedule</CardTitle>
                  </div>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
                <CardDescription>
                  {todaysTasks.length > 0 
                    ? `${todaysTasks.length} tasks scheduled for this day`
                    : 'No tasks scheduled for this day'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {todaysTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No tasks scheduled for this day</p>
                    <Button variant="link" onClick={() => setShowAddTask(true)} className="mt-2">
                      Add your first task
                    </Button>
                  </div>
                ) : (
                  todaysTasks.map(task => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                        task.completed 
                          ? 'bg-green-500/10 border-green-500/20' 
                          : 'bg-card/50 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={() => toggleTask(task.id)}
                        className="h-5 w-5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{SUBJECT_ICONS[task.subject]}</span>
                          <span className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {task.topic}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{SUBJECT_LABELS[task.subject]}</span>
                          <span>-</span>
                          <span>{task.duration} min</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTask(task.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Study Goals */}
            <Card className="glass-card border-white/10">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-amber-500" />
                  <CardTitle>Study Goals</CardTitle>
                </div>
                <CardDescription>Track your progress towards exam targets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {goals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No goals set yet</p>
                    <Button variant="link" onClick={() => setShowAddGoal(true)} className="mt-2">
                      Set your first goal
                    </Button>
                  </div>
                ) : (
                  goals.map(goal => {
                    const daysLeft = getDaysUntilExam(goal.examDate);
                    const progressPercent = Math.min(100, (goal.currentGrade / goal.targetGrade) * 100);
                    
                    return (
                      <div key={goal.subject} className="p-4 rounded-lg bg-card/50 border border-white/10">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{SUBJECT_ICONS[goal.subject]}</span>
                            <div>
                              <h4 className="font-semibold">{SUBJECT_LABELS[goal.subject]}</h4>
                              <p className="text-sm text-muted-foreground">
                                {goal.hoursPerWeek}h/week - {daysLeft} days until exam
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteGoal(goal.subject)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Current: {goal.currentGrade}%</span>
                            <span>Target: {goal.targetGrade}%</span>
                          </div>
                          <Progress value={progressPercent} className="h-2" />
                        </div>
                        {daysLeft < 30 && (
                          <div className="flex items-center gap-2 mt-3 text-amber-500 text-sm">
                            <AlertCircle className="h-4 w-4" />
                            <span>Exam approaching! Focus on this subject.</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pomodoro Timer */}
            <Card className="glass-card border-white/10 overflow-hidden">
              <div className={`p-6 text-center ${timerMode === 'focus' ? 'bg-gradient-to-br from-primary/20 to-primary/5' : 'bg-gradient-to-br from-green-500/20 to-green-500/5'}`}>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Pomodoro Timer</h3>
                </div>
                <Badge variant="outline" className={`mb-4 ${timerMode === 'focus' ? 'border-primary text-primary' : 'border-green-500 text-green-500'}`}>
                  {timerMode === 'focus' ? 'Focus Time' : 'Break Time'}
                </Badge>
                <div className="text-5xl font-mono font-bold mb-6">
                  {formatTime(timerSeconds)}
                </div>
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setTimerActive(false);
                      setTimerMode('focus');
                      setTimerSeconds(25 * 60);
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => setTimerActive(!timerActive)}
                    className={`px-8 ${timerActive ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-r from-primary to-amber-600'}`}
                  >
                    {timerActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Quick Tips */}
            <Card className="glass-card border-white/10">
              <CardHeader>
                <CardTitle className="text-lg">Study Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  'Break study sessions into 25-minute focused blocks',
                  'Review difficult topics first when your mind is fresh',
                  'Take short breaks to maintain concentration',
                  'Use active recall instead of passive reading',
                  'Get enough sleep before exams'
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{tip}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Add Task Modal */}
        {showAddTask && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md glass-card border-white/10">
              <CardHeader>
                <CardTitle>Add Study Task</CardTitle>
                <CardDescription>Schedule a new study session</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={newTask.subject} onValueChange={(v) => setNewTask({ ...newTask, subject: v as MatricSubject })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_SUBJECTS.map(subject => (
                        <SelectItem key={subject} value={subject}>
                          {SUBJECT_ICONS[subject]} {SUBJECT_LABELS[subject]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Topic / Description</Label>
                  <Input
                    value={newTask.topic}
                    onChange={(e) => setNewTask({ ...newTask, topic: e.target.value })}
                    placeholder="e.g., Chapter 5: Trigonometry"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input
                      type="number"
                      value={newTask.duration}
                      onChange={(e) => setNewTask({ ...newTask, duration: parseInt(e.target.value) || 30 })}
                      min={5}
                      max={180}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v as 'high' | 'medium' | 'low' })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Schedule Date</Label>
                  <Input
                    type="date"
                    value={newTask.scheduledDate}
                    onChange={(e) => setNewTask({ ...newTask, scheduledDate: e.target.value })}
                  />
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowAddTask(false)}>Cancel</Button>
                  <Button onClick={addTask} className="bg-gradient-to-r from-primary to-amber-600">Add Task</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Goal Modal */}
        {showAddGoal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md glass-card border-white/10">
              <CardHeader>
                <CardTitle>Set Study Goal</CardTitle>
                <CardDescription>Define your target for a subject</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={newGoal.subject} onValueChange={(v) => setNewGoal({ ...newGoal, subject: v as MatricSubject })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_SUBJECTS.filter(s => !goals.find(g => g.subject === s)).map(subject => (
                        <SelectItem key={subject} value={subject}>
                          {SUBJECT_ICONS[subject]} {SUBJECT_LABELS[subject]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Current Grade (%)</Label>
                    <Input
                      type="number"
                      value={newGoal.currentGrade}
                      onChange={(e) => setNewGoal({ ...newGoal, currentGrade: parseInt(e.target.value) || 0 })}
                      min={0}
                      max={100}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Target Grade (%)</Label>
                    <Input
                      type="number"
                      value={newGoal.targetGrade}
                      onChange={(e) => setNewGoal({ ...newGoal, targetGrade: parseInt(e.target.value) || 0 })}
                      min={0}
                      max={100}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hours per Week</Label>
                    <Input
                      type="number"
                      value={newGoal.hoursPerWeek}
                      onChange={(e) => setNewGoal({ ...newGoal, hoursPerWeek: parseInt(e.target.value) || 1 })}
                      min={1}
                      max={40}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Exam Date</Label>
                    <Input
                      type="date"
                      value={newGoal.examDate}
                      onChange={(e) => setNewGoal({ ...newGoal, examDate: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowAddGoal(false)}>Cancel</Button>
                  <Button onClick={addGoal} className="bg-gradient-to-r from-primary to-amber-600">Set Goal</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
