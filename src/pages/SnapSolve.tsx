import { useState, useRef, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Camera, Upload, Image as ImageIcon, Sparkles, Loader2, 
  X, ZoomIn, RotateCw, CheckCircle2, Copy, BookOpen,
  Lightbulb, ChevronRight, AlertCircle, History, RefreshCcw, Edit2
} from 'lucide-react';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

interface Solution {
  question: string;
  steps: string[];
  answer: string;
  explanation: string;
  tips: string[];
}

interface HistoryItem {
  id: string;
  image: string;
  question: string;
  solution: Solution;
  timestamp: Date;
}

interface OCRResult {
  ocr_text: string;
  cleaned_text: string;
  solution: Solution;
}

export default function SnapSolve() {
  const [selectedSubject, setSelectedSubject] = useState<MatricSubject>('mathematics');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [simplifiedExplanation, setSimplifiedExplanation] = useState<string | null>(null);
  const [similarProblems, setSimilarProblems] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Compress image before sending
  const compressImage = useCallback((dataUrl: string, maxWidth = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    });
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size must be less than 10MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        const compressed = await compressImage(dataUrl);
        setImagePreview(compressed);
        setSolution(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
      setError(null);
    } catch {
      setError('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }, []);

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const compressed = await compressImage(dataUrl);
        setImagePreview(compressed);
        setSolution(null);
        stopCamera();
      }
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setSolution(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const solveQuestion = async () => {
    if (!imagePreview && !additionalContext.trim()) {
      setError('Please upload or capture an image first');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSolution(null);
    setSimplifiedExplanation(null);
    setSimilarProblems(null);
    setNeedsReview(false);
    setOcrResult(null);

    const timeoutId = setTimeout(() => {
      if (isProcessing) {
        setIsProcessing(false);
        setError('Request timed out. Please try again.');
      }
    }, 60000);

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

      clearTimeout(timeoutId);
      const data = await response.json();

      if (data.needs_review || (data.error && !data.solution)) {
        setNeedsReview(true);
        setError(data.error || '⚠️ Could not read the image clearly. Try again.');
        if (data.ocr_text) setExtractedText(data.ocr_text);
        return;
      }

      if (data.error && !data.solution) {
        throw new Error(data.error);
      }

      setOcrResult(data);
      setExtractedText(data.cleaned_text || data.ocr_text || '');
      setSolution(data.solution);

      if (data.solution && imagePreview) {
        setHistory(prev => [{
          id: `snap_${Date.now()}`,
          image: imagePreview,
          question: data.solution.question,
          solution: data.solution,
          timestamp: new Date()
        }, ...prev].slice(0, 20));
      }
    } catch (err: any) {
      console.error('SnapSolve error:', err);
      setError(err.message || 'Failed to solve. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Fix text with AI correction
  const fixText = async () => {
    if (!extractedText.trim()) return;
    setIsProcessing(true);
    try {
      const response = await fetch('/api/ocr-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extracted_text: extractedText, subject: selectedSubject, action: 'correct' })
      });
      const data = await response.json();
      if (data.corrected_text) {
        setExtractedText(data.corrected_text);
        const solveResponse = await fetch('/api/ocr-pipeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ extracted_text: data.corrected_text, subject: selectedSubject, action: 'solve' })
        });
        const solveData = await solveResponse.json();
        if (solveData.solution) {
          setSolution(solveData.solution);
          setNeedsReview(false);
        }
      }
    } catch (err) { setError('Failed to fix text'); }
    finally { setIsProcessing(false); }
  };

  // Solve with edited text
  const solveWithEditedText = async () => {
    if (!extractedText.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const response = await fetch('/api/ocr-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extracted_text: extractedText, subject: selectedSubject, action: 'solve' })
      });
      const data = await response.json();
      if (data.solution) {
        setSolution(data.solution);
        setNeedsReview(false);
        setHistory(prev => [{ id: `snap_${Date.now()}`, image: imagePreview || '', question: data.solution.question, solution: data.solution, timestamp: new Date() }, ...prev].slice(0, 20));
      } else if (data.error) { setError(data.error); }
    } catch (err) { setError('Failed to solve'); }
    finally { setIsProcessing(false); }
  };

  // Simplify
  const explainSimpler = async () => {
    if (!solution?.question) return;
    setIsProcessing(true);
    try {
      const response = await fetch('/api/ocr-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: solution.question, subject: selectedSubject, action: 'simplify' })
      });
      const data = await response.json();
      setSimplifiedExplanation(data.reply || '⚠️ Could not simplify');
    } catch (err) { setSimplifiedExplanation('⚠️ Failed'); }
    finally { setIsProcessing(false); }
  };

  // Similar
  const getSimilarProblems = async () => {
    if (!solution?.question) return;
    setIsProcessing(true);
    try {
      const response = await fetch('/api/ocr-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: solution.question, subject: selectedSubject, action: 'similar' })
      });
      const data = await response.json();
      setSimilarProblems(data.reply || '⚠️ Could not generate');
    } catch (err) { setSimilarProblems('⚠️ Failed'); }
    finally { setIsProcessing(false); }
  };

  // Follow-up
  const askFollowUp = async () => {
    if (!followUpQuestion.trim() || !solution?.question) return;
    setIsProcessing(true);
    try {
      const response = await fetch('/api/ocr-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: solution.question, subject: selectedSubject, followup: followUpQuestion, action: 'followup' })
      });
      const data = await response.json();
      setSolution(prev => prev ? { ...prev, explanation: prev.explanation + '\n\n--- Follow-up ---\n' + (data.reply || '') } : null);
      setFollowUpQuestion('');
    } catch (err) { setError('Failed to get answer'); }
    finally { setIsProcessing(false); }
  };

  const copySolution = () => {
    if (solution) {
      const text = `Question: ${solution.question}\n\nSteps:\n${solution.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nAnswer: ${solution.answer}\n\nExplanation: ${solution.explanation}`;
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl gradient-gold flex items-center justify-center shadow-lg">
              <Camera className="w-6 h-6 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">SnapSolve</h1>
              <p className="text-sm text-muted-foreground">Take a photo of any question</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary w-fit">
            <Sparkles className="h-3 w-3 mr-1" />
            AI Powered
          </Badge>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Panel - Image Input */}
          <div className="space-y-4">
            {/* Subject Selection */}
            <Card className="glass-card border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Subject</label>
                    <Select value={selectedSubject} onValueChange={(v) => setSelectedSubject(v as MatricSubject)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_SUBJECTS.map(subject => (
                          <SelectItem key={subject} value={subject}>
                            <span className="flex items-center gap-2">
                              <span>{SUBJECT_ICONS[subject]}</span>
                              <span>{SUBJECT_LABELS[subject]}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Badge variant="outline" className="h-fit bg-primary/10 border-primary/30 text-primary">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Powered
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Image Upload Area */}
            <Card className="glass-card border-white/10 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" />
                  Capture Question
                </CardTitle>
                <CardDescription>
                  Upload or take a photo of your question
                </CardDescription>
              </CardHeader>
              <CardContent>
                {showCamera ? (
                  <div className="relative rounded-lg overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full aspect-[4/3] object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={stopCamera}
                        className="bg-black/50 border-white/20"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                      <Button
                        size="lg"
                        onClick={capturePhoto}
                        className="bg-primary hover:bg-primary/90 rounded-full w-16 h-16"
                      >
                        <Camera className="h-8 w-8" />
                      </Button>
                    </div>
                  </div>
                ) : imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Question preview"
                      className="w-full rounded-lg border border-white/10"
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {/* zoom logic */}}
                        className="bg-black/50 border-white/20"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={clearImage}
                        className="bg-black/50 border-white/20"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">
                      Drag and drop an image here, or click to browse
                    </p>
                    <div className="flex justify-center gap-4">
                      <Button variant="outline" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                      <Button onClick={(e) => { e.stopPropagation(); startCamera(); }}>
                        <Camera className="h-4 w-4 mr-2" />
                        Camera
                      </Button>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </CardContent>
            </Card>

            {/* Additional Context */}
            <Card className="glass-card border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Or type your question here</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Type your math problem, equation, or question here..."
                  className="min-h-[80px] bg-background/50"
                />
              </CardContent>
            </Card>

            {/* OCR Review Panel */}
            {needsReview && (
              <Card className="glass-card border-amber-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Review Extracted Text
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">We couldn't read the image clearly. Please edit or try a clearer photo.</p>
                  <Textarea
                    value={extractedText}
                    onChange={(e) => setExtractedText(e.target.value)}
                    placeholder="Edit the extracted text here..."
                    className="min-h-[100px] bg-background/50"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={fixText} disabled={isProcessing}>
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Fix Text
                    </Button>
                    <Button onClick={solveWithEditedText} disabled={isProcessing}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Solve This
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* OCR Result Display */}
            {ocrResult && !needsReview && (
              <Card className="glass-card border-blue-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-blue-500" />
                    Detected Question
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-3 rounded-lg bg-blue-500/10 text-sm">{ocrResult.cleaned_text || ocrResult.ocr_text}</div>
                  <Button variant="ghost" size="sm" onClick={() => setExtractedText(ocrResult.cleaned_text || '')} className="mt-2">
                    <Edit2 className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Solve Button */}
            <Button
              onClick={solveQuestion}
              disabled={isProcessing || (!imagePreview && !additionalContext.trim())}
              className="w-full h-14 text-lg bg-gradient-to-r from-primary to-amber-600 hover:from-primary/90 hover:to-amber-600/90"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Solve Question
                </>
              )}
            </Button>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>

          {/* Right Panel - Solution */}
          <div className="space-y-4">
            {solution ? (
              <>
                {/* Solution Card */}
                <Card className="glass-card border-white/10">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        Solution
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={copySolution}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Question */}
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-2">QUESTION</h4>
                      <p className="text-foreground">{solution.question}</p>
                    </div>

                    {/* Steps */}
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3">STEP-BY-STEP SOLUTION</h4>
                      <div className="space-y-3">
                        {solution.steps.map((step, index) => (
                          <div key={index} className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </div>
                            <p className="text-foreground pt-0.5">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Answer */}
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <h4 className="font-semibold text-sm text-green-500 mb-2">ANSWER</h4>
                      <p className="text-foreground font-medium">{solution.answer}</p>
                    </div>

                    {/* Explanation */}
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-2">EXPLANATION</h4>
                      <p className="text-muted-foreground">{solution.explanation}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Tips Card */}
                <Card className="glass-card border-white/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      Study Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {solution.tips.map((tip, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </>
            ) : (
              /* Placeholder when no solution */
              <Card className="glass-card border-white/10 h-full min-h-[400px] flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">Ready to Help</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Upload or capture a photo of your question and click "Solve Question" to get a detailed AI-powered solution.
                  </p>
                  <div className="mt-6 grid grid-cols-1 gap-3 text-left max-w-xs mx-auto">
                    {[
                      'Clear photo of the question',
                      'Select the correct subject',
                      'Include all parts of the problem'
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        {item}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
