// Data Validation - Ensure data integrity

import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

// Valid subjects
const VALID_SUBJECTS: MatricSubject[] = [
  'mathematics',
  'physical_sciences',
  'life_sciences',
  'geography',
  'history',
  'english',
  'afrikaans',
  'accounting',
  'economics',
  'business_studies',
];

// Validate subject
export function isValidSubject(subject: string): subject is MatricSubject {
  return VALID_SUBJECTS.includes(subject as MatricSubject);
}

// Normalize subject (case-insensitive)
export function normalizeSubjectInput(subject: string): MatricSubject {
  const normalized = subject.toLowerCase().replace(/[^a-z_]/g, '');
  if (isValidSubject(normalized)) {
    return normalized;
  }
  // Default fallback
  return 'mathematics';
}

// Validate score (0-100)
export function isValidScore(score: number | null | undefined): boolean {
  if (score === null || score === undefined) return true; // Allow null
  return typeof score === 'number' && score >= 0 && score <= 100;
}

// Clamp score to valid range
export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Validate mastery level (0-100)
export function isValidMastery(level: number | null | undefined): boolean {
  if (level === null || level === undefined) return true;
  return typeof level === 'number' && level >= 0 && level <= 100;
}

// Validate user ID (UUID format)
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Sanitize text input (prevent XSS, limit length)
export function sanitizeText(input: string, maxLength: number = 1000): string {
  if (!input) return '';
  
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML
    .trim();
}

// Validate topic name
export function isValidTopic(topic: string): boolean {
  if (!topic || topic.length < 2 || topic.length > 100) return false;
  // Only allow alphanumeric, spaces, hyphens
  return /^[a-zA-Z0-9\s\-']+$/.test(topic);
}

// Normalize topic
export function normalizeTopic(topic: string): string {
  return sanitizeText(topic, 100)
    .replace(/\s+/g, ' ')
    .trim();
}

// Validate quiz question
export interface QuestionValidation {
  valid: boolean;
  errors: string[];
}

export function validateQuizQuestion(question: {
  question: string;
  options?: string[];
  correctAnswer?: number;
  subject?: string;
  topic?: string;
}): QuestionValidation {
  const errors: string[] = [];
  
  // Question text required
  if (!question.question || question.question.length < 5) {
    errors.push('Question text must be at least 5 characters');
  }
  
  // At least 2 options for multiple choice
  if (question.options && question.options.length < 2) {
    errors.push('Need at least 2 options');
  }
  
  // Valid answer index
  if (question.correctAnswer !== undefined) {
    if (question.correctAnswer < 0 || (question.options && question.correctAnswer >= question.options.length)) {
      errors.push('Invalid correct answer index');
    }
  }
  
  // Subject validation
  if (question.subject && !isValidSubject(question.subject)) {
    errors.push(`Invalid subject: ${question.subject}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Validate assignment
export function validateAssignment(assignment: {
  title: string;
  subject: string;
  due_date?: string;
}): QuestionValidation {
  const errors: string[] = [];
  
  if (!assignment.title || assignment.title.length < 3) {
    errors.push('Assignment title must be at least 3 characters');
  }
  
  if (!isValidSubject(assignment.subject)) {
    errors.push(`Invalid subject: ${assignment.subject}`);
  }
  
  // Validate due date if provided
  if (assignment.due_date) {
    const date = new Date(assignment.due_date);
    if (isNaN(date.getTime())) {
      errors.push('Invalid due date format');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Safe parse JSON with fallback
export function safeJSONParse<T>(json: string, fallback: T): T {
  try {
    const parsed = JSON.parse(json);
    return parsed as T;
  } catch {
    return fallback;
  }
}

// Validate user profile data
export function validateProfile(data: {
  full_name?: string;
  avatar_url?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (data.full_name && data.full_name.length > 100) {
    errors.push('Name too long (max 100 chars)');
  }
  
  // Avatar URL validation (basic)
  if (data.avatar_url && !data.avatar_url.startsWith('http') && !data.avatar_url.startsWith('data:')) {
    errors.push('Invalid avatar URL');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Default values for missing data
export const DEFAULTS = {
  readinessScore: 0,
  xp: 0,
  level: 1,
  streak: 0,
  masteryLevel: 0,
  score: 0,
  topic: 'General',
  subject: 'mathematics' as MatricSubject,
};