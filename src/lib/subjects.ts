import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

export const SUBJECT_LABELS: Record<MatricSubject, string> = {
  // Core subjects
  mathematics: 'Mathematics',
  mathematical_literacy: 'Mathematical Literacy',
  physical_sciences: 'Physical Sciences',
  life_sciences: 'Life Sciences',
  agricultural_sciences: 'Agricultural Sciences',
  accounting: 'Accounting',
  business_studies: 'Business Studies',
  economics: 'Economics',
  geography: 'Geography',
  history: 'History',
  life_orientation: 'Life Orientation',

  // English
  english_home_language: 'English Home Language',
  english_first_additional: 'English First Additional',

  // Afrikaans
  afrikaans_home_language: 'Afrikaans Home Language',
  afrikaans_first_additional: 'Afrikaans First Additional',

  // isiZulu
  isizulu_home_language: 'isiZulu Home Language',
  isizulu_first_additional: 'isiZulu First Additional',

  // isiXhosa
  isixhosa_home_language: 'isiXhosa Home Language',
  isixhosa_first_additional: 'isiXhosa First Additional',

  // Sepedi
  sepedi_home_language: 'Sepedi Home Language',
  sepedi_first_additional: 'Sepedi First Additional',

  // Setswana
  setswana_home_language: 'Setswana Home Language',
  setswana_first_additional: 'Setswana First Additional',

  // Sesotho
  sesotho_home_language: 'Sesotho Home Language',
  sesotho_first_additional: 'Sesotho First Additional',

  // siSwati
  siswati_home_language: 'siSwati Home Language',
  siswati_first_additional: 'siSwati First Additional',

  // isiNdebele
  isindebele_home_language: 'isiNdebele Home Language',
  isindebele_first_additional: 'isiNdebele First Additional',

  // Xitsonga
  xitsonga_home_language: 'Xitsonga Home Language',
  xitsonga_first_additional: 'Xitsonga First Additional',

  // Tshivenda
  tshivenda_home_language: 'Tshivenda Home Language',
  tshivenda_first_additional: 'Tshivenda First Additional',

  // Technology & Arts
  computer_applications_technology: 'Computer Applications Technology',
  information_technology: 'Information Technology',
  tourism: 'Tourism',
  dramatic_arts: 'Dramatic Arts',
  visual_arts: 'Visual Arts',
  music: 'Music',
  civil_technology: 'Civil Technology',
  electrical_technology: 'Electrical Technology',
  mechanical_technology: 'Mechanical Technology',
  engineering_graphic_and_design: 'Engineering Graphic & Design',
};

export const SUBJECT_ICONS: Record<string, string> = {
  // Core
  mathematics: '📐',
  mathematical_literacy: '🔢',
  physical_sciences: '⚛️',
  life_sciences: '🧬',
  agricultural_sciences: '🌾',
  accounting: '📊',
  business_studies: '💼',
  economics: '📈',
  geography: '🌍',
  history: '📜',
  life_orientation: '🧭',

  // Languages
  english_home_language: '📖',
  english_first_additional: '📝',
  afrikaans_home_language: '🇿🇦',
  afrikaans_first_additional: '🇿🇦',
  isizulu_home_language: '🗣️',
  isizulu_first_additional: '🗣️',
  isixhosa_home_language: '🗣️',
  isixhosa_first_additional: '🗣️',
  sepedi_home_language: '🗣️',
  sepedi_first_additional: '🗣️',
  setswana_home_language: '🗣️',
  setswana_first_additional: '🗣️',
  sesotho_home_language: '🗣️',
  sesotho_first_additional: '🗣️',
  siswati_home_language: '🗣️',
  siswati_first_additional: '🗣️',
  isindebele_home_language: '🗣️',
  isindebele_first_additional: '🗣️',
  xitsonga_home_language: '🗣️',
  xitsonga_first_additional: '🗣️',
  tshivenda_home_language: '🗣️',
  tshivenda_first_additional: '🗣️',

  // Technology & Arts
  computer_applications_technology: '💻',
  information_technology: '🖥️',
  tourism: '✈️',
  dramatic_arts: '🎭',
  visual_arts: '🎨',
  music: '🎵',
  civil_technology: '🏗️',
  electrical_technology: '⚡',
  mechanical_technology: '⚙️',
  engineering_graphic_and_design: '📐',
};

export const ALL_SUBJECTS = Object.keys(SUBJECT_LABELS) as MatricSubject[];

// Science subjects that support AI illustrations
export const SCIENCE_SUBJECTS: MatricSubject[] = [
  'physical_sciences',
  'life_sciences',
  'geography',
  'agricultural_sciences',
];

// Backward compatibility: map old subject names to new ones
export const LEGACY_SUBJECT_MAP: Record<string, MatricSubject> = {
  'isizulu': 'isizulu_home_language' as MatricSubject,
  'isixhosa': 'isixhosa_home_language' as MatricSubject,
};

export function normalizeSubject(subject: string): MatricSubject {
  return (LEGACY_SUBJECT_MAP[subject] || subject) as MatricSubject;
}
