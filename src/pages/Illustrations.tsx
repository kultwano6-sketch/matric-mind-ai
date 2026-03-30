import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Sparkles, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

const SCIENCE_SUBJECTS: MatricSubject[] = [
  'physical_sciences',
  'life_sciences',
  'geography',
  'agricultural_sciences',
  'natural_sciences',
];

const TOPIC_SUGGESTIONS: Record<MatricSubject, string[]> = {
  physical_sciences: [
    'Draw the structure of an atom showing electrons, protons, and neutrons',
    'Illustrate Newton\'s three laws of motion with examples',
    'Show how a series and parallel circuit works',
    'Draw the electromagnetic spectrum with wavelengths',
    'Illustrate the process of electrolysis',
    'Show the relationship between pressure, volume, and temperature for ideal gases',
  ],
  life_sciences: [
    'Draw a detailed animal cell with all organelles labelled',
    'Illustrate the process of mitosis in 4 stages',
    'Show the DNA double helix structure with base pairing',
    'Draw the human heart with blood flow directions',
    'Illustrate the process of photosynthesis and cellular respiration',
    'Show a food web with producers, consumers, and decomposers',
  ],
  geography: [
    'Draw a cross-section of a river from source to mouth',
    'Illustrate the water cycle with all processes labelled',
    'Show the layers of the atmosphere with heights',
    'Draw a diagram of plate tectonics and plate boundaries',
    'Illustrate a typical urban land use model',
    'Show how erosion creates different landforms',
  ],
  agricultural_sciences: [
    'Draw the structure of a plant cell with organelles',
    'Illustrate the process of photosynthesis in plants',
    'Show the soil profile with different horizons',
    'Draw the anatomy of a farm animal digestive system',
    'Illustrate crop rotation patterns over 4 seasons',
    'Show the water cycle in an agricultural context',
  ],
  natural_sciences: [
    'Draw the solar system with planets in order',
    'Illustrate the rock cycle with all rock types',
    'Show the layers of the Earth\'s interior',
    'Draw a simple electric circuit with components',
    'Illustrate how sound waves travel through air',
    'Show the life cycle of a butterfly',
  ],
  mathematics: [],
  mathematical_literacy: [],
  accounting: [],
  business_studies: [],
  economics: [],
  history: [],
  english_home_language: [],
  english_first_additional: [],
  afrikaans_home_language: [],
  afrikaans_first_additional: [],
  isizulu_home_language: [],
  isizulu_first_additional: [],
  isixhosa_home_language: [],
  isixhosa_first_additional: [],
  sesotho_home_language: [],
  sesotho_first_additional: [],
  setswana_home_language: [],
  setswana_first_additional: [],
  sepedi_home_language: [],
  sepedi_first_additional: [],
  xitsonga_home_language: [],
  xitsonga_first_additional: [],
  siswati_home_language: [],
  siswati_first_additional: [],
  isindebele_home_language: [],
  isindebele_first_additional: [],
  tshivenda_home_language: [],
  tshivenda_first_additional: [],
  life_orientation: [],
  tourism: [],
  information_technology: [],
  computer_applications_technology: [],
  civil_technology: [],
  electrical_technology: [],
  mechanical_technology: [],
};

interface IllustrationResult {
  text: string;
  description: string;
}

export default function Illustrations() {
  const [searchParams] = useSearchParams();
  const [subject, setSubject] = useState<MatricSubject>(
    (searchParams.get('subject') as MatricSubject) || 'physical_sciences'
  );
  const [prompt, setPrompt] = useState(searchParams.get('topic') || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IllustrationResult | null>(null);
  const [history, setHistory] = useState<IllustrationResult[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const suggestions = TOPIC_SUGGESTIONS[subject] || [];

  const handleGenerate = async (customPrompt?: string) => {
    const topicPrompt = customPrompt || prompt;
    if (!topicPrompt.trim()) {
      toast.error('Please enter what you want illustrated');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/illustrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, prompt: topicPrompt }),
      });

      if (!res.ok) throw new Error('Failed to generate illustration');

      const data = await res.json();
      const newResult = { text: data.text, description: data.description || topicPrompt };
      setResult(newResult);
      setHistory(prev => [newResult, ...prev].slice(0, 10));
      toast.success('Illustration generated!');
    } catch (error) {
      console.error('Illustration error:', error);
      toast.error('Failed to generate illustration. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Image className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">AI Illustrations</h1>
              <p className="text-muted-foreground text-sm">
                Generate detailed diagrams and illustrations for science topics
              </p>
            </div>
          </div>
        </motion.div>

        {/* Input */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Card className="glass-card">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={subject} onValueChange={(v) => setSubject(v as MatricSubject)}>
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCIENCE_SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1 flex gap-2">
                  <Input
                    placeholder="Describe what you want illustrated..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    className="flex-1"
                  />
                  <Button onClick={() => handleGenerate()} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Try these:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s, i) => (
                      <Button
                        key={i}
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setPrompt(s);
                          handleGenerate(s);
                        }}
                      >
                        {s.length > 60 ? s.slice(0, 60) + '...' : s}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Result */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className="glass-card">
                <CardContent className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-500" />
                  <p className="text-muted-foreground">Generating illustration...</p>
                  <p className="text-xs text-muted-foreground mt-1">Creating a detailed diagram for {SUBJECT_LABELS[subject]}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {result && !loading && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Card className="glass-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      {result.description}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                      <RotateCcw className="w-4 h-4 mr-1" /> Clear
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-xl p-6 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                    {result.text}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    💡 Tip: Ask the <a href="/tutor" className="text-primary hover:underline">AI Tutor</a> to explain any part of this diagram in more detail.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History */}
        {history.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Illustrations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {history.map((item, i) => (
                <Card
                  key={i}
                  className="glass-card cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => setResult(item)}
                >
                  <CardContent className="p-4">
                    <p className="text-sm font-medium truncate">{item.description}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.text.slice(0, 100)}...</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
