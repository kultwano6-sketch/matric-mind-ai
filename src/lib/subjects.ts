import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

export const SUBJECT_LABELS: Record<MatricSubject, string> = {
  mathematics: 'Mathematics',
  mathematical_literacy: 'Mathematical Literacy',
  physical_sciences: 'Physical Sciences',
  life_sciences: 'Life Sciences',
  accounting: 'Accounting',
  business_studies: 'Business Studies',
  economics: 'Economics',
  geography: 'Geography',
  history: 'History',
  english_home_language: 'English Home Language',
  english_first_additional: 'English First Additional',
  afrikaans_home_language: 'Afrikaans Home Language',
  afrikaans_first_additional: 'Afrikaans First Additional',
  isizulu: 'IsiZulu',
  isixhosa: 'IsiXhosa',
  life_orientation: 'Life Orientation',
  computer_applications_technology: 'Computer Applications Technology',
  information_technology: 'Information Technology',
  tourism: 'Tourism',
  dramatic_arts: 'Dramatic Arts',
  visual_arts: 'Visual Arts',
  music: 'Music',
};

export const SUBJECT_ICONS: Record<string, string> = {
  mathematics: '📐',
  mathematical_literacy: '🔢',
  physical_sciences: '⚛️',
  life_sciences: '🧬',
  accounting: '📊',
  business_studies: '💼',
  economics: '📈',
  geography: '🌍',
  history: '📜',
  english_home_language: '📖',
  english_first_additional: '📝',
  afrikaans_home_language: '🇿🇦',
  afrikaans_first_additional: '🇿🇦',
  isizulu: '🗣️',
  isixhosa: '🗣️',
  life_orientation: '🧭',
  computer_applications_technology: '💻',
  information_technology: '🖥️',
  tourism: '✈️',
  dramatic_arts: '🎭',
  visual_arts: '🎨',
  music: '🎵',
};

export const ALL_SUBJECTS = Object.keys(SUBJECT_LABELS) as MatricSubject[];
