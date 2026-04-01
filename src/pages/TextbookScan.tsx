// ============================================================
// Matric Mind AI - Textbook Scan Page
// OCR-based textbook scanning and content extraction
// ============================================================

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Camera, Upload, Scan, FileText, BookOpen, FlaskConical,
  Calculator, Brain, Play, History, X, RefreshCw, CheckCircle2,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { ALL_SUBJECTS, SUBJECT_LABELS } from '@/lib/subjects';
import {
  scanTextbook,
  fileToBase64,
  getScanHistory,
  suggestTopics,
  formatFormulas,
  type TextbookScan,
  type ScanResult,
} from '@/services/textbookScan';

const SUBJECT_ICONS: Record<string, string> = {
  mathematics: '📐',
  physical_sciences: '⚛️',
  life_sciences: '🧬',
  accounting: '📊',
  business_studies: '💼',
  economics: '📈',
  english_home_language: '📖',
  history: '📜',
  geography: '🌍',
};

export default function TextbookScanPage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [chapterHint, setChapterHint] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [history, setHistory] = useState<TextbookScan[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('scan');
  const [selectedHeading, setSelectedHeading] = useState<string | null>(null);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be less than 10MB');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Handle scan
  const handleScan = async () => {
    if (!imageFile || !subject || !user?.id) return;

    setScanning(true);
    setScanResult(null);

    try {
      const base64 = await fileToBase64(imageFile);
      const response = await scanTextbook(base64, subject, chapterHint || undefined);

      if (response.success) {
        setScanResult(response.result);
        setScanId(response.scan_id);
      }
    } catch (error) {
      console.error('Scan failed:', error);
      alert('Failed to scan textbook page. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  // Load scan history
  const loadHistory = async () => {
    if (!user?.id) return;

    setLoadingHistory(true);
    try {
      const scans = await getScanHistory(user.id);
      setHistory(scans);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load history when tab changes
  React.useEffect(() => {
    if (activeTab === 'history' && history.length === 0) {
      loadHistory();
    }
  }, [activeTab]);

  // Clear current scan
  const handleClear = () => {
    setImageFile(null);
    setImagePreview(null);
    setScanResult(null);
    setScanId(null);
    setChapterHint('');
  };

  // Load a scan from history
  const handleLoadScan = (scan: TextbookScan) => {
    setScanResult(scan.chapters_detected);
    setScanId(scan.id);
    setSubject(scan.subject);
    setActiveTab('scan');
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold">Textbook Scanner</h1>
          <p className="text-muted-foreground mt-1">
            Scan textbook pages to extract key concepts, formulas, and practice questions
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="scan">
              <Scan className="w-4 h-4 mr-1" /> Scan
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-1" /> History
            </TabsTrigger>
          </TabsList>

          {/* Scan Tab */}
          <TabsContent value="scan" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upload Area */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="w-5 h-5" /> Upload Textbook Page
                  </CardTitle>
                  <CardDescription>
                    Take a photo or upload an image of your textbook page
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Subject Selection */}
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select value={subject} onValueChange={setSubject}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_SUBJECTS.map(s => (
                          <SelectItem key={s} value={s}>
                            {SUBJECT_ICONS[s]} {SUBJECT_LABELS[s as keyof typeof SUBJECT_LABELS] || s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Chapter Hint */}
                  <div className="space-y-2">
                    <Label>Chapter hint (optional)</Label>
                    <Input
                      placeholder="e.g., Chapter 5: Trigonometry"
                      value={chapterHint}
                      onChange={(e) => setChapterHint(e.target.value)}
                    />
                  </div>

                  {/* Image Upload */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      imagePreview ? 'border-primary' : 'border-muted-foreground/25 hover:border-primary/50'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  >
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Textbook page"
                          className="max-h-64 mx-auto rounded-lg"
                        />
                        <button
                          className="absolute top-0 right-0 bg-destructive text-white rounded-full p-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClear();
                          }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-10 h-10 mx-auto text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          Click or drag to upload
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          JPG, PNG up to 10MB
                        </p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>

                  {/* Scan Button */}
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={!imageFile || !subject || scanning}
                    onClick={handleScan}
                  >
                    {scanning ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Scan className="w-4 h-4 mr-2" />
                    )}
                    {scanning ? 'Scanning...' : 'Scan Page'}
                  </Button>
                </CardContent>
              </Card>

              {/* Results Area */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Scan Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AnimatePresence mode="wait">
                    {scanResult ? (
                      <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-4"
                      >
                        {/* Chapter */}
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <h3 className="font-semibold">{scanResult.chapter}</h3>
                        </div>

                        {/* Headings */}
                        {scanResult.headings.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground mb-2 block">
                              Headings ({scanResult.headings.length})
                            </Label>
                            <div className="space-y-1">
                              {scanResult.headings.map((heading, idx) => (
                                <motion.div
                                  key={idx}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.05 }}
                                  className={`text-sm p-2 rounded cursor-pointer transition-colors ${
                                    selectedHeading === heading
                                      ? 'bg-primary/10 text-primary'
                                      : 'hover:bg-muted'
                                  }`}
                                  onClick={() => setSelectedHeading(
                                    selectedHeading === heading ? null : heading
                                  )}
                                >
                                  {heading}
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Key Concepts */}
                        {scanResult.key_concepts.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground mb-2 block">
                              Key Concepts
                            </Label>
                            <div className="flex flex-wrap gap-1">
                              {scanResult.key_concepts.map((concept, idx) => (
                                <motion.div
                                  key={idx}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: idx * 0.03 }}
                                >
                                  <Badge variant="secondary" className="text-xs">
                                    {concept}
                                  </Badge>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Formulas */}
                        {scanResult.formulas.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
                              <Calculator className="w-3 h-3" /> Formulas
                            </Label>
                            <div className="space-y-1">
                              {formatFormulas(scanResult.formulas).map((formula, idx) => (
                                <motion.div
                                  key={idx}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: idx * 0.1 }}
                                  className="bg-muted p-2 rounded font-mono text-sm"
                                >
                                  {formula}
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Questions */}
                        {scanResult.questions.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
                              <Brain className="w-3 h-3" /> Practice Questions ({scanResult.questions.length})
                            </Label>
                            <div className="space-y-2">
                              {scanResult.questions.map((question, idx) => (
                                <motion.div
                                  key={idx}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: idx * 0.1 }}
                                  className="bg-muted p-3 rounded-lg text-sm"
                                >
                                  <span className="font-medium">{idx + 1}.</span> {question}
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Suggested Topics */}
                        {scanResult.suggested_topics.length > 0 && (
                          <div className="pt-2 border-t">
                            <Label className="text-xs text-muted-foreground mb-2 block">
                              Suggested Quiz Topics
                            </Label>
                            <div className="flex flex-wrap gap-1">
                              {scanResult.suggested_topics.map((topic, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button className="flex-1" variant="outline" size="sm">
                            <FlaskConical className="w-3 h-3 mr-1" />
                            Create Quiz
                          </Button>
                          <Button className="flex-1" variant="outline" size="sm">
                            <Play className="w-3 h-3 mr-1" />
                            Start Studying
                          </Button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-12 text-center"
                      >
                        <Scan className="w-12 h-12 text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground text-sm">
                          Upload a textbook page to scan
                        </p>
                        <p className="text-muted-foreground/70 text-xs mt-1">
                          Results will appear here
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Scan History</CardTitle>
                <CardDescription>
                  View your previously scanned textbook pages
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No scans yet</p>
                  </div>
                ) : (
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {history.map((scan) => (
                        <motion.div
                          key={scan.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleLoadScan(scan)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline">
                              {SUBJECT_ICONS[scan.subject]} {SUBJECT_LABELS[scan.subject as keyof typeof SUBJECT_LABELS] || scan.subject}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(scan.created_at).toLocaleDateString('en-ZA')}
                            </span>
                          </div>
                          <p className="text-sm font-medium">
                            {scan.chapters_detected?.chapter || 'Unknown Chapter'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {(scan.chapters_detected?.headings || []).length} headings ·{' '}
                            {(scan.chapters_detected?.key_concepts || []).length} concepts ·{' '}
                            {(scan.chapters_detected?.questions || []).length} questions
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
