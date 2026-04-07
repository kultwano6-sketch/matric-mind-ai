// ============================================================
// Matric Mind AI - Teacher Assistant Panel
// AI-powered lesson planning, worksheets, quizzes for teachers
// ============================================================
import { useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, BookOpen, FileText, ClipboardList, RefreshCw } from 'lucide-react';

const SUBJECTS = [
  'Mathematics', 'Physical Sciences', 'Life Sciences', 'English', 'Accounting',
  'Geography', 'History', 'Economics', 'Business Studies'
];

export default function TeacherAssistant() {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'lesson_plan' | 'worksheet' | 'quiz'>('lesson_plan');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [generated, setGenerated] = useState<any>(null);

  async function handleGenerate() {
    if (!subject || !topic) return;
    setLoading(true);
    try {
      const response = await fetch('/api/teacher-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, subject, topic, grade: 12 }),
      });
      const data = await response.json();
      setGenerated(data.generated_content);
    } catch (error) {
      console.error('Error generating content:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/10 to-cyan-500/20 p-6">
          <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">Teacher Assistant</h1>
          <p className="text-muted-foreground mt-1">AI-powered content generation for your classes</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Input Panel */}
          <Card className="md:col-span-1 border-2 border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Generate Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Content Type</label>
                <Tabs value={action} onValueChange={(v) => setAction(v as any)} className="mt-2">
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="lesson_plan" className="text-xs"><BookOpen className="w-4 h-4 mr-1" />Plan</TabsTrigger>
                    <TabsTrigger value="worksheet" className="text-xs"><FileText className="w-4 h-4 mr-1" />Worksheet</TabsTrigger>
                    <TabsTrigger value="quiz" className="text-xs"><ClipboardList className="w-4 h-4 mr-1" />Quiz</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div>
                <label className="text-sm font-medium">Subject</label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Topic</label>
                <Input placeholder="e.g. Quadratic Equations" value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1" />
              </div>

              <Button onClick={handleGenerate} disabled={loading || !subject || !topic} className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <>Generate <RefreshCw className="w-4 h-4 ml-2" /></>}
              </Button>
            </CardContent>
          </Card>

          {/* Output Panel */}
          <Card className="md:col-span-2 border-2 border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>{action === 'lesson_plan' ? 'Lesson Plan' : action === 'worksheet' ? 'Worksheet' : 'Quiz'}</CardTitle>
              <CardDescription>AI-generated content ready for class</CardDescription>
            </CardHeader>
            <CardContent>
              {generated ? (
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-xs bg-muted p-4 rounded-xl overflow-auto max-h-96">
                    {JSON.stringify(generated, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select content type, subject, and topic to generate</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}