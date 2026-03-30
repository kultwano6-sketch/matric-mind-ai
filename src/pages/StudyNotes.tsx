import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { motion } from 'framer-motion';
import { Download, Sparkles, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

interface NoteTopic {
  id: string;
  subject: MatricSubject;
  topic: string;
  description: string;
  keyPoints: string[];
}

// Comprehensive study notes for all matric subjects
const STUDY_NOTES: NoteTopic[] = [
  // Mathematics
  { id: 'math-algebra', subject: 'mathematics', topic: 'Algebra & Equations', description: 'Quadratic equations, simultaneous equations, inequalities, surds.', keyPoints: ['Quadratic formula: x = (-b ± √(b²-4ac)) / 2a', 'Discriminant: Δ = b²-4ac determines number of solutions', 'Completing the square method', 'Simultaneous equations: substitution and elimination', 'Quadratic inequalities: use number line method'] },
  { id: 'math-functions', subject: 'mathematics', topic: 'Functions & Graphs', description: 'Parabolas, hyperbolas, exponential and logarithmic functions.', keyPoints: ['Parabola: y = ax² + bx + c, vertex at (-b/2a, f(-b/2a))', 'Hyperbola: y = k/x, asymptotes at x=0 and y=0', 'Exponential: y = a·bˣ, passes through (0,a)', 'Logarithm: y = log_a(x), inverse of exponential', 'Domain and range analysis', 'Turning points and intercepts'] },
  { id: 'math-calculus', subject: 'mathematics', topic: 'Calculus', description: 'Differentiation from first principles, rules, and applications.', keyPoints: ['First principles: f\'(x) = lim [f(x+h)-f(x)]/h as h→0', 'Power rule: d/dx(xⁿ) = nxⁿ⁻¹', 'Product rule: d/dx(uv) = u\'v + uv\'', 'Quotient rule: d/dx(u/v) = (u\'v - uv\')/v²', 'Chain rule: d/dx[f(g(x))] = f\'(g(x))·g\'(x)', 'Increasing: f\'(x) > 0, Decreasing: f\'(x) < 0', 'Maximum: f\'(x)=0 and f\'\'(x)<0', 'Minimum: f\'(x)=0 and f\'\'(x)>0'] },
  { id: 'math-trig', subject: 'mathematics', topic: 'Trigonometry', description: 'Identities, equations, graphs, and the sine/cosine rules.', keyPoints: ['sin²θ + cos²θ = 1', 'Sine rule: a/sin A = b/sin B = c/sin C', 'Cosine rule: a² = b² + c² - 2bc·cos A', 'Area = ½ab·sin C', 'Period of sin/cos = 360°, tan = 180°', 'Solving trig equations: use CAST diagram', 'Compound angles: sin(A±B), cos(A±B)'] },
  { id: 'math-geometry', subject: 'mathematics', topic: 'Euclidean Geometry', description: 'Circle theorems, similarity, and geometric proofs.', keyPoints: ['Angles on same arc are equal', 'Angle at centre = 2 × angle at circumference', 'Tangent perpendicular to radius', 'Opposite angles of cyclic quadrilateral sum to 180°', 'Similar triangles: corresponding angles equal, sides proportional', 'Midpoint theorem: line joins midpoints ∥ to third side'] },
  { id: 'math-stats', subject: 'mathematics', topic: 'Statistics & Probability', description: 'Mean, median, mode, standard deviation, and probability.', keyPoints: ['Mean = Σx/n', 'Median = middle value (arrange in order)', 'Mode = most frequent value', 'Standard deviation: σ = √[Σ(x-μ)²/n]', 'P(A or B) = P(A) + P(B) - P(A∩B)', 'P(A and B) = P(A) × P(B|A)', 'Independent events: P(A∩B) = P(A) × P(B)'] },
  { id: 'math-financial', subject: 'mathematics', topic: 'Financial Maths', description: 'Simple and compound interest, annuities, and depreciation.', keyPoints: ['Simple interest: I = P × r × t', 'Compound interest: A = P(1 + r/n)^(nt)', 'Effective interest rate: (1 + r/n)ⁿ - 1', 'Future value of annuity: FV = PMT × [(1+r)ⁿ - 1]/r', 'Present value of annuity: PV = PMT × [1 - (1+r)⁻ⁿ]/r', 'Straight-line depreciation: (Cost - Residual) / Useful life', 'Reducing balance depreciation: V = Cost(1-r)ⁿ'] },

  // Physical Sciences
  { id: 'phys-mechanics', subject: 'physical_sciences', topic: 'Mechanics', description: "Newton's laws, momentum, impulse, and projectile motion.", keyPoints: ['Newton\'s 1st law: Object stays at rest or constant velocity unless acted on by net force', 'Newton\'s 2nd law: F = ma', 'Newton\'s 3rd law: Every action has equal opposite reaction', 'Momentum: p = mv', 'Impulse: J = FΔt = Δp', 'Projectile motion: horizontal v constant, vertical a = g = 9.8 m/s²', 'Work: W = F·d·cosθ', 'Energy: KE = ½mv², PE = mgh'] },
  { id: 'phys-waves', subject: 'physical_sciences', topic: 'Waves, Sound & Light', description: 'Wave properties, sound, Doppler effect, and photoelectric effect.', keyPoints: ['Wave equation: v = fλ', 'Doppler effect: f\' = f(v ± v_o)/(v ∓ v_s)', 'Photoelectric effect: E = hf = W + KE_max', 'Threshold frequency: f₀ = W/h', 'Sound intensity: I = P/A (W/m²)', 'Decibels: β = 10 log(I/I₀)', 'Standing waves: nodes (no displacement), antinodes (max displacement)'] },
  { id: 'phys-electricity', subject: 'physical_sciences', topic: 'Electricity & Magnetism', description: "Circuits, Ohm's law, electromagnetism, and Faraday's law.", keyPoints: ["Ohm's law: V = IR", 'Series: R_total = R₁ + R₂ + R₃', 'Parallel: 1/R_total = 1/R₁ + 1/R₂ + 1/R₃', 'Power: P = IV = I²R = V²/R', "Faraday's law: EMF = -NΔΦ/Δt", 'Lenz\'s law: induced current opposes change', 'Right-hand rule for magnetic fields'] },
  { id: 'phys-chemical', subject: 'physical_sciences', topic: 'Chemical Change', description: 'Reactions, stoichiometry, energy changes, and rates of reaction.', keyPoints: ['Moles: n = m/M = V/Vm = N/NA', 'Molar gas volume at STP: 22.4 dm³', 'Limiting reagent determines product yield', '% yield = (actual/theoretical) × 100', 'Enthalpy: ΔH = Σ(products) - Σ(reactants)', 'Exothermic: ΔH < 0, Endothermic: ΔH > 0', 'Rate = k[A]ⁿ (rate equation)'] },
  { id: 'phys-acids', subject: 'physical_sciences', topic: 'Acids & Bases', description: 'pH calculations, titrations, buffers, and hydrolysis.', keyPoints: ['pH = -log[H⁺], pOH = -log[OH⁻]', 'pH + pOH = 14 (at 25°C)', 'Kw = [H⁺][OH⁻] = 1×10⁻¹⁴', 'Ka = [H⁺][A⁻]/[HA] for weak acids', 'Buffer: pH = pKa + log([A⁻]/[HA])', 'Titration: n_acid × M_acid × V_acid = n_base × M_base × V_base', 'Salt hydrolysis: acidic salt from strong acid + weak base'] },

  // Life Sciences
  { id: 'life-cells', subject: 'life_sciences', topic: 'Cell Biology', description: 'Cell structure, organelles, cell division, and transport.', keyPoints: ['Cell membrane: phospholipid bilayer with embedded proteins', 'Nucleus: contains DNA, controls cell activities', 'Mitochondria: site of aerobic respiration (ATP production)', 'Ribosomes: site of protein synthesis', 'Endoplasmic reticulum: transport network (rough has ribosomes)', 'Golgi apparatus: packages and ships proteins', 'Osmosis: water moves from high to low water potential', 'Mitosis: PMAT (Prophase, Metaphase, Anaphase, Telophase)'] },
  { id: 'life-genetics', subject: 'life_sciences', topic: 'Genetics & Inheritance', description: 'DNA, meiosis, monohybrid and dihybrid crosses, and genetic disorders.', keyPoints: ['DNA: double helix, complementary base pairing (A-T, G-C)', 'DNA replication: semi-conservative', 'Gene: segment of DNA that codes for a protein', 'Meiosis: produces 4 haploid gametes (2 divisions)', 'Monohybrid cross ratio: 3:1 (dominant:recessive)', 'Dihybrid cross ratio: 9:3:3:1', 'Incomplete dominance: heterozygous shows blended phenotype', 'Codominance: both alleles expressed equally', 'Sex-linked: genes on X chromosome (haemophilia, colour blindness)'] },
  { id: 'life-evolution', subject: 'life_sciences', topic: 'Evolution', description: 'Natural selection, speciation, human evolution, and evidence.', keyPoints: ['Natural selection: survival of the fittest (Darwin)', 'Variation arises from mutation and sexual reproduction', 'Adaptation: traits that improve survival in an environment', 'Speciation: formation of new species (allopatric, sympatric)', 'Evidence: fossils, comparative anatomy, molecular biology', 'Homologous structures: same origin, different function', 'Analogous structures: different origin, same function', 'Human evolution: Australopithecus → Homo habilis → Homo erectus → Homo sapiens'] },
  { id: 'life-human', subject: 'life_sciences', topic: 'Human Physiology', description: 'Nervous system, endocrine system, homeostasis, reproduction.', keyPoints: ['Neuron: dendrite → cell body → axon → synapse', 'Reflex arc: receptor → sensory neuron → CNS → motor neuron → effector', 'Hormones: chemical messengers via bloodstream', 'Insulin: lowers blood glucose, Glucagon: raises blood glucose', 'Homeostasis: maintaining internal balance (negative feedback)', 'Kidney: filtration, reabsorption, secretion', 'Menstrual cycle: FSH → estrogen → LH → progesterone', 'Oogenesis vs spermatogenesis'] },
  { id: 'life-ecology', subject: 'life_sciences', topic: 'Ecology', description: 'Ecosystems, food webs, population dynamics, conservation.', keyPoints: ['Producers → Primary consumers → Secondary consumers → Decomposers', 'Energy transfer: ~10% between trophic levels', 'Food web: interconnected food chains', 'Population growth: J-curve (exponential), S-curve (logistic)', 'Carrying capacity: max population environment can sustain', 'Biodiversity: variety of species in an ecosystem', 'Conservation: in-situ (nature reserves) and ex-situ (zoos, seed banks)', 'Succession: pioneer → intermediate → climax community'] },

  // Geography
  { id: 'geo-climate', subject: 'geography', topic: 'Climate & Weather', description: 'Atmospheric circulation, SA climate, and climate change.', keyPoints: ['Atmosphere layers: troposphere, stratosphere, mesosphere, thermosphere', 'Global circulation: Hadley, Ferrel, Polar cells', 'Coriolis effect: deflects winds right (N) and left (S)', 'SA climate: influenced by Agulhas (warm) and Benguela (cold) currents', 'Climate change: greenhouse effect, global warming, CO₂ increase', 'Weather maps: isobars, highs, lows, fronts', 'El Niño/La Niña: Pacific Ocean temperature effects'] },
  { id: 'geo-geomorphology', subject: 'geography', topic: 'Geomorphology', description: 'Fluvial processes, mass movement, and landform development.', keyPoints: ['River profile: youthful (V-shaped) → mature (meanders) → old age (flood plain)', 'Erosion processes: hydraulic action, abrasion, attrition, solution', 'Deposition: when river loses energy (inside of bends, mouth)', 'Mass movement: rockfalls, landslides, creep, slumps', 'Drainage patterns: dendritic, trellis, radial, rectangular', 'Waterfall formation: hard rock over soft rock', 'Ox-bow lake: meander cut off by deposition'] },
  { id: 'geo-settlement', subject: 'geography', topic: 'Settlement & Urbanisation', description: 'Urban models, rural-urban migration, and settlement patterns.', keyPoints: ['Burgess model: CBD → Transition → Working class → Commuter zone', 'Hoyt model: sectors along transport routes', 'Urban problems: congestion, pollution, informal settlements, crime', 'Rural-urban migration: push factors (poverty) vs pull factors (jobs)', 'Counter-urbanisation: movement from city to suburbs/rural', 'Settlement hierarchy: hamlet → village → town → city → metropolis', 'Gentrification: renovation of declining urban areas'] },
  { id: 'geo-development', subject: 'geography', topic: 'Development & Sustainability', description: 'Development indicators, globalisation, and sustainability.', keyPoints: ['HDI: health (life expectancy), education, income', 'GDP per capita vs GNI per capita', 'Globalisation: increasing interconnection (trade, culture, technology)', 'Sustainable development: meeting present needs without compromising future', 'Ecological footprint: measure of resource use', 'MDGs → SDGs (17 Sustainable Development Goals)', 'Fair trade: better prices for developing country producers'] },

  // History
  { id: 'hist-coldwar', subject: 'history', topic: 'The Cold War', description: 'Origins, key events, proxy wars, and the end of the Cold War.', keyPoints: ['Origins: ideological conflict (capitalism vs communism)', 'Truman Doctrine (1947): containment of communism', 'Marshall Plan: US economic aid to rebuild Europe', 'Berlin Blockade (1948-49): Soviet blockade, Berlin Airlift', 'Korean War (1950-53): first proxy war', 'Cuban Missile Crisis (1962): closest to nuclear war', 'Vietnam War (1955-75): US involvement and withdrawal', 'Détente: relaxation of tensions (1970s)', 'End: fall of Berlin Wall (1989), USSR dissolved (1991)'] },
  { id: 'hist-apartheid', subject: 'history', topic: 'Apartheid South Africa', description: 'Rise of apartheid, resistance movements, and the transition to democracy.', keyPoints: ['1948: NP wins election, apartheid formally introduced', 'Key laws: Population Registration Act, Group Areas Act, Bantu Education Act', '1955: Freedom Charter adopted at Congress of the People', '1960: Sharpeville Massacre, ANC and PAC banned', '1976: Soweto Uprising, students protest against Afrikaans medium', '1977: Steve Biko dies in detention', '1980s: international sanctions, internal resistance increases', '1990: Mandela released, ANC unbanned', '1994: first democratic elections, Mandela becomes president'] },
  { id: 'hist-civil', subject: 'history', topic: 'Civil Rights Movements', description: 'USA civil rights, anti-apartheid, and global movements.', keyPoints: ['Brown v Board of Education (1954): segregation unconstitutional', 'Montgomery Bus Boycott (1955-56): Rosa Parks', 'Martin Luther King Jr: non-violent resistance, "I Have a Dream" (1963)', 'Civil Rights Act (1964): outlawed discrimination', 'Black Power movement: Malcolm X, Black Panthers', 'Anti-apartheid: international boycotts and sanctions', 'Key leaders: Mandela, Tutu, Sisulu, Biko', 'Legislation brings change but implementation is ongoing'] },

  // Accounting
  { id: 'acc-statements', subject: 'accounting', topic: 'Financial Statements', description: 'Income statement, balance sheet, and cash flow statement.', keyPoints: ['Income Statement: Revenue - Expenses = Net Profit', 'Balance Sheet: Assets = Liabilities + Equity', 'Current assets: cash, debtors, inventory (within 12 months)', 'Non-current assets: equipment, vehicles, buildings', 'Cash Flow: operating + investing + financing activities', 'Retained Income: opening + net profit - drawings/dividends', 'Notes to financial statements provide additional detail'] },
  { id: 'acc-bookkeeping', subject: 'accounting', topic: 'Bookkeeping', description: 'Journals, ledgers, trial balance, and the accounting cycle.', keyPoints: ['Accounting cycle: source doc → journal → ledger → trial balance → financial statements', 'Debit: assets, expenses increase / Credit: liabilities, income, equity increase', 'General journal: date, details, folio, debit, credit', 'General ledger: T-accounts for each item', 'Trial balance: list of all ledger balances (debits = credits)', 'Source documents: invoices, receipts, credit notes, cheques', 'Bank reconciliation: compare bank statement to cash book'] },
  { id: 'acc-cashflow', subject: 'accounting', topic: 'Cash Budgets & VAT', description: 'Cash budgets, debtors reconciliation, and VAT.', keyPoints: ['Cash budget: opening balance + receipts - payments = closing balance', 'Debtors collection: credit sales × collection rate per month', 'VAT: 15% on goods and services in SA', 'Output VAT: charged on sales (liability to SARS)', 'Input VAT: paid on purchases (claimable from SARS)', 'Net VAT = Output VAT - Input VAT', 'Bank reconciliation: outstanding deposits, unpresented cheques'] },

  // Business Studies
  { id: 'bus-environments', subject: 'business_studies', topic: 'Business Environments', description: 'Micro, market, and macro environments affecting business.', keyPoints: ['Micro environment: business itself, suppliers, intermediaries', 'Market environment: customers, competitors, public', 'Macro environment: PESTEL (Political, Economic, Social, Technological, Environmental, Legal)', 'SWOT analysis: Strengths, Weaknesses, Opportunities, Threats', 'Business cycle: expansion, peak, contraction, trough', 'Impact of government policy on business (fiscal, monetary)'] },
  { id: 'bus-operations', subject: 'business_studies', topic: 'Business Operations', description: 'Production, quality, and operations management.', keyPoints: ['Production types: job, batch, mass, continuous', 'Quality management: TQM, quality control, quality assurance', 'Inventory management: JIT (Just In Time), EOQ', 'Production layouts: process, product, fixed position, cellular', 'Gantt charts and critical path analysis', 'Supply chain management: from raw materials to consumer'] },
  { id: 'bus-ethics', subject: 'business_studies', topic: 'Ethics & Professionalism', description: 'Corporate governance, ethics, and social responsibility.', keyPoints: ['Corporate governance: system of rules and practices', 'King IV Code: apply and explain approach', 'Business ethics: moral principles guiding business decisions', 'CSR: corporate social responsibility to stakeholders', 'Triple bottom line: profit, people, planet', 'Codes of conduct and ethical leadership', 'Whistleblowing: reporting unethical behaviour'] },

  // Economics
  { id: 'econ-macro', subject: 'economics', topic: 'Macroeconomics', description: 'GDP, inflation, unemployment, and economic policy.', keyPoints: ['GDP: total value of goods and services produced in a year', 'GDP = C + I + G + (X - M)', 'Inflation: sustained increase in general price level (CPI measures it)', 'Unemployment types: frictional, structural, seasonal, cyclical', 'Fiscal policy: government spending and taxation', 'Monetary policy: interest rates and money supply (SARB)', 'Budget deficit: government spending > revenue', 'Public debt: total amount government owes'] },
  { id: 'econ-micro', subject: 'economics', topic: 'Microeconomics', description: 'Markets, demand & supply, elasticity, and market failure.', keyPoints: ['Demand: inverse relationship with price (downward sloping curve)', 'Supply: direct relationship with price (upward sloping curve)', 'Equilibrium: where demand = supply', 'Price elasticity of demand: % change Qd / % change P', 'Market structures: perfect competition, monopoly, oligopoly, monopolistic competition', 'Market failure: externalities, public goods, information asymmetry', 'Government intervention: price floors, price ceilings, taxes, subsidies'] },

  // CAT
  { id: 'cat-spreadsheets', subject: 'computer_applications_technology', topic: 'Spreadsheets', description: 'Formulas, functions, charts, and data analysis.', keyPoints: ['Basic formulas: =SUM(), =AVERAGE(), =MIN(), =MAX()', 'COUNT/COUNTA: count cells with numbers/non-empty', 'IF function: =IF(condition, value_if_true, value_if_false)', 'VLOOKUP: =VLOOKUP(value, range, column, match_type)', 'Charts: bar, line, pie — choose based on data type', 'Absolute references: $A$1 (doesn\'t change when copied)', 'Conditional formatting: highlight cells based on rules', 'What-if analysis: Goal Seek, Scenarios'] },
  { id: 'cat-databases', subject: 'computer_applications_technology', topic: 'Databases', description: 'Tables, queries, forms, and reports in databases.', keyPoints: ['Table: stores data in rows (records) and columns (fields)', 'Primary key: unique identifier for each record', 'Query: extracts specific data using criteria', 'Form: user-friendly interface for data entry', 'Report: formatted output for printing/presentation', 'Relationships: one-to-one, one-to-many, many-to-many', 'Referential integrity: ensures related data stays consistent'] },

  // IT
  { id: 'it-programming', subject: 'information_technology', topic: 'Programming', description: 'Algorithms, pseudocode, loops, and data structures.', keyPoints: ['Algorithm: step-by-step solution to a problem', 'Pseudocode: human-readable representation of algorithm', 'Sequence, Selection (if/else), Iteration (loops)', 'FOR loop: known number of iterations', 'WHILE/REPEAT loop: condition-based iteration', 'Arrays: fixed-size collection of same-type elements', 'Procedures and Functions: reusable code blocks', 'String manipulation: length, substring, concatenation'] },
  { id: 'it-sql', subject: 'information_technology', topic: 'Databases & SQL', description: 'Database design, SQL queries, and data integrity.', keyPoints: ['CREATE TABLE, INSERT INTO, SELECT, UPDATE, DELETE', 'SELECT columns FROM table WHERE condition', 'ORDER BY: sort results (ASC/DESC)', 'JOIN: combine data from multiple tables', 'GROUP BY: aggregate data (COUNT, SUM, AVG)', 'HAVING: filter grouped results', 'Primary key, foreign key, referential integrity', 'Normalization: 1NF, 2NF, 3NF to reduce redundancy'] },

  // Agricultural Sciences
  { id: 'agri-soil', subject: 'agricultural_sciences', topic: 'Soil Science', description: 'Soil types, composition, fertility, and conservation.', keyPoints: ['Soil composition: minerals, organic matter, water, air', 'Soil types: sandy (drains fast), clay (holds water), loam (ideal)', 'Soil horizons: O (organic), A (topsoil), B (subsoil), C (parent rock)', 'Soil pH: affects nutrient availability (most crops prefer 6-7)', 'Fertilisers: N (leaf growth), P (root growth), K (fruit/flower)', 'Soil conservation: contour ploughing, terracing, crop rotation', 'Soil erosion: water, wind — remove topsoil'] },
  { id: 'agri-plants', subject: 'agricultural_sciences', topic: 'Plant Production', description: 'Plant anatomy, photosynthesis, crop production, and pest management.', keyPoints: ['Photosynthesis: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ (light energy)', 'Plant parts: roots (absorb), stems (transport), leaves (photosynthesis)', 'Transpiration: water loss through stomata', 'Germination: needs water, oxygen, suitable temperature', 'Crop rotation: alternates crops to maintain soil fertility', 'Pest management: biological, chemical, cultural methods', 'Monoculture vs polyculture farming'] },
  { id: 'agri-animals', subject: 'agricultural_sciences', topic: 'Animal Production', description: 'Animal anatomy, nutrition, breeding, and livestock management.', keyPoints: ['Digestive systems: ruminant (4 stomach chambers) vs monogastric', 'Nutrition: carbohydrates, proteins, fats, vitamins, minerals, water', 'Breeding: natural vs artificial insemination (AI)', 'Selection: choose animals with desired traits for breeding', 'Livestock management: housing, feeding, health, record keeping', 'Poultry: layers (eggs) vs broilers (meat)', 'Dairy: milking procedures, milk quality, mastitis prevention'] },
];

export default function StudyNotes() {
  const [subject, setSubject] = useState<MatricSubject | 'all'>('all');
  const [generating, setGenerating] = useState<string | null>(null);

  const filtered = subject === 'all'
    ? STUDY_NOTES
    : STUDY_NOTES.filter(n => n.subject === subject);

  const subjectsWithNotes = [...new Set(STUDY_NOTES.map(n => n.subject))];

  const generatePDF = async (note: NoteTopic) => {
    setGenerating(note.id);

    try {
      // Generate comprehensive notes using AI
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Generate comprehensive matric study notes for ${SUBJECT_LABELS[note.subject]} on the topic "${note.topic}". 

Include:
1. A clear explanation of all key concepts
2. Important formulas and definitions (where applicable)
3. Step-by-step worked examples
4. Common exam mistakes to avoid
5. Key points to memorize

Format it clearly with headings and bullet points. This is for a South African Grade 12 student preparing for their NSC exams. Be thorough but concise. Use Markdown formatting.`
          }],
          subject: note.subject,
        }),
      });

      const data = await res.json();
      const content = data.text || 'No content generated.';

      // Create downloadable text file
      const blob = new Blob([`# ${note.topic}\n## ${SUBJECT_LABELS[note.subject]}\n\n${content}\n\n---\nGenerated by MatricMind AI`], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${note.topic.replace(/[^a-zA-Z0-9]/g, '_')}_Study_Notes.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Study notes downloaded!');
    } catch (error) {
      console.error('Generate error:', error);
      toast.error('Failed to generate notes. Try again.');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
              <FileText className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Study Notes</h1>
              <p className="text-muted-foreground text-sm">
                Download AI-generated study notes for every topic. Tap "Download Notes" to get comprehensive summaries.
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
            const isGenerating = generating === note.id;

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
                    </div>
                    <CardTitle className="text-base mt-2 leading-tight">{note.topic}</CardTitle>
                    <p className="text-sm text-muted-foreground">{label}</p>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1 flex flex-col">
                    <p className="text-sm text-muted-foreground mb-3">{note.description}</p>

                    {/* Key points preview */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Key Points:</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {note.keyPoints.slice(0, 3).map((point, pi) => (
                          <li key={pi} className="flex items-start gap-1">
                            <span className="text-primary mt-0.5">•</span>
                            <span className="line-clamp-1">{point}</span>
                          </li>
                        ))}
                        {note.keyPoints.length > 3 && (
                          <li className="text-primary">+{note.keyPoints.length - 3} more</li>
                        )}
                      </ul>
                    </div>

                    {/* Actions */}
                    <div className="mt-auto space-y-2">
                      <Button
                        className="w-full"
                        variant="default"
                        size="sm"
                        onClick={() => generatePDF(note)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                        ) : (
                          <><Download className="w-4 h-4 mr-2" /> Download Notes</>
                        )}
                      </Button>
                      <Button
                        className="w-full"
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/tutor?subject=${note.subject}`, '_blank')}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Ask AI Tutor
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
