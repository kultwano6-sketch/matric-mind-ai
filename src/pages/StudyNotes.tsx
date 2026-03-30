import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import { motion } from 'framer-motion';
import { BookOpen, ExternalLink, Sparkles, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

interface NoteResource {
  subject: MatricSubject;
  topic: string;
  description: string;
  resources: {
    label: string;
    url: string;
    type: 'textbook' | 'notes' | 'video' | 'external';
  }[];
}

// Curated free resources for SA matric subjects
const STUDY_RESOURCES: NoteResource[] = [
  // Mathematics
  { subject: 'mathematics', topic: 'Algebra & Equations', description: 'Quadratic equations, simultaneous equations, inequalities.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/mathematics/grade-12/algebra-and-equations', type: 'textbook' },
    { label: 'Everything Maths', url: 'https://everythingmaths.co.za/maths/grade-12/01-algebra-and-equations', type: 'notes' },
  ]},
  { subject: 'mathematics', topic: 'Functions & Graphs', description: 'Parabolas, hyperbolas, exponential and logarithmic functions.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/mathematics/grade-12/functions', type: 'textbook' },
    { label: 'Everything Maths', url: 'https://everythingmaths.co.za/maths/grade-12/02-functions', type: 'notes' },
  ]},
  { subject: 'mathematics', topic: 'Calculus', description: 'Differentiation, first principles, applications of derivatives.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/mathematics/grade-12/differential-calculus', type: 'textbook' },
    { label: 'Everything Maths', url: 'https://everythingmaths.co.za/maths/grade-12/05-differential-calculus', type: 'notes' },
  ]},
  { subject: 'mathematics', topic: 'Trigonometry', description: 'Identities, equations, graphs, sine and cosine rules.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/mathematics/grade-12/trigonometry', type: 'textbook' },
    { label: 'Everything Maths', url: 'https://everythingmaths.co.za/maths/grade-12/04-trigonometry', type: 'notes' },
  ]},
  { subject: 'mathematics', topic: 'Euclidean Geometry', description: 'Circle theorems, similarity, geometric proofs.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/mathematics/grade-12/euclidean-geometry', type: 'textbook' },
  ]},
  { subject: 'mathematics', topic: 'Statistics & Probability', description: 'Mean, median, mode, standard deviation, probability.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/mathematics/grade-12/statistics', type: 'textbook' },
  ]},
  { subject: 'mathematics', topic: 'Financial Maths', description: 'Simple and compound interest, annuities, depreciation.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/mathematics/grade-12/finance', type: 'textbook' },
  ]},

  // Physical Sciences
  { subject: 'physical_sciences', topic: 'Mechanics', description: "Newton's laws, momentum, impulse, projectile motion.", resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/science/grade-12/mechanics', type: 'textbook' },
    { label: 'Everything Science', url: 'https://everythingmaths.co.za/science/grade-12/01-mechanics', type: 'notes' },
  ]},
  { subject: 'physical_sciences', topic: 'Waves, Sound & Light', description: 'Wave properties, sound, Doppler effect, photoelectric effect.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/science/grade-12/optical-phenomena', type: 'textbook' },
    { label: 'Everything Science', url: 'https://everythingmaths.co.za/science/grade-12/04-waves-sound-and-light', type: 'notes' },
  ]},
  { subject: 'physical_sciences', topic: 'Electricity & Magnetism', description: "Circuits, Ohm's law, electromagnetism, Faraday's law.", resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/science/grade-12/electro-magnetism', type: 'textbook' },
    { label: 'Everything Science', url: 'https://everythingmaths.co.za/science/grade-12/03-electricity-and-magnetism', type: 'notes' },
  ]},
  { subject: 'physical_sciences', topic: 'Chemical Change', description: 'Reactions, stoichiometry, energy changes, rates of reaction.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/science/grade-12/chemical-change', type: 'textbook' },
    { label: 'Everything Science', url: 'https://everythingmaths.co.za/science/grade-12/07-chemical-change', type: 'notes' },
  ]},
  { subject: 'physical_sciences', topic: 'Matter & Materials', description: 'Atomic structure, bonding, intermolecular forces, organic chemistry.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/science/grade-12/matter-and-materials', type: 'textbook' },
  ]},
  { subject: 'physical_sciences', topic: 'Acids & Bases', description: 'pH calculations, titrations, buffers, hydrolysis.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/science/grade-12/acids-and-bases', type: 'textbook' },
  ]},

  // Life Sciences
  { subject: 'life_sciences', topic: 'Cell Biology', description: 'Cell structure, organelles, cell division, transport across membranes.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/science/grade-12/life-sciences/cell-division', type: 'textbook' },
  ]},
  { subject: 'life_sciences', topic: 'Genetics & Inheritance', description: 'DNA, meiosis, monohybrid and dihybrid crosses, genetic disorders.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/science/grade-12/life-sciences/genetics-and-inheritance', type: 'textbook' },
  ]},
  { subject: 'life_sciences', topic: 'Evolution', description: 'Natural selection, speciation, human evolution, evidence for evolution.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/science/grade-12/life-sciences/evolution', type: 'textbook' },
  ]},
  { subject: 'life_sciences', topic: 'Human Physiology', description: 'Nervous system, endocrine system, homeostasis, reproduction.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/science/grade-12/life-sciences/human-physiology', type: 'textbook' },
  ]},
  { subject: 'life_sciences', topic: 'Ecology', description: 'Ecosystems, food webs, population dynamics, conservation.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/science/grade-12/life-sciences/ecology', type: 'textbook' },
  ]},

  // Geography
  { subject: 'geography', topic: 'Climate & Weather', description: 'Atmospheric circulation, SA climate, climate change.', resources: [
    { label: 'Mindset Learn', url: 'https://www.mindsetlearn.co.za/grade-12/geography', type: 'external' },
  ]},
  { subject: 'geography', topic: 'Geomorphology', description: 'Fluvial processes, mass movement, landform development.', resources: [
    { label: 'Mindset Learn', url: 'https://www.mindsetlearn.co.za/grade-12/geography', type: 'external' },
  ]},
  { subject: 'geography', topic: 'Settlement & Urbanisation', description: 'Urban models, rural-urban migration, settlement patterns.', resources: [
    { label: 'Mindset Learn', url: 'https://www.mindsetlearn.co.za/grade-12/geography', type: 'external' },
  ]},

  // History
  { subject: 'history', topic: 'The Cold War', description: 'Origins, key events, proxy wars, end of the Cold War.', resources: [
    { label: 'Mindset Learn', url: 'https://www.mindsetlearn.co.za/grade-12/history', type: 'external' },
  ]},
  { subject: 'history', topic: 'Apartheid South Africa', description: 'Rise of apartheid, resistance movements, transition to democracy.', resources: [
    { label: 'Mindset Learn', url: 'https://www.mindsetlearn.co.za/grade-12/history', type: 'external' },
  ]},

  // Accounting
  { subject: 'accounting', topic: 'Financial Statements', description: 'Income statement, balance sheet, cash flow statement.', resources: [
    { label: 'Mindset Learn', url: 'https://www.mindsetlearn.co.za/grade-12/accounting', type: 'external' },
  ]},
  { subject: 'accounting', topic: 'Bookkeeping', description: 'Journals, ledgers, trial balance, accounting cycle.', resources: [
    { label: 'Mindset Learn', url: 'https://www.mindsetlearn.co.za/grade-12/accounting', type: 'external' },
  ]},

  // CAT
  { subject: 'computer_applications_technology', topic: 'Spreadsheets', description: 'Formulas, functions, charts, data analysis.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/cat/grade-12/spreadsheets', type: 'textbook' },
  ]},
  { subject: 'computer_applications_technology', topic: 'Word Processing', description: 'Document formatting, tables, mail merge, styles.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/cat/grade-12/word-processing', type: 'textbook' },
  ]},

  // IT
  { subject: 'information_technology', topic: 'Programming', description: 'Algorithms, pseudocode, loops, data structures.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/it/grade-12/programming', type: 'textbook' },
  ]},

  // Agricultural Sciences
  { subject: 'agricultural_sciences', topic: 'Soil Science', description: 'Soil types, composition, fertility, conservation.', resources: [
    { label: 'Mindset Learn', url: 'https://www.mindsetlearn.co.za/grade-12/agricultural-sciences', type: 'external' },
  ]},
  { subject: 'agricultural_sciences', topic: 'Plant Production', description: 'Plant anatomy, photosynthesis, crop production, pest management.', resources: [
    { label: 'Mindset Learn', url: 'https://www.mindsetlearn.co.za/grade-12/agricultural-sciences', type: 'external' },
  ]},

  // English HL
  { subject: 'english_home_language', topic: 'Literature', description: 'Novels, short stories, poetry, drama analysis techniques.', resources: [
    { label: 'Mindset Learn', url: 'https://www.mindsetlearn.co.za/grade-12/english', type: 'external' },
  ]},
  { subject: 'english_home_language', topic: 'Essay Writing', description: 'Argumentative, narrative, discursive, transactional essays.', resources: [
    { label: 'Mindset Learn', url: 'https://www.mindsetlearn.co.za/grade-12/english', type: 'external' },
  ]},

  // Mathematical Literacy
  { subject: 'mathematical_literacy', topic: 'Finance & Budgets', description: 'Personal budgets, loans, interest, exchange rates.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/maths-lit/grade-12', type: 'textbook' },
  ]},
  { subject: 'mathematical_literacy', topic: 'Measurement', description: 'Perimeter, area, volume, conversions, scale.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/maths-lit/grade-12', type: 'textbook' },
  ]},
  { subject: 'mathematical_literacy', topic: 'Data Handling', description: 'Graphs, statistics, probability, data interpretation.', resources: [
    { label: 'Siyavula Textbook', url: 'https://www.siyavula.com/read/za/maths-lit/grade-12', type: 'textbook' },
  ]},
];

