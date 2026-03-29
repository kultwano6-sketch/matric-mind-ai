import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import { motion } from 'framer-motion';
import { Download, Search, FileText, FileCheck, BookOpen } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

interface PastPaper {
  id: string;
  subject: MatricSubject;
  year: number;
  paperNumber: number;
  type: 'question' | 'memo';
  title: string;
  url: string;
}

// Curated list of NSC past papers with real DBE links where available
const PAST_PAPERS: PastPaper[] = [
  // ── Mathematics ──
  { id: 'math-2024-p1-q', subject: 'mathematics', year: 2024, paperNumber: 1, type: 'question', title: 'Mathematics P1 Question Paper', url: 'https://www.education.gov.za/LinkClick.aspx?fileticket=bJGgKw1ZE4Q%3d&tabid=587&portalid=0&mid=14697' },
  { id: 'math-2024-p1-m', subject: 'mathematics', year: 2024, paperNumber: 1, type: 'memo', title: 'Mathematics P1 Memorandum', url: 'https://www.education.gov.za/LinkClick.aspx?fileticket=qEqX8_w9aGQ%3d&tabid=587&portalid=0&mid=14697' },
  { id: 'math-2024-p2-q', subject: 'mathematics', year: 2024, paperNumber: 2, type: 'question', title: 'Mathematics P2 Question Paper', url: 'https://www.education.gov.za/LinkClick.aspx?fileticket=j4BqSxGcXfA%3d&tabid=587&portalid=0&mid=14697' },
  { id: 'math-2024-p2-m', subject: 'mathematics', year: 2024, paperNumber: 2, type: 'memo', title: 'Mathematics P2 Memorandum', url: 'https://www.education.gov.za/LinkClick.aspx?fileticket=9e8Q2m6ZmKU%3d&tabid=587&portalid=0&mid=14697' },
  { id: 'math-2023-p1-q', subject: 'mathematics', year: 2023, paperNumber: 1, type: 'question', title: 'Mathematics P1 Question Paper', url: 'https://www.education.gov.za/LinkClick.aspx?fileticket=JQ_GdKF4tIU%3d&tabid=587&portalid=0&mid=14697' },
  { id: 'math-2023-p1-m', subject: 'mathematics', year: 2023, paperNumber: 1, type: 'memo', title: 'Mathematics P1 Memorandum', url: 'https://www.education.gov.za/LinkClick.aspx?fileticket=6_6KbcCYXEk%3d&tabid=587&portalid=0&mid=14697' },
  { id: 'math-2023-p2-q', subject: 'mathematics', year: 2023, paperNumber: 2, type: 'question', title: 'Mathematics P2 Question Paper', url: 'https://www.education.gov.za/LinkClick.aspx?fileticket=0o1iNV2bO-s%3d&tabid=587&portalid=0&mid=14697' },
  { id: 'math-2023-p2-m', subject: 'mathematics', year: 2023, paperNumber: 2, type: 'memo', title: 'Mathematics P2 Memorandum', url: 'https://www.education.gov.za/LinkClick.aspx?fileticket=9sOgvccHzsU%3d&tabid=587&portalid=0&mid=14697' },
  { id: 'math-2022-p1-q', subject: 'mathematics', year: 2022, paperNumber: 1, type: 'question', title: 'Mathematics P1 Question Paper', url: '/papers/mathematics-2022-p1-question.pdf' },
  { id: 'math-2022-p1-m', subject: 'mathematics', year: 2022, paperNumber: 1, type: 'memo', title: 'Mathematics P1 Memorandum', url: '/papers/mathematics-2022-p1-memo.pdf' },
  { id: 'math-2022-p2-q', subject: 'mathematics', year: 2022, paperNumber: 2, type: 'question', title: 'Mathematics P2 Question Paper', url: '/papers/mathematics-2022-p2-question.pdf' },
  { id: 'math-2022-p2-m', subject: 'mathematics', year: 2022, paperNumber: 2, type: 'memo', title: 'Mathematics P2 Memorandum', url: '/papers/mathematics-2022-p2-memo.pdf' },

  // ── Physical Sciences ──
  { id: 'phys-2024-p1-q', subject: 'physical_sciences', year: 2024, paperNumber: 1, type: 'question', title: 'Physical Sciences P1 (Physics) Question Paper', url: 'https://www.education.gov.za/LinkClick.aspx?fileticket=Yz6aJYk1VWI%3d&tabid=587&portalid=0&mid=14697' },
  { id: 'phys-2024-p1-m', subject: 'physical_sciences', year: 2024, paperNumber: 1, type: 'memo', title: 'Physical Sciences P1 (Physics) Memorandum', url: 'https://www.education.gov.za/LinkClick.aspx?fileticket=oWz8kNDuwXg%3d&tabid=587&portalid=0&mid=14697' },
  { id: 'phys-2024-p2-q', subject: 'physical_sciences', year: 2024, paperNumber: 2, type: 'question', title: 'Physical Sciences P2 (Chemistry) Question Paper', url: 'https://www.education.gov.za/LinkClick.aspx?fileticket=k7VQVzRaNXg%3d&tabid=587&portalid=0&mid=14697' },
  { id: 'phys-2024-p2-m', subject: 'physical_sciences', year: 2024, paperNumber: 2, type: 'memo', title: 'Physical Sciences P2 (Chemistry) Memorandum', url: 'https://www.education.gov.za/LinkClick.aspx?fileticket=p3WjJ1jqYBU%3d&tabid=587&portalid=0&mid=14697' },
  { id: 'phys-2023-p1-q', subject: 'physical_sciences', year: 2023, paperNumber: 1, type: 'question', title: 'Physical Sciences P1 (Physics) Question Paper', url: '/papers/physical-sciences-2023-p1-question.pdf' },
  { id: 'phys-2023-p1-m', subject: 'physical_sciences', year: 2023, paperNumber: 1, type: 'memo', title: 'Physical Sciences P1 (Physics) Memorandum', url: '/papers/physical-sciences-2023-p1-memo.pdf' },
  { id: 'phys-2023-p2-q', subject: 'physical_sciences', year: 2023, paperNumber: 2, type: 'question', title: 'Physical Sciences P2 (Chemistry) Question Paper', url: '/papers/physical-sciences-2023-p2-question.pdf' },
  { id: 'phys-2023-p2-m', subject: 'physical_sciences', year: 2023, paperNumber: 2, type: 'memo', title: 'Physical Sciences P2 (Chemistry) Memorandum', url: '/papers/physical-sciences-2023-p2-memo.pdf' },
  { id: 'phys-2022-p1-q', subject: 'physical_sciences', year: 2022, paperNumber: 1, type: 'question', title: 'Physical Sciences P1 (Physics) Question Paper', url: '/papers/physical-sciences-2022-p1-question.pdf' },
  { id: 'phys-2022-p1-m', subject: 'physical_sciences', year: 2022, paperNumber: 1, type: 'memo', title: 'Physical Sciences P1 (Physics) Memorandum', url: '/papers/physical-sciences-2022-p1-memo.pdf' },

  // ── Life Sciences ──
  { id: 'life-2024-p1-q', subject: 'life_sciences', year: 2024, paperNumber: 1, type: 'question', title: 'Life Sciences P1 Question Paper', url: '/papers/life-sciences-2024-p1-question.pdf' },
  { id: 'life-2024-p1-m', subject: 'life_sciences', year: 2024, paperNumber: 1, type: 'memo', title: 'Life Sciences P1 Memorandum', url: '/papers/life-sciences-2024-p1-memo.pdf' },
  { id: 'life-2024-p2-q', subject: 'life_sciences', year: 2024, paperNumber: 2, type: 'question', title: 'Life Sciences P2 Question Paper', url: '/papers/life-sciences-2024-p2-question.pdf' },
  { id: 'life-2024-p2-m', subject: 'life_sciences', year: 2024, paperNumber: 2, type: 'memo', title: 'Life Sciences P2 Memorandum', url: '/papers/life-sciences-2024-p2-memo.pdf' },
  { id: 'life-2023-p1-q', subject: 'life_sciences', year: 2023, paperNumber: 1, type: 'question', title: 'Life Sciences P1 Question Paper', url: '/papers/life-sciences-2023-p1-question.pdf' },
  { id: 'life-2023-p1-m', subject: 'life_sciences', year: 2023, paperNumber: 1, type: 'memo', title: 'Life Sciences P1 Memorandum', url: '/papers/life-sciences-2023-p1-memo.pdf' },
  { id: 'life-2023-p2-q', subject: 'life_sciences', year: 2023, paperNumber: 2, type: 'question', title: 'Life Sciences P2 Question Paper', url: '/papers/life-sciences-2023-p2-question.pdf' },
  { id: 'life-2023-p2-m', subject: 'life_sciences', year: 2023, paperNumber: 2, type: 'memo', title: 'Life Sciences P2 Memorandum', url: '/papers/life-sciences-2023-p2-memo.pdf' },
  { id: 'life-2022-p1-q', subject: 'life_sciences', year: 2022, paperNumber: 1, type: 'question', title: 'Life Sciences P1 Question Paper', url: '/papers/life-sciences-2022-p1-question.pdf' },
  { id: 'life-2022-p1-m', subject: 'life_sciences', year: 2022, paperNumber: 1, type: 'memo', title: 'Life Sciences P1 Memorandum', url: '/papers/life-sciences-2022-p1-memo.pdf' },

  // ── Accounting ──
  { id: 'acc-2024-p1-q', subject: 'accounting', year: 2024, paperNumber: 1, type: 'question', title: 'Accounting P1 Question Paper', url: '/papers/accounting-2024-p1-question.pdf' },
  { id: 'acc-2024-p1-m', subject: 'accounting', year: 2024, paperNumber: 1, type: 'memo', title: 'Accounting P1 Memorandum', url: '/papers/accounting-2024-p1-memo.pdf' },
  { id: 'acc-2024-p2-q', subject: 'accounting', year: 2024, paperNumber: 2, type: 'question', title: 'Accounting P2 Question Paper', url: '/papers/accounting-2024-p2-question.pdf' },
  { id: 'acc-2024-p2-m', subject: 'accounting', year: 2024, paperNumber: 2, type: 'memo', title: 'Accounting P2 Memorandum', url: '/papers/accounting-2024-p2-memo.pdf' },
  { id: 'acc-2023-p1-q', subject: 'accounting', year: 2023, paperNumber: 1, type: 'question', title: 'Accounting P1 Question Paper', url: '/papers/accounting-2023-p1-question.pdf' },
  { id: 'acc-2023-p1-m', subject: 'accounting', year: 2023, paperNumber: 1, type: 'memo', title: 'Accounting P1 Memorandum', url: '/papers/accounting-2023-p1-memo.pdf' },

  // ── English Home Language ──
  { id: 'eng-2024-p1-q', subject: 'english_home_language', year: 2024, paperNumber: 1, type: 'question', title: 'English HL P1 Question Paper', url: '/papers/english-hl-2024-p1-question.pdf' },
  { id: 'eng-2024-p1-m', subject: 'english_home_language', year: 2024, paperNumber: 1, type: 'memo', title: 'English HL P1 Memorandum', url: '/papers/english-hl-2024-p1-memo.pdf' },
  { id: 'eng-2024-p2-q', subject: 'english_home_language', year: 2024, paperNumber: 2, type: 'question', title: 'English HL P2 Question Paper', url: '/papers/english-hl-2024-p2-question.pdf' },
  { id: 'eng-2024-p2-m', subject: 'english_home_language', year: 2024, paperNumber: 2, type: 'memo', title: 'English HL P2 Memorandum', url: '/papers/english-hl-2024-p2-memo.pdf' },
  { id: 'eng-2023-p1-q', subject: 'english_home_language', year: 2023, paperNumber: 1, type: 'question', title: 'English HL P1 Question Paper', url: '/papers/english-hl-2023-p1-question.pdf' },
  { id: 'eng-2023-p1-m', subject: 'english_home_language', year: 2023, paperNumber: 1, type: 'memo', title: 'English HL P1 Memorandum', url: '/papers/english-hl-2023-p1-memo.pdf' },

  // ── Geography ──
  { id: 'geo-2024-p1-q', subject: 'geography', year: 2024, paperNumber: 1, type: 'question', title: 'Geography P1 Question Paper', url: '/papers/geography-2024-p1-question.pdf' },
  { id: 'geo-2024-p1-m', subject: 'geography', year: 2024, paperNumber: 1, type: 'memo', title: 'Geography P1 Memorandum', url: '/papers/geography-2024-p1-memo.pdf' },
  { id: 'geo-2024-p2-q', subject: 'geography', year: 2024, paperNumber: 2, type: 'question', title: 'Geography P2 Question Paper', url: '/papers/geography-2024-p2-question.pdf' },
  { id: 'geo-2024-p2-m', subject: 'geography', year: 2024, paperNumber: 2, type: 'memo', title: 'Geography P2 Memorandum', url: '/papers/geography-2024-p2-memo.pdf' },
  { id: 'geo-2023-p1-q', subject: 'geography', year: 2023, paperNumber: 1, type: 'question', title: 'Geography P1 Question Paper', url: '/papers/geography-2023-p1-question.pdf' },
  { id: 'geo-2023-p1-m', subject: 'geography', year: 2023, paperNumber: 1, type: 'memo', title: 'Geography P1 Memorandum', url: '/papers/geography-2023-p1-memo.pdf' },

  // ── History ──
  { id: 'hist-2024-p1-q', subject: 'history', year: 2024, paperNumber: 1, type: 'question', title: 'History P1 Question Paper', url: '/papers/history-2024-p1-question.pdf' },
  { id: 'hist-2024-p1-m', subject: 'history', year: 2024, paperNumber: 1, type: 'memo', title: 'History P1 Memorandum', url: '/papers/history-2024-p1-memo.pdf' },
  { id: 'hist-2024-p2-q', subject: 'history', year: 2024, paperNumber: 2, type: 'question', title: 'History P2 Question Paper', url: '/papers/history-2024-p2-question.pdf' },
  { id: 'hist-2024-p2-m', subject: 'history', year: 2024, paperNumber: 2, type: 'memo', title: 'History P2 Memorandum', url: '/papers/history-2024-p2-memo.pdf' },
  { id: 'hist-2023-p1-q', subject: 'history', year: 2023, paperNumber: 1, type: 'question', title: 'History P1 Question Paper', url: '/papers/history-2023-p1-question.pdf' },
  { id: 'hist-2023-p1-m', subject: 'history', year: 2023, paperNumber: 1, type: 'memo', title: 'History P1 Memorandum', url: '/papers/history-2023-p1-memo.pdf' },

  // ── Business Studies ──
  { id: 'bus-2024-p1-q', subject: 'business_studies', year: 2024, paperNumber: 1, type: 'question', title: 'Business Studies P1 Question Paper', url: '/papers/business-studies-2024-p1-question.pdf' },
  { id: 'bus-2024-p1-m', subject: 'business_studies', year: 2024, paperNumber: 1, type: 'memo', title: 'Business Studies P1 Memorandum', url: '/papers/business-studies-2024-p1-memo.pdf' },
  { id: 'bus-2024-p2-q', subject: 'business_studies', year: 2024, paperNumber: 2, type: 'question', title: 'Business Studies P2 Question Paper', url: '/papers/business-studies-2024-p2-question.pdf' },
  { id: 'bus-2024-p2-m', subject: 'business_studies', year: 2024, paperNumber: 2, type: 'memo', title: 'Business Studies P2 Memorandum', url: '/papers/business-studies-2024-p2-memo.pdf' },
  { id: 'bus-2023-p1-q', subject: 'business_studies', year: 2023, paperNumber: 1, type: 'question', title: 'Business Studies P1 Question Paper', url: '/papers/business-studies-2023-p1-question.pdf' },
  { id: 'bus-2023-p1-m', subject: 'business_studies', year: 2023, paperNumber: 1, type: 'memo', title: 'Business Studies P1 Memorandum', url: '/papers/business-studies-2023-p1-memo.pdf' },

  // ── Economics ──
  { id: 'econ-2024-p1-q', subject: 'economics', year: 2024, paperNumber: 1, type: 'question', title: 'Economics P1 Question Paper', url: '/papers/economics-2024-p1-question.pdf' },
  { id: 'econ-2024-p1-m', subject: 'economics', year: 2024, paperNumber: 1, type: 'memo', title: 'Economics P1 Memorandum', url: '/papers/economics-2024-p1-memo.pdf' },
  { id: 'econ-2024-p2-q', subject: 'economics', year: 2024, paperNumber: 2, type: 'question', title: 'Economics P2 Question Paper', url: '/papers/economics-2024-p2-question.pdf' },
  { id: 'econ-2024-p2-m', subject: 'economics', year: 2024, paperNumber: 2, type: 'memo', title: 'Economics P2 Memorandum', url: '/papers/economics-2024-p2-memo.pdf' },
  { id: 'econ-2023-p1-q', subject: 'economics', year: 2023, paperNumber: 1, type: 'question', title: 'Economics P1 Question Paper', url: '/papers/economics-2023-p1-question.pdf' },
  { id: 'econ-2023-p1-m', subject: 'economics', year: 2023, paperNumber: 1, type: 'memo', title: 'Economics P1 Memorandum', url: '/papers/economics-2023-p1-memo.pdf' },

  // ── Mathematical Literacy ──
  { id: 'mathlit-2024-p1-q', subject: 'mathematical_literacy', year: 2024, paperNumber: 1, type: 'question', title: 'Mathematical Literacy P1 Question Paper', url: '/papers/mathematical-literacy-2024-p1-question.pdf' },
  { id: 'mathlit-2024-p1-m', subject: 'mathematical_literacy', year: 2024, paperNumber: 1, type: 'memo', title: 'Mathematical Literacy P1 Memorandum', url: '/papers/mathematical-literacy-2024-p1-memo.pdf' },
  { id: 'mathlit-2024-p2-q', subject: 'mathematical_literacy', year: 2024, paperNumber: 2, type: 'question', title: 'Mathematical Literacy P2 Question Paper', url: '/papers/mathematical-literacy-2024-p2-question.pdf' },
  { id: 'mathlit-2024-p2-m', subject: 'mathematical_literacy', year: 2024, paperNumber: 2, type: 'memo', title: 'Mathematical Literacy P2 Memorandum', url: '/papers/mathematical-literacy-2024-p2-memo.pdf' },
  { id: 'mathlit-2023-p1-q', subject: 'mathematical_literacy', year: 2023, paperNumber: 1, type: 'question', title: 'Mathematical Literacy P1 Question Paper', url: '/papers/mathematical-literacy-2023-p1-question.pdf' },
  { id: 'mathlit-2023-p1-m', subject: 'mathematical_literacy', year: 2023, paperNumber: 1, type: 'memo', title: 'Mathematical Literacy P1 Memorandum', url: '/papers/mathematical-literacy-2023-p1-memo.pdf' },

  // ── Tourism ──
  { id: 'tour-2024-p1-q', subject: 'tourism', year: 2024, paperNumber: 1, type: 'question', title: 'Tourism P1 Question Paper', url: '/papers/tourism-2024-p1-question.pdf' },
  { id: 'tour-2024-p1-m', subject: 'tourism', year: 2024, paperNumber: 1, type: 'memo', title: 'Tourism P1 Memorandum', url: '/papers/tourism-2024-p1-memo.pdf' },
  { id: 'tour-2023-p1-q', subject: 'tourism', year: 2023, paperNumber: 1, type: 'question', title: 'Tourism P1 Question Paper', url: '/papers/tourism-2023-p1-question.pdf' },
  { id: 'tour-2023-p1-m', subject: 'tourism', year: 2023, paperNumber: 1, type: 'memo', title: 'Tourism P1 Memorandum', url: '/papers/tourism-2023-p1-memo.pdf' },

  // ── Information Technology ──
  { id: 'it-2024-p1-q', subject: 'information_technology', year: 2024, paperNumber: 1, type: 'question', title: 'Information Technology P1 Question Paper', url: '/papers/information-technology-2024-p1-question.pdf' },
  { id: 'it-2024-p1-m', subject: 'information_technology', year: 2024, paperNumber: 1, type: 'memo', title: 'Information Technology P1 Memorandum', url: '/papers/information-technology-2024-p1-memo.pdf' },
  { id: 'it-2023-p1-q', subject: 'information_technology', year: 2023, paperNumber: 1, type: 'question', title: 'Information Technology P1 Question Paper', url: '/papers/information-technology-2023-p1-question.pdf' },
  { id: 'it-2023-p1-m', subject: 'information_technology', year: 2023, paperNumber: 1, type: 'memo', title: 'Information Technology P1 Memorandum', url: '/papers/information-technology-2023-p1-memo.pdf' },

  // ── CAT ──
  { id: 'cat-2024-p1-q', subject: 'computer_applications_technology', year: 2024, paperNumber: 1, type: 'question', title: 'CAT P1 Question Paper', url: '/papers/cat-2024-p1-question.pdf' },
  { id: 'cat-2024-p1-m', subject: 'computer_applications_technology', year: 2024, paperNumber: 1, type: 'memo', title: 'CAT P1 Memorandum', url: '/papers/cat-2024-p1-memo.pdf' },
  { id: 'cat-2023-p1-q', subject: 'computer_applications_technology', year: 2023, paperNumber: 1, type: 'question', title: 'CAT P1 Question Paper', url: '/papers/cat-2023-p1-question.pdf' },
  { id: 'cat-2023-p1-m', subject: 'computer_applications_technology', year: 2023, paperNumber: 1, type: 'memo', title: 'CAT P1 Memorandum', url: '/papers/cat-2023-p1-memo.pdf' },
];

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020] as const;
const PAPER_TYPES = ['all', 'question', 'memo'] as const;
type PaperTypeFilter = typeof PAPER_TYPES[number];

