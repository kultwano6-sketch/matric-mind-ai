import { useState, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle, Lightbulb, Loader2, Send, Sparkles, BookOpen, ArrowRight,
  Camera, Upload, X, ImageIcon
} from 'lucide-react';
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
  const [image, setImage] = useState<{ base64: string; name: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('Image too large. Max 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setImage({ base64, name: file.name });
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedSubject || (!question.trim() && !image)) return;

    setIsLoading(true);
    setError(null);
    setResponse('');

    try {
      // Build the prompt
      let promptText = `You are a friendly, encouraging South African Matric tutor helping a student understand their mistake.\n`;
      promptText += `Subject: ${selectedSubject ? SUBJECT_LABELS[selectedSubject as MatricSubject] : 'General'}\n`;

      if (image) {
        promptText += `\nThe student has uploaded an image of their work. I'll describe what I see in the image. Please analyse their answer and explain what went wrong.\n`;
      }

      if (question.trim()) {
        promptText += `\n**The Question:**\n${question}\n`;
      }

      if (studentAnswer.trim()) {
        promptText += `\n**What the student wrote:**\n${studentAnswer}\n`;
      }

      if (correctAnswer.trim()) {
        promptText += `\n**The correct answer:**\n${correctAnswer}\n`;
      }

      promptText += `\nPlease respond with the following structure:\n\n`;
      promptText += `## 🔍 What Went Wrong\nIdentify the specific mistake(s) in the student's answer.\n\n`;
      promptText += `## 📚 Why It's Wrong\nExplain the concept or reasoning behind why the answer is incorrect. Be clear and use simple language.\n\n`;
      promptText += `## ✅ Step-by-Step Solution\nShow the correct approach step by step, with clear numbered steps.\n\n`;
      promptText += `## 💡 Tip for Next Time\nGive one practical tip the student can use to avoid this mistake in future exams.\n\n`;
      promptText += `---\nKeep your tone warm and encouraging. Remember this is a Matric student who may be stressed about exams. Use South African context where relevant.`;

      // Build messages array
      const messages: Array<{ role: 'user'; content: string; experimental_attachments?: Array<{ name: string; contentType: string; url: string }> }> = [];

      if (image) {
        // Send image as base64 data URL
        messages.push({
          role: 'user',
          content: promptText,
          experimental_attachments: [{
            name: image.name,
            contentType: 'image/png',
            url: `data:image/png;base64,${image.base64}`,
          }],
        });
      } else {
        messages.push({
          role: 'user',
          content: promptText,
        });
      }

      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          subject: selectedSubject,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to get explanation. Please try again.');
      }

      const data = await res.json();
      setResponse(data.text || 'No explanation received.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSubject, question, studentAnswer, correctAnswer, image]);

  const canSubmit = selectedSubject && (question.trim() || image) && !isLoading;

  const handleReset = useCallback(() => {
    setQuestion('');
    setStudentAnswer('');
    setCorrectAnswer('');
    setResponse('');
    setError(null);
    setImage(null);
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Explain My Mistake</h1>
              <p className="text-sm text-muted-foreground">
                Upload a photo or type your question to get a step-by-step explanation
              </p>
            </div>
          </div>
        </motion.div>

        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Your Mistake
              </CardTitle>
              <CardDescription>
                Upload a photo of your work or type the details below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image Upload Section */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Upload or Take a Photo</label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cameraInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Take Photo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Image
                  </Button>
                </div>

                {/* Image Preview */}
                {image && (
                  <div className="relative inline-block mt-2">
                    <img
                      src={`data:image/png;base64,${image.base64}`}
                      alt="Uploaded work"
                      className="max-w-xs max-h-48 rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
                      onClick={() => setImage(null)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">{image.name}</p>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or type it out</span>
                <div className="flex-1 h-px bg-border" />
              </div>

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
                <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
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

                {(response || question || studentAnswer || image) && !isLoading && (
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
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6">
              <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
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
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
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
                  <div className="flex items-center gap-3 mt-6 pt-4 border-t">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleReset}>
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
