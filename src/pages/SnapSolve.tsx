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
  Lightbulb, ChevronRight, AlertCircle
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

export default function SnapSolve() {
  const [selectedSubject, setSelectedSubject] = useState<MatricSubject>('mathematics');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size must be less than 10MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
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

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setImagePreview(dataUrl);
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
    if (!imagePreview) {
      setError('Please upload or capture an image first');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSolution(null);

    // Timeout after 45 seconds
    const timeoutId = setTimeout(() => {
      if (isProcessing) {
        setIsProcessing(false);
        setError('Request timed out. Please try again.');
      }
    }, 45000);

    try {
      const response = await fetch('/api/snapsolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: "Solve this problem",
          subject: selectedSubject,
          context: additionalContext
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to process image');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || data.error);
      }
      
      setSolution(data.solution);
    } catch (err: any) {
      console.error('SnapSolve error:', err);
      setError(err.message || 'Failed to solve. Please try again with a clearer image.');
    } finally {
      setIsProcessing(false);
    }
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
                <CardTitle className="text-base">Additional Context (Optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Add any additional context or specify which part of the question you need help with..."
                  className="min-h-[80px] bg-background/50"
                />
              </CardContent>
            </Card>

            {/* Solve Button */}
            <Button
              onClick={solveQuestion}
              disabled={!imagePreview || isProcessing}
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
