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

// Curated list of NSC past papers
// Links point to the DBE past papers hub for reliable access
const DBE_PAPERS_HUB = 'https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/NSCPastExaminationpapers.aspx';

const PAST_PAPERS: PastPaper[] = [
  // ── Mathematics ──
  { id: 'math-2024-p1-q', subject: 'mathematics', year: 2024, paperNumber: 1, type: 'question', title: 'Mathematics P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'math-2024-p1-m', subject: 'mathematics', year: 2024, paperNumber: 1, type: 'memo', title: 'Mathematics P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'math-2024-p2-q', subject: 'mathematics', year: 2024, paperNumber: 2, type: 'question', title: 'Mathematics P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'math-2024-p2-m', subject: 'mathematics', year: 2024, paperNumber: 2, type: 'memo', title: 'Mathematics P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'math-2023-p1-q', subject: 'mathematics', year: 2023, paperNumber: 1, type: 'question', title: 'Mathematics P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'math-2023-p1-m', subject: 'mathematics', year: 2023, paperNumber: 1, type: 'memo', title: 'Mathematics P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'math-2023-p2-q', subject: 'mathematics', year: 2023, paperNumber: 2, type: 'question', title: 'Mathematics P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'math-2023-p2-m', subject: 'mathematics', year: 2023, paperNumber: 2, type: 'memo', title: 'Mathematics P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'math-2022-p1-q', subject: 'mathematics', year: 2022, paperNumber: 1, type: 'question', title: 'Mathematics P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'math-2022-p1-m', subject: 'mathematics', year: 2022, paperNumber: 1, type: 'memo', title: 'Mathematics P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'math-2022-p2-q', subject: 'mathematics', year: 2022, paperNumber: 2, type: 'question', title: 'Mathematics P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'math-2022-p2-m', subject: 'mathematics', year: 2022, paperNumber: 2, type: 'memo', title: 'Mathematics P2 Memorandum', url: DBE_PAPERS_HUB },

  // ── Physical Sciences ──
  { id: 'phys-2024-p1-q', subject: 'physical_sciences', year: 2024, paperNumber: 1, type: 'question', title: 'Physical Sciences P1 (Physics) Question Paper', url: DBE_PAPERS_HUB },
  { id: 'phys-2024-p1-m', subject: 'physical_sciences', year: 2024, paperNumber: 1, type: 'memo', title: 'Physical Sciences P1 (Physics) Memorandum', url: DBE_PAPERS_HUB },
  { id: 'phys-2024-p2-q', subject: 'physical_sciences', year: 2024, paperNumber: 2, type: 'question', title: 'Physical Sciences P2 (Chemistry) Question Paper', url: DBE_PAPERS_HUB },
  { id: 'phys-2024-p2-m', subject: 'physical_sciences', year: 2024, paperNumber: 2, type: 'memo', title: 'Physical Sciences P2 (Chemistry) Memorandum', url: DBE_PAPERS_HUB },
  { id: 'phys-2023-p1-q', subject: 'physical_sciences', year: 2023, paperNumber: 1, type: 'question', title: 'Physical Sciences P1 (Physics) Question Paper', url: DBE_PAPERS_HUB },
  { id: 'phys-2023-p1-m', subject: 'physical_sciences', year: 2023, paperNumber: 1, type: 'memo', title: 'Physical Sciences P1 (Physics) Memorandum', url: DBE_PAPERS_HUB },
  { id: 'phys-2023-p2-q', subject: 'physical_sciences', year: 2023, paperNumber: 2, type: 'question', title: 'Physical Sciences P2 (Chemistry) Question Paper', url: DBE_PAPERS_HUB },
  { id: 'phys-2023-p2-m', subject: 'physical_sciences', year: 2023, paperNumber: 2, type: 'memo', title: 'Physical Sciences P2 (Chemistry) Memorandum', url: DBE_PAPERS_HUB },
  { id: 'phys-2022-p1-q', subject: 'physical_sciences', year: 2022, paperNumber: 1, type: 'question', title: 'Physical Sciences P1 (Physics) Question Paper', url: DBE_PAPERS_HUB },
  { id: 'phys-2022-p1-m', subject: 'physical_sciences', year: 2022, paperNumber: 1, type: 'memo', title: 'Physical Sciences P1 (Physics) Memorandum', url: DBE_PAPERS_HUB },

  // ── Life Sciences ──
  { id: 'life-2024-p1-q', subject: 'life_sciences', year: 2024, paperNumber: 1, type: 'question', title: 'Life Sciences P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'life-2024-p1-m', subject: 'life_sciences', year: 2024, paperNumber: 1, type: 'memo', title: 'Life Sciences P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'life-2024-p2-q', subject: 'life_sciences', year: 2024, paperNumber: 2, type: 'question', title: 'Life Sciences P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'life-2024-p2-m', subject: 'life_sciences', year: 2024, paperNumber: 2, type: 'memo', title: 'Life Sciences P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'life-2023-p1-q', subject: 'life_sciences', year: 2023, paperNumber: 1, type: 'question', title: 'Life Sciences P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'life-2023-p1-m', subject: 'life_sciences', year: 2023, paperNumber: 1, type: 'memo', title: 'Life Sciences P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'life-2023-p2-q', subject: 'life_sciences', year: 2023, paperNumber: 2, type: 'question', title: 'Life Sciences P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'life-2023-p2-m', subject: 'life_sciences', year: 2023, paperNumber: 2, type: 'memo', title: 'Life Sciences P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'life-2022-p1-q', subject: 'life_sciences', year: 2022, paperNumber: 1, type: 'question', title: 'Life Sciences P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'life-2022-p1-m', subject: 'life_sciences', year: 2022, paperNumber: 1, type: 'memo', title: 'Life Sciences P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Accounting ──
  { id: 'acc-2024-p1-q', subject: 'accounting', year: 2024, paperNumber: 1, type: 'question', title: 'Accounting P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'acc-2024-p1-m', subject: 'accounting', year: 2024, paperNumber: 1, type: 'memo', title: 'Accounting P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'acc-2024-p2-q', subject: 'accounting', year: 2024, paperNumber: 2, type: 'question', title: 'Accounting P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'acc-2024-p2-m', subject: 'accounting', year: 2024, paperNumber: 2, type: 'memo', title: 'Accounting P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'acc-2023-p1-q', subject: 'accounting', year: 2023, paperNumber: 1, type: 'question', title: 'Accounting P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'acc-2023-p1-m', subject: 'accounting', year: 2023, paperNumber: 1, type: 'memo', title: 'Accounting P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── English Home Language ──
  { id: 'eng-2024-p1-q', subject: 'english_home_language', year: 2024, paperNumber: 1, type: 'question', title: 'English HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'eng-2024-p1-m', subject: 'english_home_language', year: 2024, paperNumber: 1, type: 'memo', title: 'English HL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'eng-2024-p2-q', subject: 'english_home_language', year: 2024, paperNumber: 2, type: 'question', title: 'English HL P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'eng-2024-p2-m', subject: 'english_home_language', year: 2024, paperNumber: 2, type: 'memo', title: 'English HL P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'eng-2023-p1-q', subject: 'english_home_language', year: 2023, paperNumber: 1, type: 'question', title: 'English HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'eng-2023-p1-m', subject: 'english_home_language', year: 2023, paperNumber: 1, type: 'memo', title: 'English HL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Geography ──
  { id: 'geo-2024-p1-q', subject: 'geography', year: 2024, paperNumber: 1, type: 'question', title: 'Geography P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'geo-2024-p1-m', subject: 'geography', year: 2024, paperNumber: 1, type: 'memo', title: 'Geography P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'geo-2024-p2-q', subject: 'geography', year: 2024, paperNumber: 2, type: 'question', title: 'Geography P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'geo-2024-p2-m', subject: 'geography', year: 2024, paperNumber: 2, type: 'memo', title: 'Geography P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'geo-2023-p1-q', subject: 'geography', year: 2023, paperNumber: 1, type: 'question', title: 'Geography P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'geo-2023-p1-m', subject: 'geography', year: 2023, paperNumber: 1, type: 'memo', title: 'Geography P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── History ──
  { id: 'hist-2024-p1-q', subject: 'history', year: 2024, paperNumber: 1, type: 'question', title: 'History P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'hist-2024-p1-m', subject: 'history', year: 2024, paperNumber: 1, type: 'memo', title: 'History P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'hist-2024-p2-q', subject: 'history', year: 2024, paperNumber: 2, type: 'question', title: 'History P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'hist-2024-p2-m', subject: 'history', year: 2024, paperNumber: 2, type: 'memo', title: 'History P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'hist-2023-p1-q', subject: 'history', year: 2023, paperNumber: 1, type: 'question', title: 'History P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'hist-2023-p1-m', subject: 'history', year: 2023, paperNumber: 1, type: 'memo', title: 'History P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Business Studies ──
  { id: 'bus-2024-p1-q', subject: 'business_studies', year: 2024, paperNumber: 1, type: 'question', title: 'Business Studies P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'bus-2024-p1-m', subject: 'business_studies', year: 2024, paperNumber: 1, type: 'memo', title: 'Business Studies P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'bus-2024-p2-q', subject: 'business_studies', year: 2024, paperNumber: 2, type: 'question', title: 'Business Studies P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'bus-2024-p2-m', subject: 'business_studies', year: 2024, paperNumber: 2, type: 'memo', title: 'Business Studies P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'bus-2023-p1-q', subject: 'business_studies', year: 2023, paperNumber: 1, type: 'question', title: 'Business Studies P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'bus-2023-p1-m', subject: 'business_studies', year: 2023, paperNumber: 1, type: 'memo', title: 'Business Studies P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Economics ──
  { id: 'econ-2024-p1-q', subject: 'economics', year: 2024, paperNumber: 1, type: 'question', title: 'Economics P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'econ-2024-p1-m', subject: 'economics', year: 2024, paperNumber: 1, type: 'memo', title: 'Economics P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'econ-2024-p2-q', subject: 'economics', year: 2024, paperNumber: 2, type: 'question', title: 'Economics P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'econ-2024-p2-m', subject: 'economics', year: 2024, paperNumber: 2, type: 'memo', title: 'Economics P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'econ-2023-p1-q', subject: 'economics', year: 2023, paperNumber: 1, type: 'question', title: 'Economics P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'econ-2023-p1-m', subject: 'economics', year: 2023, paperNumber: 1, type: 'memo', title: 'Economics P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Mathematical Literacy ──
  { id: 'mathlit-2024-p1-q', subject: 'mathematical_literacy', year: 2024, paperNumber: 1, type: 'question', title: 'Mathematical Literacy P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'mathlit-2024-p1-m', subject: 'mathematical_literacy', year: 2024, paperNumber: 1, type: 'memo', title: 'Mathematical Literacy P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'mathlit-2024-p2-q', subject: 'mathematical_literacy', year: 2024, paperNumber: 2, type: 'question', title: 'Mathematical Literacy P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'mathlit-2024-p2-m', subject: 'mathematical_literacy', year: 2024, paperNumber: 2, type: 'memo', title: 'Mathematical Literacy P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'mathlit-2023-p1-q', subject: 'mathematical_literacy', year: 2023, paperNumber: 1, type: 'question', title: 'Mathematical Literacy P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'mathlit-2023-p1-m', subject: 'mathematical_literacy', year: 2023, paperNumber: 1, type: 'memo', title: 'Mathematical Literacy P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Tourism ──
  { id: 'tour-2024-p1-q', subject: 'tourism', year: 2024, paperNumber: 1, type: 'question', title: 'Tourism P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'tour-2024-p1-m', subject: 'tourism', year: 2024, paperNumber: 1, type: 'memo', title: 'Tourism P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'tour-2023-p1-q', subject: 'tourism', year: 2023, paperNumber: 1, type: 'question', title: 'Tourism P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'tour-2023-p1-m', subject: 'tourism', year: 2023, paperNumber: 1, type: 'memo', title: 'Tourism P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Information Technology ──
  { id: 'it-2024-p1-q', subject: 'information_technology', year: 2024, paperNumber: 1, type: 'question', title: 'Information Technology P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'it-2024-p1-m', subject: 'information_technology', year: 2024, paperNumber: 1, type: 'memo', title: 'Information Technology P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'it-2023-p1-q', subject: 'information_technology', year: 2023, paperNumber: 1, type: 'question', title: 'Information Technology P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'it-2023-p1-m', subject: 'information_technology', year: 2023, paperNumber: 1, type: 'memo', title: 'Information Technology P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── CAT ──
  { id: 'cat-2024-p1-q', subject: 'computer_applications_technology', year: 2024, paperNumber: 1, type: 'question', title: 'CAT P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'cat-2024-p1-m', subject: 'computer_applications_technology', year: 2024, paperNumber: 1, type: 'memo', title: 'CAT P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'cat-2023-p1-q', subject: 'computer_applications_technology', year: 2023, paperNumber: 1, type: 'question', title: 'CAT P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'cat-2023-p1-m', subject: 'computer_applications_technology', year: 2023, paperNumber: 1, type: 'memo', title: 'CAT P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Agricultural Sciences ──
  { id: 'agri-2024-p1-q', subject: 'agricultural_sciences', year: 2024, paperNumber: 1, type: 'question', title: 'Agricultural Sciences P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'agri-2024-p1-m', subject: 'agricultural_sciences', year: 2024, paperNumber: 1, type: 'memo', title: 'Agricultural Sciences P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'agri-2024-p2-q', subject: 'agricultural_sciences', year: 2024, paperNumber: 2, type: 'question', title: 'Agricultural Sciences P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'agri-2024-p2-m', subject: 'agricultural_sciences', year: 2024, paperNumber: 2, type: 'memo', title: 'Agricultural Sciences P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'agri-2023-p1-q', subject: 'agricultural_sciences', year: 2023, paperNumber: 1, type: 'question', title: 'Agricultural Sciences P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'agri-2023-p1-m', subject: 'agricultural_sciences', year: 2023, paperNumber: 1, type: 'memo', title: 'Agricultural Sciences P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'agri-2023-p2-q', subject: 'agricultural_sciences', year: 2023, paperNumber: 2, type: 'question', title: 'Agricultural Sciences P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'agri-2023-p2-m', subject: 'agricultural_sciences', year: 2023, paperNumber: 2, type: 'memo', title: 'Agricultural Sciences P2 Memorandum', url: DBE_PAPERS_HUB },

  // ── English First Additional ──
  { id: 'engfal-2024-p1-q', subject: 'english_first_additional', year: 2024, paperNumber: 1, type: 'question', title: 'English FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'engfal-2024-p1-m', subject: 'english_first_additional', year: 2024, paperNumber: 1, type: 'memo', title: 'English FAL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'engfal-2024-p2-q', subject: 'english_first_additional', year: 2024, paperNumber: 2, type: 'question', title: 'English FAL P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'engfal-2024-p2-m', subject: 'english_first_additional', year: 2024, paperNumber: 2, type: 'memo', title: 'English FAL P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'engfal-2023-p1-q', subject: 'english_first_additional', year: 2023, paperNumber: 1, type: 'question', title: 'English FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'engfal-2023-p1-m', subject: 'english_first_additional', year: 2023, paperNumber: 1, type: 'memo', title: 'English FAL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Afrikaans Home Language ──
  { id: 'afrhl-2024-p1-q', subject: 'afrikaans_home_language', year: 2024, paperNumber: 1, type: 'question', title: 'Afrikaans HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'afrhl-2024-p1-m', subject: 'afrikaans_home_language', year: 2024, paperNumber: 1, type: 'memo', title: 'Afrikaans HL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'afrhl-2024-p2-q', subject: 'afrikaans_home_language', year: 2024, paperNumber: 2, type: 'question', title: 'Afrikaans HL P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'afrhl-2024-p2-m', subject: 'afrikaans_home_language', year: 2024, paperNumber: 2, type: 'memo', title: 'Afrikaans HL P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'afrhl-2023-p1-q', subject: 'afrikaans_home_language', year: 2023, paperNumber: 1, type: 'question', title: 'Afrikaans HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'afrhl-2023-p1-m', subject: 'afrikaans_home_language', year: 2023, paperNumber: 1, type: 'memo', title: 'Afrikaans HL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Afrikaans First Additional ──
  { id: 'afrfal-2024-p1-q', subject: 'afrikaans_first_additional', year: 2024, paperNumber: 1, type: 'question', title: 'Afrikaans FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'afrfal-2024-p1-m', subject: 'afrikaans_first_additional', year: 2024, paperNumber: 1, type: 'memo', title: 'Afrikaans FAL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'afrfal-2023-p1-q', subject: 'afrikaans_first_additional', year: 2023, paperNumber: 1, type: 'question', title: 'Afrikaans FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'afrfal-2023-p1-m', subject: 'afrikaans_first_additional', year: 2023, paperNumber: 1, type: 'memo', title: 'Afrikaans FAL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── isiZulu Home Language ──
  { id: 'zulhl-2024-p1-q', subject: 'isizulu_home_language', year: 2024, paperNumber: 1, type: 'question', title: 'isiZulu HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'zulhl-2024-p1-m', subject: 'isizulu_home_language', year: 2024, paperNumber: 1, type: 'memo', title: 'isiZulu HL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'zulhl-2024-p2-q', subject: 'isizulu_home_language', year: 2024, paperNumber: 2, type: 'question', title: 'isiZulu HL P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'zulhl-2024-p2-m', subject: 'isizulu_home_language', year: 2024, paperNumber: 2, type: 'memo', title: 'isiZulu HL P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'zulhl-2023-p1-q', subject: 'isizulu_home_language', year: 2023, paperNumber: 1, type: 'question', title: 'isiZulu HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'zulhl-2023-p1-m', subject: 'isizulu_home_language', year: 2023, paperNumber: 1, type: 'memo', title: 'isiZulu HL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── isiZulu First Additional ──
  { id: 'zulfal-2024-p1-q', subject: 'isizulu_first_additional', year: 2024, paperNumber: 1, type: 'question', title: 'isiZulu FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'zulfal-2024-p1-m', subject: 'isizulu_first_additional', year: 2024, paperNumber: 1, type: 'memo', title: 'isiZulu FAL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'zulfal-2023-p1-q', subject: 'isizulu_first_additional', year: 2023, paperNumber: 1, type: 'question', title: 'isiZulu FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'zulfal-2023-p1-m', subject: 'isizulu_first_additional', year: 2023, paperNumber: 1, type: 'memo', title: 'isiZulu FAL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── isiXhosa Home Language ──
  { id: 'xoshl-2024-p1-q', subject: 'isixhosa_home_language', year: 2024, paperNumber: 1, type: 'question', title: 'isiXhosa HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'xoshl-2024-p1-m', subject: 'isixhosa_home_language', year: 2024, paperNumber: 1, type: 'memo', title: 'isiXhosa HL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'xoshl-2024-p2-q', subject: 'isixhosa_home_language', year: 2024, paperNumber: 2, type: 'question', title: 'isiXhosa HL P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'xoshl-2024-p2-m', subject: 'isixhosa_home_language', year: 2024, paperNumber: 2, type: 'memo', title: 'isiXhosa HL P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'xoshl-2023-p1-q', subject: 'isixhosa_home_language', year: 2023, paperNumber: 1, type: 'question', title: 'isiXhosa HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'xoshl-2023-p1-m', subject: 'isixhosa_home_language', year: 2023, paperNumber: 1, type: 'memo', title: 'isiXhosa HL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── isiXhosa First Additional ──
  { id: 'xosfal-2024-p1-q', subject: 'isixhosa_first_additional', year: 2024, paperNumber: 1, type: 'question', title: 'isiXhosa FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'xosfal-2024-p1-m', subject: 'isixhosa_first_additional', year: 2024, paperNumber: 1, type: 'memo', title: 'isiXhosa FAL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'xosfal-2023-p1-q', subject: 'isixhosa_first_additional', year: 2023, paperNumber: 1, type: 'question', title: 'isiXhosa FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'xosfal-2023-p1-m', subject: 'isixhosa_first_additional', year: 2023, paperNumber: 1, type: 'memo', title: 'isiXhosa FAL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Sepedi Home Language ──
  { id: 'sedhl-2024-p1-q', subject: 'sepedi_home_language', year: 2024, paperNumber: 1, type: 'question', title: 'Sepedi HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'sedhl-2024-p1-m', subject: 'sepedi_home_language', year: 2024, paperNumber: 1, type: 'memo', title: 'Sepedi HL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'sedhl-2024-p2-q', subject: 'sepedi_home_language', year: 2024, paperNumber: 2, type: 'question', title: 'Sepedi HL P2 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'sedhl-2024-p2-m', subject: 'sepedi_home_language', year: 2024, paperNumber: 2, type: 'memo', title: 'Sepedi HL P2 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'sedhl-2023-p1-q', subject: 'sepedi_home_language', year: 2023, paperNumber: 1, type: 'question', title: 'Sepedi HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'sedhl-2023-p1-m', subject: 'sepedi_home_language', year: 2023, paperNumber: 1, type: 'memo', title: 'Sepedi HL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Sepedi First Additional ──
  { id: 'sedfal-2024-p1-q', subject: 'sepedi_first_additional', year: 2024, paperNumber: 1, type: 'question', title: 'Sepedi FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'sedfal-2024-p1-m', subject: 'sepedi_first_additional', year: 2024, paperNumber: 1, type: 'memo', title: 'Sepedi FAL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'sedfal-2023-p1-q', subject: 'sepedi_first_additional', year: 2023, paperNumber: 1, type: 'question', title: 'Sepedi FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'sedfal-2023-p1-m', subject: 'sepedi_first_additional', year: 2023, paperNumber: 1, type: 'memo', title: 'Sepedi FAL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Setswana Home Language ──
  { id: 'tswhl-2024-p1-q', subject: 'setswana_home_language', year: 2024, paperNumber: 1, type: 'question', title: 'Setswana HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'tswhl-2024-p1-m', subject: 'setswana_home_language', year: 2024, paperNumber: 1, type: 'memo', title: 'Setswana HL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'tswhl-2023-p1-q', subject: 'setswana_home_language', year: 2023, paperNumber: 1, type: 'question', title: 'Setswana HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'tswhl-2023-p1-m', subject: 'setswana_home_language', year: 2023, paperNumber: 1, type: 'memo', title: 'Setswana HL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Setswana First Additional ──
  { id: 'tswfal-2024-p1-q', subject: 'setswana_first_additional', year: 2024, paperNumber: 1, type: 'question', title: 'Setswana FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'tswfal-2024-p1-m', subject: 'setswana_first_additional', year: 2024, paperNumber: 1, type: 'memo', title: 'Setswana FAL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'tswfal-2023-p1-q', subject: 'setswana_first_additional', year: 2023, paperNumber: 1, type: 'question', title: 'Setswana FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'tswfal-2023-p1-m', subject: 'setswana_first_additional', year: 2023, paperNumber: 1, type: 'memo', title: 'Setswana FAL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Sesotho Home Language ──
  { id: 'sothl-2024-p1-q', subject: 'sesotho_home_language', year: 2024, paperNumber: 1, type: 'question', title: 'Sesotho HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'sothl-2024-p1-m', subject: 'sesotho_home_language', year: 2024, paperNumber: 1, type: 'memo', title: 'Sesotho HL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'sothl-2023-p1-q', subject: 'sesotho_home_language', year: 2023, paperNumber: 1, type: 'question', title: 'Sesotho HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'sothl-2023-p1-m', subject: 'sesotho_home_language', year: 2023, paperNumber: 1, type: 'memo', title: 'Sesotho HL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Sesotho First Additional ──
  { id: 'sotfal-2024-p1-q', subject: 'sesotho_first_additional', year: 2024, paperNumber: 1, type: 'question', title: 'Sesotho FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'sotfal-2024-p1-m', subject: 'sesotho_first_additional', year: 2024, paperNumber: 1, type: 'memo', title: 'Sesotho FAL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'sotfal-2023-p1-q', subject: 'sesotho_first_additional', year: 2023, paperNumber: 1, type: 'question', title: 'Sesotho FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'sotfal-2023-p1-m', subject: 'sesotho_first_additional', year: 2023, paperNumber: 1, type: 'memo', title: 'Sesotho FAL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── siSwati ──
  { id: 'swhl-2024-p1-q', subject: 'siswati_home_language', year: 2024, paperNumber: 1, type: 'question', title: 'siSwati HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'swhl-2024-p1-m', subject: 'siswati_home_language', year: 2024, paperNumber: 1, type: 'memo', title: 'siSwati HL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'swhl-2023-p1-q', subject: 'siswati_home_language', year: 2023, paperNumber: 1, type: 'question', title: 'siSwati HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'swhl-2023-p1-m', subject: 'siswati_home_language', year: 2023, paperNumber: 1, type: 'memo', title: 'siSwati HL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'swfal-2024-p1-q', subject: 'siswati_first_additional', year: 2024, paperNumber: 1, type: 'question', title: 'siSwati FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'swfal-2024-p1-m', subject: 'siswati_first_additional', year: 2024, paperNumber: 1, type: 'memo', title: 'siSwati FAL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── isiNdebele ──
  { id: 'ndhl-2024-p1-q', subject: 'isindebele_home_language', year: 2024, paperNumber: 1, type: 'question', title: 'isiNdebele HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'ndhl-2024-p1-m', subject: 'isindebele_home_language', year: 2024, paperNumber: 1, type: 'memo', title: 'isiNdebele HL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'ndhl-2023-p1-q', subject: 'isindebele_home_language', year: 2023, paperNumber: 1, type: 'question', title: 'isiNdebele HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'ndhl-2023-p1-m', subject: 'isindebele_home_language', year: 2023, paperNumber: 1, type: 'memo', title: 'isiNdebele HL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'ndfal-2024-p1-q', subject: 'isindebele_first_additional', year: 2024, paperNumber: 1, type: 'question', title: 'isiNdebele FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'ndfal-2024-p1-m', subject: 'isindebele_first_additional', year: 2024, paperNumber: 1, type: 'memo', title: 'isiNdebele FAL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Xitsonga ──
  { id: 'tsohl-2024-p1-q', subject: 'xitsonga_home_language', year: 2024, paperNumber: 1, type: 'question', title: 'Xitsonga HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'tsohl-2024-p1-m', subject: 'xitsonga_home_language', year: 2024, paperNumber: 1, type: 'memo', title: 'Xitsonga HL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'tsohl-2023-p1-q', subject: 'xitsonga_home_language', year: 2023, paperNumber: 1, type: 'question', title: 'Xitsonga HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'tsohl-2023-p1-m', subject: 'xitsonga_home_language', year: 2023, paperNumber: 1, type: 'memo', title: 'Xitsonga HL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'tsofal-2024-p1-q', subject: 'xitsonga_first_additional', year: 2024, paperNumber: 1, type: 'question', title: 'Xitsonga FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'tsofal-2024-p1-m', subject: 'xitsonga_first_additional', year: 2024, paperNumber: 1, type: 'memo', title: 'Xitsonga FAL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Tshivenda ──
  { id: 'venhl-2024-p1-q', subject: 'tshivenda_home_language', year: 2024, paperNumber: 1, type: 'question', title: 'Tshivenda HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'venhl-2024-p1-m', subject: 'tshivenda_home_language', year: 2024, paperNumber: 1, type: 'memo', title: 'Tshivenda HL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'venhl-2023-p1-q', subject: 'tshivenda_home_language', year: 2023, paperNumber: 1, type: 'question', title: 'Tshivenda HL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'venhl-2023-p1-m', subject: 'tshivenda_home_language', year: 2023, paperNumber: 1, type: 'memo', title: 'Tshivenda HL P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'venfal-2024-p1-q', subject: 'tshivenda_first_additional', year: 2024, paperNumber: 1, type: 'question', title: 'Tshivenda FAL P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'venfal-2024-p1-m', subject: 'tshivenda_first_additional', year: 2024, paperNumber: 1, type: 'memo', title: 'Tshivenda FAL P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Life Orientation ──
  { id: 'lo-2024-p1-q', subject: 'life_orientation', year: 2024, paperNumber: 1, type: 'question', title: 'Life Orientation P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'lo-2024-p1-m', subject: 'life_orientation', year: 2024, paperNumber: 1, type: 'memo', title: 'Life Orientation P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'lo-2023-p1-q', subject: 'life_orientation', year: 2023, paperNumber: 1, type: 'question', title: 'Life Orientation P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'lo-2023-p1-m', subject: 'life_orientation', year: 2023, paperNumber: 1, type: 'memo', title: 'Life Orientation P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Dramatic Arts ──
  { id: 'drama-2024-p1-q', subject: 'dramatic_arts', year: 2024, paperNumber: 1, type: 'question', title: 'Dramatic Arts P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'drama-2024-p1-m', subject: 'dramatic_arts', year: 2024, paperNumber: 1, type: 'memo', title: 'Dramatic Arts P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'drama-2023-p1-q', subject: 'dramatic_arts', year: 2023, paperNumber: 1, type: 'question', title: 'Dramatic Arts P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'drama-2023-p1-m', subject: 'dramatic_arts', year: 2023, paperNumber: 1, type: 'memo', title: 'Dramatic Arts P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Visual Arts ──
  { id: 'visart-2024-p1-q', subject: 'visual_arts', year: 2024, paperNumber: 1, type: 'question', title: 'Visual Arts P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'visart-2024-p1-m', subject: 'visual_arts', year: 2024, paperNumber: 1, type: 'memo', title: 'Visual Arts P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'visart-2023-p1-q', subject: 'visual_arts', year: 2023, paperNumber: 1, type: 'question', title: 'Visual Arts P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'visart-2023-p1-m', subject: 'visual_arts', year: 2023, paperNumber: 1, type: 'memo', title: 'Visual Arts P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Music ──
  { id: 'music-2024-p1-q', subject: 'music', year: 2024, paperNumber: 1, type: 'question', title: 'Music P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'music-2024-p1-m', subject: 'music', year: 2024, paperNumber: 1, type: 'memo', title: 'Music P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'music-2023-p1-q', subject: 'music', year: 2023, paperNumber: 1, type: 'question', title: 'Music P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'music-2023-p1-m', subject: 'music', year: 2023, paperNumber: 1, type: 'memo', title: 'Music P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Civil Technology ──
  { id: 'civtech-2024-p1-q', subject: 'civil_technology', year: 2024, paperNumber: 1, type: 'question', title: 'Civil Technology P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'civtech-2024-p1-m', subject: 'civil_technology', year: 2024, paperNumber: 1, type: 'memo', title: 'Civil Technology P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'civtech-2023-p1-q', subject: 'civil_technology', year: 2023, paperNumber: 1, type: 'question', title: 'Civil Technology P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'civtech-2023-p1-m', subject: 'civil_technology', year: 2023, paperNumber: 1, type: 'memo', title: 'Civil Technology P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Electrical Technology ──
  { id: 'electech-2024-p1-q', subject: 'electrical_technology', year: 2024, paperNumber: 1, type: 'question', title: 'Electrical Technology P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'electech-2024-p1-m', subject: 'electrical_technology', year: 2024, paperNumber: 1, type: 'memo', title: 'Electrical Technology P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'electech-2023-p1-q', subject: 'electrical_technology', year: 2023, paperNumber: 1, type: 'question', title: 'Electrical Technology P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'electech-2023-p1-m', subject: 'electrical_technology', year: 2023, paperNumber: 1, type: 'memo', title: 'Electrical Technology P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Mechanical Technology ──
  { id: 'mechtech-2024-p1-q', subject: 'mechanical_technology', year: 2024, paperNumber: 1, type: 'question', title: 'Mechanical Technology P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'mechtech-2024-p1-m', subject: 'mechanical_technology', year: 2024, paperNumber: 1, type: 'memo', title: 'Mechanical Technology P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'mechtech-2023-p1-q', subject: 'mechanical_technology', year: 2023, paperNumber: 1, type: 'question', title: 'Mechanical Technology P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'mechtech-2023-p1-m', subject: 'mechanical_technology', year: 2023, paperNumber: 1, type: 'memo', title: 'Mechanical Technology P1 Memorandum', url: DBE_PAPERS_HUB },

  // ── Engineering Graphic & Design ──
  { id: 'egd-2024-p1-q', subject: 'engineering_graphic_and_design', year: 2024, paperNumber: 1, type: 'question', title: 'EGD P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'egd-2024-p1-m', subject: 'engineering_graphic_and_design', year: 2024, paperNumber: 1, type: 'memo', title: 'EGD P1 Memorandum', url: DBE_PAPERS_HUB },
  { id: 'egd-2023-p1-q', subject: 'engineering_graphic_and_design', year: 2023, paperNumber: 1, type: 'question', title: 'EGD P1 Question Paper', url: DBE_PAPERS_HUB },
  { id: 'egd-2023-p1-m', subject: 'engineering_graphic_and_design', year: 2023, paperNumber: 1, type: 'memo', title: 'EGD P1 Memorandum', url: DBE_PAPERS_HUB },
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
