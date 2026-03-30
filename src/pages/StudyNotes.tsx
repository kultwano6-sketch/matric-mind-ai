import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { motion } from 'framer-motion';
import { Download, BookOpen, Sparkles } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

interface StudyNote {
  id: string;
  subject: MatricSubject;
  topic: string;
  description: string;
  sections: string[];
  pdfUrl?: string;
}

// Curated study notes by subject
const STUDY_NOTES: StudyNote[] = [
  // Mathematics
  { id: 'math-algebra', subject: 'mathematics', topic: 'Algebra & Equations', description: 'Quadratic equations, simultaneous equations, inequalities, and algebraic fractions.', sections: ['Linear equations', 'Quadratic formula', 'Simultaneous equations', 'Inequalities'] },
  { id: 'math-functions', subject: 'mathematics', topic: 'Functions & Graphs', description: 'Hyperbolas, parabolas, exponential, and logarithmic functions.', sections: ['Parabolas', 'Hyperbolas', 'Exponential functions', 'Logarithmic functions'] },
  { id: 'math-calculus', subject: 'mathematics', topic: 'Calculus', description: 'Differentiation, first principles, and applications of derivatives.', sections: ['First principles', 'Rules of differentiation', 'Tangent lines', 'Optimisation'] },
  { id: 'math-trig', subject: 'mathematics', topic: 'Trigonometry', description: 'Identities, equations, graphs, and the sine/cosine rules.', sections: ['Trig identities', 'Trig equations', 'Graphs of trig functions', 'Sine & cosine rules'] },
  { id: 'math-geometry', subject: 'mathematics', topic: 'Euclidean Geometry', description: 'Circle theorems, similarity, and geometric proofs.', sections: ['Circle theorems', 'Similar triangles', 'Polygon properties', 'Geometric proofs'] },
  { id: 'math-stats', subject: 'mathematics', topic: 'Statistics & Probability', description: 'Mean, median, mode, standard deviation, and probability.', sections: ['Measures of central tendency', 'Standard deviation', 'Probability rules', 'Venn diagrams'] },
  { id: 'math-financial', subject: 'mathematics', topic: 'Financial Maths', description: 'Simple and compound interest, annuities, and depreciation.', sections: ['Simple interest', 'Compound interest', 'Annuities', 'Depreciation'] },

  // Physical Sciences
  { id: 'phys-mechanics', subject: 'physical_sciences', topic: 'Mechanics', description: 'Newton\'s laws, momentum, impulse, and vertical projectile motion.', sections: ['Newton\'s laws', 'Force diagrams', 'Momentum & impulse', 'Projectile motion'] },
  { id: 'phys-waves', subject: 'physical_sciences', topic: 'Waves, Sound & Light', description: 'Wave properties, sound, Doppler effect, and photoelectric effect.', sections: ['Wave properties', 'Sound & Doppler effect', 'Photoelectric effect', 'EM spectrum'] },
  { id: 'phys-electricity', subject: 'physical_sciences', topic: 'Electricity & Magnetism', description: 'Circuits, Ohm\'s law, electromagnetism, and induced currents.', sections: ['Series & parallel circuits', 'Ohm\'s law & power', 'Electromagnetism', 'Faraday\'s law'] },
  { id: 'phys-chemical', subject: 'physical_sciences', topic: 'Chemical Change', description: 'Reactions, stoichiometry, energy changes, and rates of reaction.', sections: ['Mole calculations', 'Empirical formulas', 'Energy changes', 'Rates of reaction'] },
  { id: 'phys-matter', subject: 'physical_sciences', topic: 'Matter & Materials', description: 'Atomic structure, bonding, intermolecular forces, and organic chemistry.', sections: ['Atomic structure', 'Chemical bonding', 'Intermolecular forces', 'Organic chemistry'] },
  { id: 'phys-acids', subject: 'physical_sciences', topic: 'Acids & Bases', description: 'pH calculations, titrations, buffers, and hydrolysis.', sections: ['pH & pOH', 'Titration calculations', 'Buffer solutions', 'Salt hydrolysis'] },

  // Life Sciences
  { id: 'life-cells', subject: 'life_sciences', topic: 'Cell Biology', description: 'Cell structure, organelles, cell division, and transport across membranes.', sections: ['Cell structure', 'Organelles & functions', 'Mitosis & meiosis', 'Osmosis & diffusion'] },
  { id: 'life-genetics', subject: 'life_sciences', topic: 'Genetics & Inheritance', description: 'DNA, meiosis, monohybrid and dihybrid crosses, and genetic disorders.', sections: ['DNA structure', 'Meiosis & crossing over', 'Monohybrid crosses', 'Genetic disorders'] },
  { id: 'life-evolution', subject: 'life_sciences', topic: 'Evolution', description: 'Natural selection, speciation, human evolution, and evidence for evolution.', sections: ['Natural selection', 'Speciation', 'Human evolution', 'Fossil evidence'] },
  { id: 'life-human', subject: 'life_sciences', topic: 'Human Physiology', description: 'Nervous system, endocrine system, homeostasis, and reproduction.', sections: ['Nervous system', 'Hormones & endocrine', 'Homeostasis', 'Reproduction'] },
  { id: 'life-ecology', subject: 'life_sciences', topic: 'Ecology', description: 'Ecosystems, food webs, population dynamics, and conservation.', sections: ['Energy flow', 'Food webs', 'Population growth', 'Conservation'] },

  // Geography
  { id: 'geo-climate', subject: 'geography', topic: 'Climate & Weather', description: 'Atmospheric circulation, South African climate, and climate change.', sections: ['Atmospheric circulation', 'SA climate regions', 'Climate change', 'Weather maps'] },
  { id: 'geo-geomorphology', subject: 'geography', topic: 'Geomorphology', description: 'Fluvial processes, mass movement, and landform development.', sections: ['River systems', 'Mass movement', 'Erosion & deposition', 'Landforms'] },
  { id: 'geo-settlement', subject: 'geography', topic: 'Settlement & Urbanisation', description: 'Urban models, rural-urban migration, and settlement patterns.', sections: ['Urban models', 'Rural-urban migration', 'Settlement patterns', 'Urban problems'] },
  { id: 'geo-development', subject: 'geography', topic: 'Development & Sustainability', description: 'Development indicators, globalisation, and sustainable development.', sections: ['HDI & development', 'Globalisation', 'Sustainable development', 'Resource management'] },

  // History
  { id: 'hist-coldwar', subject: 'history', topic: 'The Cold War', description: 'Origins, key events, proxy wars, and the end of the Cold War.', sections: ['Origins of the Cold War', 'Korean & Vietnam Wars', 'Cuban Missile Crisis', 'End of the Cold War'] },
  { id: 'hist-apartheid', subject: 'history', topic: 'Apartheid South Africa', description: 'Rise of apartheid, resistance movements, and the transition to democracy.', sections: ['Apartheid legislation', 'Resistance movements', 'Defiance Campaign', 'Transition to democracy'] },
  { id: 'hist-civil', subject: 'history', topic: 'Civil Rights Movements', description: 'USA civil rights, anti-apartheid, and global civil rights movements.', sections: ['USA civil rights', 'SA anti-apartheid', 'Key leaders', 'Legislation & change'] },

  // Accounting
  { id: 'acc-statements', subject: 'accounting', topic: 'Financial Statements', description: 'Income statement, balance sheet, and cash flow statement.', sections: ['Income statement', 'Balance sheet', 'Cash flow statement', 'Notes to statements'] },
  { id: 'acc-bookkeeping', subject: 'accounting', topic: 'Bookkeeping', description: 'Journals, ledgers, trial balance, and the accounting cycle.', sections: ['Source documents', 'Journals', 'Ledgers', 'Trial balance'] },
  { id: 'acc-cashflow', subject: 'accounting', topic: 'Cash Flow & Budgets', description: 'Cash budgets, debtors reconciliation, and bank reconciliation.', sections: ['Cash budgets', 'Debtors reconciliation', 'Bank reconciliation', 'VAT'] },

  // Business Studies
  { id: 'bus-environments', subject: 'business_studies', topic: 'Business Environments', description: 'Micro, market, and macro environments affecting business.', sections: ['Micro environment', 'Market environment', 'Macro environment', 'SWOT analysis'] },
  { id: 'bus-operations', subject: 'business_studies', topic: 'Business Operations', description: 'Production, quality, and operations management.', sections: ['Production processes', 'Quality management', 'Inventory management', 'Production layouts'] },
  { id: 'bus-ethics', subject: 'business_studies', topic: 'Ethics & Professionalism', description: 'Corporate governance, ethics, and social responsibility.', sections: ['Corporate governance', 'Business ethics', 'Social responsibility', 'CSR'] },

  // Economics
  { id: 'econ-macro', subject: 'economics', topic: 'Macroeconomics', description: 'GDP, inflation, unemployment, and economic policy.', sections: ['GDP & economic growth', 'Inflation', 'Unemployment', 'Fiscal & monetary policy'] },
  { id: 'econ-micro', subject: 'economics', topic: 'Microeconomics', description: 'Markets, demand & supply, elasticity, and market failure.', sections: ['Demand & supply', 'Elasticity', 'Market structures', 'Market failure'] },

  // English HL
  { id: 'eng-lit', subject: 'english_home_language', topic: 'Literature', description: 'Novels, short stories, poetry, and drama analysis techniques.', sections: ['Novel analysis', 'Short story analysis', 'Poetry techniques', 'Drama analysis'] },
  { id: 'eng-essays', subject: 'english_home_language', topic: 'Essay Writing', description: 'Argumentative, narrative, discursive, and transactional essays.', sections: ['Argumentative essays', 'Narrative essays', 'Discursive essays', 'Language techniques'] },

  // Mathematical Literacy
  { id: 'mathlit-budget', subject: 'mathematical_literacy', topic: 'Finance & Budgets', description: 'Personal budgets, loans, interest, and exchange rates.', sections: ['Personal budgets', 'Loan calculations', 'Interest rates', 'Exchange rates'] },
  { id: 'mathlit-measure', subject: 'mathematical_literacy', topic: 'Measurement', description: 'Perimeter, area, volume, and conversions.', sections: ['Perimeter & area', 'Volume & surface area', 'Conversions', 'Scale & maps'] },
  { id: 'mathlit-data', subject: 'mathematical_literacy', topic: 'Data Handling', description: 'Graphs, statistics, probability, and data interpretation.', sections: ['Reading graphs', 'Statistics', 'Probability', 'Data interpretation'] },

  // Information Technology
  { id: 'it-programming', subject: 'information_technology', topic: 'Programming', description: 'Algorithms, pseudocode, loops, and data structures.', sections: ['Algorithms & pseudocode', 'Loops & conditions', 'Arrays & lists', 'Functions & methods'] },
  { id: 'it-sql', subject: 'information_technology', topic: 'Databases & SQL', description: 'Database design, SQL queries, and data integrity.', sections: ['Database design', 'SQL queries', 'Joins & relationships', 'Data integrity'] },

  // Agricultural Sciences
  { id: 'agri-soil', subject: 'agricultural_sciences', topic: 'Soil Science', description: 'Soil types, composition, fertility, and conservation.', sections: ['Soil composition', 'Soil types', 'Fertilisers', 'Soil conservation'] },
  { id: 'agri-plants', subject: 'agricultural_sciences', topic: 'Plant Production', description: 'Plant anatomy, photosynthesis, crop production, and pest management.', sections: ['Plant anatomy', 'Photosynthesis', 'Crop production', 'Pest management'] },
  { id: 'agri-animals', subject: 'agricultural_sciences', topic: 'Animal Production', description: 'Animal anatomy, nutrition, breeding, and livestock management.', sections: ['Animal anatomy', 'Animal nutrition', 'Breeding', 'Livestock management'] },
  { id: 'agri-economics', subject: 'agricultural_sciences', topic: 'Agricultural Economics', description: 'Farm management, marketing, and agricultural business principles.', sections: ['Farm management', 'Marketing', 'Business plans', 'Agricultural policy'] },
  { id: 'agri-tech', subject: 'agricultural_sciences', topic: 'Agricultural Technology', description: 'Farm machinery, irrigation systems, and modern farming techniques.', sections: ['Farm machinery', 'Irrigation', 'Precision farming', 'Mechanisation'] },

  // CAT
  { id: 'cat-spreadsheets', subject: 'computer_applications_technology', topic: 'Spreadsheets', description: 'Formulas, functions, charts, and data analysis in spreadsheets.', sections: ['Formulas & functions', 'Charts & graphs', 'Data sorting & filtering', 'What-if analysis'] },
  { id: 'cat-word', subject: 'computer_applications_technology', topic: 'Word Processing', description: 'Document formatting, tables, mail merge, and styles.', sections: ['Formatting & styles', 'Tables & graphics', 'Mail merge', 'Headers & footers'] },
];

