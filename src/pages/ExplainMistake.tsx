import { useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Lightbulb, Loader2, Send, Sparkles, BookOpen, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

export default function ExplainMistake() {
  const [selectedSubject, setSelectedSubject] = useState<MatricSubject | ''>('');
  const [question, setQuestion] = useState('');
  const [studentAnswer, setStudentAnswer] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildPrompt = useCallback(() => {
    const parts: string[] = [];

    parts.push(`You are a friendly, encouraging South African Matric tutor helping a student understand their mistake.`);
    parts.push(`Subject: ${selectedSubject ? SUBJECT_LABELS[selectedSubject as MatricSubject] : 'General'}`);
    parts.push(`\n**The Question:**\n${question}`);
    parts.push(`\n**What the student wrote:**\n${studentAnswer}`);

    if (correctAnswer.trim()) {
      parts.push(`\n**The correct answer:**\n${correctAnswer}`);
    }

    parts.push(`
Please respond with the following structure:

## 🔍 What Went Wrong
Identify the specific mistake(s) in the student's answer.

## 📚 Why It's Wrong
Explain the concept or reasoning behind why the answer is incorrect. Be clear and use simple language.

## ✅ Step-by-Step Solution
Show the correct approach step by step, with clear numbered steps.

## 💡 Tip for Next Time
Give one practical tip the student can use to avoid this mistake in future exams.

---
Keep your tone warm and encouraging. Remember this is a Matric student who may be stressed about exams. Use South African context where relevant.`);

    return parts.join('\n');
  }, [selectedSubject, question, studentAnswer, correctAnswer]);

  const handleSubmit = useCallback(async () => {
    if (!selectedSubject || !question.trim() || !studentAnswer.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse('');

    try {
      const promptText = buildPrompt();

      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: promptText }],
          subject: selectedSubject,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to get explanation. Please try again.');
      }

      // Handle streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let accumulated = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Parse SSE data lines
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'text-delta' && parsed.textDelta) {
                  accumulated += parsed.textDelta;
                  setResponse(accumulated);
                } else if (parsed.type === 'content' && parsed.content) {
                  accumulated += parsed.content;
                  setResponse(accumulated);
                }
              } catch {
                // If it's not JSON, treat as raw text
                if (data && data !== '') {
                  accumulated += data;
                  setResponse(accumulated);
                }
              }
            } else if (line.trim() && !line.startsWith(':')) {
              // Non-SSE format: try as raw text
              accumulated += line + '\n';
              setResponse(accumulated);
            }
          }
        }

        // If nothing was streamed, try reading the whole response as text
        if (!accumulated) {
          const text = await res.text();
          setResponse(text);
        }
      } else {
        const text = await res.text();
        setResponse(text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSubject, question, studentAnswer, buildPrompt]);

  const canSubmit = selectedSubject && question.trim() && studentAnswer.trim() && !isLoading;

  const handleReset = useCallback(() => {
    setQuestion('');
    setStudentAnswer('');
    setCorrectAnswer('');
    setResponse('');
    setError(null);
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Explain My Mistake</h1>
              <p className="text-sm text-muted-foreground">
                Paste your question and answer to get a step-by-step explanation
              </p>
            </div>
          </div>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Your Mistake
              </CardTitle>
              <CardDescription>
                Fill in the details below and the AI tutor will explain what went wrong
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Subject Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <Select value={selectedSubject} onValueChange={(v) => setSelectedSubject(v as MatricSubject)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a subject..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {ALL_SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          <span>{SUBJECT_ICONS[s]}</span>
                          <span>{SUBJECT_LABELS[s]}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Question */}
              <div className="space-y-2">
                <label className="text-sm font-medium">The Question</label>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Paste the exam or homework question here..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Student Answer */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Answer (what you wrote)</label>
                <Textarea
                  value={studentAnswer}
                  onChange={(e) => setStudentAnswer(e.target.value)}
                  placeholder="Paste your incorrect answer here..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Correct Answer (optional) */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  Correct Answer
                  <Badge variant="outline" className="text-[10px] font-normal">Optional</Badge>
                </label>
                <Textarea
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  placeholder="If you know the correct answer, paste it here for a more targeted explanation..."
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analysing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Explain My Mistake
                    </>
                  )}
                </Button>

                {(response || question || studentAnswer) && !isLoading && (
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    Clear & Start Over
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Loading Skeleton */}
        <AnimatePresence>
          {isLoading && !response && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6"
            >
              <Card>
                <CardContent className="py-6">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full gradient-gold flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-secondary-foreground animate-pulse" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
                      <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                      <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Response */}
        <AnimatePresence>
          {response && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-secondary-foreground" />
                    </div>
                    <CardTitle className="text-base">Explanation</CardTitle>
                    {selectedSubject && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <span>{SUBJECT_ICONS[selectedSubject]}</span>
                        {SUBJECT_LABELS[selectedSubject]}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:my-2">
                    <ReactMarkdown>{response}</ReactMarkdown>
                  </div>

                  {/* Action after response */}
                  <div className="flex items-center gap-3 mt-6 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleReset}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      Try Another Question
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