export default function StudyNotes() {
  const [subject, setSubject] = useState<MatricSubject | 'all'>('all');
  const navigate = useNavigate();

  const filtered = subject === 'all'
    ? STUDY_RESOURCES
    : STUDY_RESOURCES.filter(n => n.subject === subject);

  const subjectsWithNotes = [...new Set(STUDY_RESOURCES.map(n => n.subject))];

  const getIcon = (type: string) => {
    switch (type) {
      case 'textbook': return '📚';
      case 'notes': return '📝';
      case 'video': return '🎬';
      case 'external': return '🌐';
      default: return '📄';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Study Notes</h1>
              <p className="text-muted-foreground text-sm">
                Free textbooks and notes from Siyavula, Everything Maths, and Mindset Learn
              </p>
            </div>
          </div>
        </motion.div>

        {/* Filter */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Card className="glass-card">
            <CardContent className="p-4">
              <Select value={subject} onValueChange={(v) => setSubject(v as MatricSubject | 'all')}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjectsWithNotes.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filtered.length}</span> topic{filtered.length !== 1 ? 's' : ''}
        </p>

        {/* Notes grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note, i) => {
            const icon = SUBJECT_ICONS[note.subject] || '📄';
            const label = SUBJECT_LABELS[note.subject] || note.subject;

            return (
              <motion.div
                key={`${note.subject}-${note.topic}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
              >
                <Card className="glass-card h-full flex flex-col hover:border-primary/40 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xl">{icon}</span>
                    </div>
                    <CardTitle className="text-base mt-2 leading-tight">{note.topic}</CardTitle>
                    <p className="text-sm text-muted-foreground">{label}</p>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1 flex flex-col">
                    <p className="text-sm text-muted-foreground mb-3">{note.description}</p>

                    {/* Resource links */}
                    <div className="space-y-2 mb-4">
                      {note.resources.map((res, ri) => (
                        <a
                          key={ri}
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <span>{getIcon(res.type)}</span>
                          <span>{res.label}</span>
                          <ExternalLink className="w-3 h-3 opacity-50" />
                        </a>
                      ))}
                    </div>

                    {/* Ask AI button */}
                    <div className="mt-auto">
                      <Button
                        className="w-full"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/tutor?subject=${note.subject}`)}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Study with AI Tutor
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
