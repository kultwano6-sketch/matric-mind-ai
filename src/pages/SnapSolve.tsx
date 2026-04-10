// SnapSolve.tsx — Simple & Direct
import { useState, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Camera, Upload, Image as ImageIcon, Sparkles, Loader2, 
  X, CheckCircle2, Copy, BookOpen, Lightbulb, ChevronRight
} from 'lucide-react';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import type { Database } from '@/integrations/supabase/types';
import ReactMarkdown from 'react-markdown';

type MatricSubject = Database['public']['Enums']['matric_subject'];

interface Solution {
  question: string;
  steps: string[];
  answer: string;
  explanation: string;
  tips: string[];
}

export default function SnapSolve() {
  const [selectedSubject, setSelectedSubject] = useState<MatricSubject>('mathematics');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [extractedText, setExtractedText] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload - just store the image
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
        setSolution(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setSolution(null);
    setError(null);
    setExtractedText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Simple solve - just call the API
  const solveQuestion = async () => {
    if (!imagePreview && !additionalContext.trim()) {
      setError('Upload or type a question first');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSolution(null);

    try {
      const response = await fetch('/api/ocr-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imagePreview || undefined,
          question: additionalContext.trim() || undefined,
          subject: selectedSubject,
          action: 'solve'
        })
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        if (data.ocr_text) setExtractedText(data.ocr_text);
      } else if (data.solution) {
        setSolution(data.solution);
        setExtractedText(data.cleaned_text || data.ocr_text || '');
      } else {
        setError('Could not solve. Try a clearer photo.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed. Try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Solve with edited text
  const solveWithText = async () => {
    if (!extractedText.trim()) return;
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/ocr-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extracted_text: extractedText,
          subject: selectedSubject,
          action: 'solve'
        })
      });

      const data = await response.json();
      if (data.solution) {
        setSolution(data.solution);
      } else {
        setError(data.error || 'Failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const copySolution = () => {
    if (solution) {
      const text = `Q: ${solution.question}\n\nSteps:\n${solution.steps.map((s, i) => `${i+1}. ${s}`).join('\n')}\n\nAnswer: ${solution.answer}`;
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-primary to-amber-500 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">SnapSolve</h1>
              <p className="text-sm text-muted-foreground">Take a photo, get the answer</p>
            </div>
          </div>
          <Select value={selectedSubject} onValueChange={(v) => setSelectedSubject(v as MatricSubject)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_SUBJECTS.map(s => (
                <SelectItem key={s} value={s}>
                  {SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Left - Image & Input */}
          <div className="space-y-4">
            {/* Image Upload */}
            <Card>
              <CardContent className="p-4">
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Question" className="w-full rounded-lg" />
                    <Button variant="destructive" size="icon" onClick={clearImage} className="absolute top-2 right-2">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50"
                  >
                    <ImageIcon className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Tap to upload photo</p>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Or type */}
            <Card>
              <CardContent className="p-4">
                <Textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Or type your question here..."
                  className="min-h-[80px]"
                />
              </CardContent>
            </Card>

            {/* Solve Button */}
            <Button 
              onClick={solveQuestion} 
              disabled={isProcessing || (!imagePreview && !additionalContext.trim())}
              className="w-full h-12 text-base bg-gradient-to-r from-primary to-amber-500"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
              {isProcessing ? 'Processing...' : 'Solve'}
            </Button>

            {error && <p className="text-destructive text-sm p-2 bg-destructive/10 rounded">{error}</p>}
          </div>

          {/* Right - Solution */}
          <div className="space-y-4">
            {solution ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        Solution
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={copySolution}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="font-medium">{solution.question}</p>
                    </div>
                    <div className="space-y-2">
                      {solution.steps.map((step, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs shrink-0">{i+1}</span>
                          <p className="text-sm">{step}</p>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 bg-green-500/10 rounded-lg">
                      <p className="font-medium text-green-600">Answer: {solution.answer}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {solution.tips?.map((tip, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 shrink-0" />{tip}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="h-64 flex items-center justify-center">
                <CardContent className="text-center">
                  <BookOpen className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Upload a photo to get started</p>
                </CardContent>
              </Card>
            )}

            {/* Edit Text Panel */}
            {extractedText && !solution && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Edit text & retry</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Textarea
                    value={extractedText}
                    onChange={(e) => setExtractedText(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <Button onClick={solveWithText} disabled={isProcessing} className="w-full">
                    Solve This
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}