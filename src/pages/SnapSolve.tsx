import { useState, useRef, useCallback, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Camera, Upload, Image as ImageIcon, Sparkles, Loader2, 
  X, ZoomIn, RotateCw, CheckCircle2, Copy, BookOpen,
  Lightbulb, ChevronRight, AlertCircle, History, RefreshCcw, Edit2, Eye,
  WifiOff, CloudOff
} from 'lucide-react';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import type { Database } from '@/integrations/supabase/types';
import { getNetworkStatus } from '@/hooks/useNetworkStatus';
import { preprocessImage, getQualityWarning, detectImageQuality } from '@/lib/imagePreprocessing';
import { robustAPICall } from '@/lib/robustAPI';
import { parseError } from '@/lib/errorHandler';
import { LoadingState, ErrorState, InlineStatus } from '@/components/StatusUI';

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
  confidence?: number;
}

// Calculate OCR confidence based on text quality
function calculateOCRConfidence(ocrText: string, cleanedText: string): number {
  if (!ocrText || ocrText.length < 10) return 0;
  
  let score = 50; // Base score
  
  // Length score (longer = more likely valid)
  if (cleanedText.length > 50) score += 20;
  else if (cleanedText.length > 20) score += 10;
  
  // Contains numbers (questions usually have numbers)
  if (/\d/.test(cleanedText)) score += 10;
  
  // Contains question-like patterns
  if (/question|\?|solve|find|calculate|determine/i.test(cleanedText)) score += 10;
  
  // Cleaned text is significantly shorter than OCR (meaningful extraction)
  const ratio = cleanedText.length / ocrText.length;
  if (ratio > 0.5) score += 10;
  
  return Math.min(100, score);
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
  const [showPipeline, setShowPipeline] = useState(false);
  
  // NEW: Enhanced state for robustness
  const [isOffline, setIsOffline] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [imageQuality, setImageQuality] = useState<{ quality: string; score: number } | null>(null);
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<string>('');
  const [lastAPIError, setLastAPIError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    setIsOffline(!getNetworkStatus());
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Enhanced image preprocessing with quality detection
  const processImageForOCR = useCallback(async (dataUrl: string): Promise<{ processed: string; quality: { quality: string; score: number } | null; warning: string | null }> => {
    try {
      // Run preprocessing
      const { result, quality } = await preprocessImage(dataUrl, {
        targetWidth: 1200,
        contrast: 1.2,
        brightness: 1.05,
        denoise: true,
        sharpen: true,
      });
      
      // Get quality warning
      const warning = quality ? getQualityWarning(quality) : null;
      
      return {
        processed: result,
        quality: quality ? { quality: quality.quality, score: quality.score } : null,
        warning,
      };
    } catch (err) {
      console.error('Image preprocessing error:', err);
      // Return original if preprocessing fails
      return {
        processed: dataUrl,
        quality: null,
        warning: null,
      };
    }
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
        
        // Process with enhanced preprocessing
        setProcessingProgress('Enhancing image...');
        const { processed, quality, warning } = await processImageForOCR(dataUrl);
        
        setImagePreview(processed);
        setSolution(null);
        setError(null);
        setQualityWarning(warning);
        setImageQuality(quality);
        setOcrResult(null);
        setProcessingProgress('');
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
        const compressed = await preprocessImage(dataUrl);
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
    // Check offline first
    if (!getNetworkStatus()) {
      setIsOffline(true);
      setError('You are offline. Please check your internet connection to use SnapSolve.');
      return;
    }

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
    setLastAPIError(null);
    setRetryCount(0);
    setProcessingProgress('Analyzing image...');

    const timeoutId = setTimeout(() => {
      if (isProcessing) {
        setIsProcessing(false);
        setError('Request timed out. Please try again.');
      }
    }, 90000); // Increased timeout

    try {
      // Use robust API call with automatic retry
      setProcessingProgress('Sending to AI...');
      const { data, error: apiError, retryCount: retries } = await robustAPICall('/api/ocr-pipeline', {
        image: imagePreview || undefined,
        question: additionalContext.trim() || undefined,
        subject: selectedSubject,
        action: 'solve'
      }, {
        maxRetries: 3,
        baseDelayMs: 1500,
        maxDelayMs: 15000,
        timeoutMs: 60000,
      });

      clearTimeout(timeoutId);
      setRetryCount(retries);

      if (apiError) {
        setLastAPIError(apiError);
        const parsed = parseError(apiError);
        
        // Handle low confidence specially
        if (parsed.code === 'OCR_LOW_CONFIDENCE' || parsed.code === 'OCR_FAILED') {
          setNeedsReview(true);
          if (data?.ocr_text) setExtractedText(data.ocr_text);
        }
        
        setError(apiError);
        setIsProcessing(false);
        return;
      }

      if (data?.needs_review || (!data?.solution && !data?.cleaned_text && !data?.ocr_text)) {
        setNeedsReview(true);
        setError(data?.error || '⚠️ Could not read the image clearly. Try again.');
        if (data?.ocr_text) setExtractedText(data.ocr_text);
        setIsProcessing(false);
        return;
      }

      if (data?.error && !data?.solution) {
        throw new Error(data.error);
      }

      // Calculate confidence score
      const confidence = calculateOCRConfidence(data.ocr_text || '', data.cleaned_text || '');
      const needsReviewConfidence = confidence < 60;

      setOcrResult({ ...data, confidence });
      setExtractedText(data.cleaned_text || data.ocr_text || '');
      setSolution(data.solution);
      setNeedsReview(needsReviewConfidence || data.needs_review || false);

      // Show quality warning if applicable
      if (needsReviewConfidence) {
        setError('⚠️ Low confidence in OCR. Please verify the extracted text below.');
      }

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
      const parsed = parseError(err);
      setError(parsed.userMessage);
      setLastAPIError(parsed.message);
      
      // If we got partial data, still show it
      if (data?.ocr_text) {
        setExtractedText(data.cleaned_text || data.ocr_text);
        setNeedsReview(true);
      }
    } finally {
      setIsProcessing(false);
      setProcessingProgress('');
    }
  };

  // Fix text with AI correction and solve
  const fixText = async () => {
    if (!extractedText.trim()) return;
    setIsProcessing(true);
    setError(null);
    setProcessingProgress('Correcting text...');

    try {
      const { data, error: apiError } = await robustAPICall('/api/ocr-pipeline', {
        extracted_text: extractedText,
        subject: selectedSubject,
        action: 'correct'
      }, { maxRetries: 2, timeoutMs: 30000 });

      if (apiError) {
        setError(apiError);
        setIsProcessing(false);
        return;
      }

      if (data?.corrected_text) {
        setExtractedText(data.corrected_text);
        setProcessingProgress('Solving...');
        
        // Now solve with corrected text
        const { data: solveData, error: solveError } = await robustAPICall('/api/ocr-pipeline', {
          extracted_text: data.corrected_text,
          subject: selectedSubject,
          action: 'solve'
        }, { maxRetries: 2, timeoutMs: 30000 });

        if (solveError) {
          setError(solveError);
          setIsProcessing(false);
          return;
        }

        if (solveData?.solution) {
          setSolution(solveData.solution);
          setNeedsReview(false);
          setError(null);
          // Add to history
          if (imagePreview) {
            setHistory(prev => [{
              id: `snap_${Date.now()}`,
              image: imagePreview,
              question: solveData.solution.question,
              solution: solveData.solution,
              timestamp: new Date()
            }, ...prev].slice(0, 20));
          }
        } else {
          setError(solveData?.error || 'Could not solve. Try editing the text manually.');
        }
      }
    } catch (err: any) {
      console.error('Fix text error:', err);
      setError(parseError(err).userMessage);
    } finally {
      setIsProcessing(false);
      setProcessingProgress('');
    }
  };

  // Solve with edited text (user has already edited, just solve)
  const solveWithEditedText = async () => {
    if (!extractedText.trim()) return;
    setIsProcessing(true);
    setError(null);
    setProcessingProgress('Solving...');

    try {
      const { data, error: apiError, retryCount } = await robustAPICall('/api/ocr-pipeline', {
        extracted_text: extractedText,
        subject: selectedSubject,
        action: 'solve'
      }, { maxRetries: 3, baseDelayMs: 1500, timeoutMs: 60000 });

      if (apiError) {
        setError(apiError);
        setIsProcessing(false);
        return;
      }

      if (data?.solution) {
        setSolution(data.solution);
        setNeedsReview(false);
        setError(null);
        
        // Add to history
        if (imagePreview) {
          setHistory(prev => [{
            id: `snap_${Date.now()}`,
            image: imagePreview,
            question: data.solution.question,
            solution: data.solution,
            timestamp: new Date()
          }, ...prev].slice(0, 20));
        }
      } else {
        // Even if no solution, don't fail silently - show the cleaned text
        setNeedsReview(false);
        setError(null);
        // Try to get explanation from what we have
        if (data?.cleaned_text || data?.ocr_text) {
          setExtractedText(data.cleaned_text || data.ocr_text);
          // Create a basic response structure
          setSolution({
            question: extractedText,
            steps: ['Text received - AI will process next'],
            answer: 'Processing...',
            explanation: 'Your question has been submitted. Please wait for the solution.',
            tips: ['Try submitting again if needed']
          });
        } else {
          setError(data?.error || 'Could not solve. Try a different image.');
        }
      }
    } catch (err: any) {
      console.error('Solve with edited text error:', err);
      setError(parseError(err).userMessage);
    } finally {
      setIsProcessing(false);
      setProcessingProgress('');
    }
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
        {/* Offline Banner */}
        {isOffline && (
          <div className="flex items-center gap-3 p-4 bg-amber-100 border border-amber-300 rounded-lg text-amber-800">
            <WifiOff className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm flex-1">
              You are currently offline. SnapSolve requires internet to process questions.
            </p>
          </div>
        )}

        {/* Processing Progress */}
        {(isProcessing && processingProgress) && (
          <InlineStatus type="loading" message={processingProgress} />
        )}

        {/* Quality Warning */}
        {qualityWarning && !isProcessing && (
          <InlineStatus type="warning" message={qualityWarning} />
        )}

        {/* Error with Retry Info */}
        {error && !isProcessing && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
            {retryCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Retried {retryCount} time{retryCount !== 1 ? 's' : ''} before success
              </p>
            )}
          </div>
        )}
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
                    {/* Quality Indicator */}
                    {imageQuality && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
                        <span className={
                          imageQuality.score >= 70 ? 'text-green-400' :
                          imageQuality.score >= 50 ? 'text-amber-400' :
                          'text-red-400'
                        }>
                          {imageQuality.score >= 70 ? '✓' : '⚠'} {imageQuality.score}%
                        </span>
                      </div>
                    )}
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
              disabled={isProcessing || isOffline || (!imagePreview && !additionalContext.trim())}
              className="w-full h-14 text-lg bg-gradient-to-r from-primary to-amber-600 hover:from-primary/90 hover:to-amber-600/90"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {processingProgress || 'Analyzing...'}
                </>
              ) : isOffline ? (
                <>
                  <CloudOff className="h-5 w-5 mr-2" />
                  Offline
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
            {/* Pipeline Toggle */}
            {ocrResult && (
              <Button variant="outline" size="sm" onClick={() => setShowPipeline(!showPipeline)} className="w-full">
                <Eye className="h-4 w-4 mr-2" />
                {showPipeline ? 'Hide' : 'Show'} OCR Pipeline
              </Button>
            )}

            {/* Pipeline Stages Display */}
            {showPipeline && ocrResult && (
              <Card className="glass-card border-blue-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">📸 → 🔍 → ✏️ → 🧠 Pipeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stage 1: Original Image */}
                  <div>
                    <h4 className="font-semibold text-sm text-blue-500 mb-2">1️⃣ Uploaded Image</h4>
                    <img src={imagePreview || ''} alt="Original" className="w-full rounded-lg border" />
                  </div>
                  
                  {/* Stage 2: Raw OCR */}
                  {ocrResult.ocr_text && (
                    <div>
                      <h4 className="font-semibold text-sm text-amber-500 mb-2">2️⃣ Raw OCR Text</h4>
                      <div className="p-3 rounded-lg bg-amber-500/10 text-sm font-mono whitespace-pre-wrap">{ocrResult.ocr_text}</div>
                    </div>
                  )}
                  
                  {/* Stage 3: Cleaned Text */}
                  {ocrResult.cleaned_text && ocrResult.cleaned_text !== ocrResult.ocr_text && (
                    <div>
                      <h4 className="font-semibold text-sm text-green-500 mb-2">3️⃣ AI Cleaned Text</h4>
                      <div className="p-3 rounded-lg bg-green-500/10 text-sm whitespace-pre-wrap">{ocrResult.cleaned_text}</div>
                    </div>
                  )}
                  
                  {/* Edit Button */}
                  <Button variant="outline" size="sm" onClick={() => { setExtractedText(ocrResult.cleaned_text || ocrResult.ocr_text); setNeedsReview(true); }} className="w-full">
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit & Retry
                  </Button>
                </CardContent>
              </Card>
            )}

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