const SCIENCE_SUBJECTS: MatricSubject[] = ['physical_sciences', 'life_sciences', 'geography'];

export default function StudyNotes() {
  const [subject, setSubject] = useState<MatricSubject | 'all'>('all');

  const filtered = subject === 'all'
    ? STUDY_NOTES
    : STUDY_NOTES.filter(n => n.subject === subject);

  const subjectsWithNotes = [...new Set(STUDY_NOTES.map(n => n.subject))];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
              <Download className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Study Notes</h1>
              <p className="text-muted-foreground text-sm">
                Comprehensive summaries for every topic. Use alongside the AI Tutor for best results.
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
            const isScience = SCIENCE_SUBJECTS.includes(note.subject);

            return (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
              >
                <Card className="glass-card h-full flex flex-col hover:border-primary/40 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xl">{icon}</span>
                      <div className="flex gap-1.5">
                        {isScience && (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            <Sparkles className="w-3 h-3 mr-1" /> AI Illustrations
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-base mt-2 leading-tight">{note.topic}</CardTitle>
                    <p className="text-sm text-muted-foreground">{label}</p>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1 flex flex-col">
                    <p className="text-sm text-muted-foreground mb-3">{note.description}</p>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {note.sections.map((s, si) => (
                        <Badge key={si} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                    <div className="mt-auto flex gap-2">
                      <Button asChild className="flex-1" variant="outline" size="sm">
                        <a href={`/tutor?subject=${note.subject}&topic=${encodeURIComponent(note.topic)}`}>
                          <BookOpen className="w-4 h-4 mr-2" />
                          Study with AI
                        </a>
                      </Button>
                      {isScience && (
                        <Button asChild variant="secondary" size="sm">
                          <a href={`/illustrations?subject=${note.subject}&topic=${encodeURIComponent(note.topic)}`}>
                            <Sparkles className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
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