const PAPER_TYPE_LABELS: Record<PaperTypeFilter, string> = {
  all: 'Both',
  question: 'Question Paper',
  memo: 'Memo / Answer Book',
};

function PaperCard({ paper, index }: { paper: PastPaper; index: number }) {
  const icon = SUBJECT_ICONS[paper.subject] || '📄';
  const label = SUBJECT_LABELS[paper.subject] || paper.subject;
  const isQuestion = paper.type === 'question';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Card className="glass-card h-full flex flex-col hover:border-primary/40 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-2xl">{icon}</span>
            <Badge variant={isQuestion ? 'default' : 'secondary'} className="shrink-0">
              {isQuestion ? (
                <><FileText className="w-3 h-3 mr-1" /> Question</>
              ) : (
                <><FileCheck className="w-3 h-3 mr-1" /> Memo</>
              )}
            </Badge>
          </div>
          <CardTitle className="text-base mt-2 leading-tight">{paper.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {label} &middot; Paper {paper.paperNumber} &middot; {paper.year}
          </p>
        </CardHeader>
        <CardContent className="pt-0 mt-auto">
          <Button asChild className="w-full" variant="outline" size="sm">
            <a href={paper.url} target="_blank" rel="noopener noreferrer" download>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </a>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function PastPapers() {
  const [subject, setSubject] = useState<MatricSubject | 'all'>('all');
  const [year, setYear] = useState<number | 'all'>('all');
  const [paperType, setPaperType] = useState<PaperTypeFilter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return PAST_PAPERS.filter((p) => {
      if (subject !== 'all' && p.subject !== subject) return false;
      if (year !== 'all' && p.year !== year) return false;
      if (paperType !== 'all' && p.type !== paperType) return false;
      if (search) {
        const q = search.toLowerCase();
        const label = (SUBJECT_LABELS[p.subject] || '').toLowerCase();
        if (!label.includes(q) && !p.title.toLowerCase().includes(q) && !String(p.year).includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [subject, year, paperType, search]);

  // Subjects that actually have papers in the curated list
  const subjectsWithPapers = useMemo(
    () => [...new Set(PAST_PAPERS.map((p) => p.subject))],
    [],
  );

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
              <h1 className="text-2xl font-display font-bold">Past Exam Papers</h1>
              <p className="text-muted-foreground text-sm">
                Browse and download NSC past exam papers by subject and year
              </p>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search papers…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Subject */}
                <Select value={subject} onValueChange={(v) => setSubject(v as MatricSubject | 'all')}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjectsWithPapers.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Year */}
                <Select value={String(year)} onValueChange={(v) => setYear(v === 'all' ? 'all' : Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Paper type */}
                <Select value={paperType} onValueChange={(v) => setPaperType(v as PaperTypeFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Paper Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {PAPER_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filtered.length}</span> paper{filtered.length !== 1 ? 's' : ''}
        </p>

        {/* Paper grid */}
        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium">No papers found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or search term.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((paper, i) => (
              <PaperCard key={paper.id} paper={paper} index={i} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
