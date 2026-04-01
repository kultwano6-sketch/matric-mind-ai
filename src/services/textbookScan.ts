// ============================================================
// Matric Mind AI - Textbook Scan Service
// Client-side service for textbook scanning and OCR
// ============================================================

import { supabase } from '@/integrations/supabase/client';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================
// Types
// ============================================================

export interface TextbookScan {
  id: string;
  student_id: string;
  subject: string;
  image_url: string | null;
  extracted_text: string | null;
  chapters_detected: ScanResult;
  processed_at: string | null;
  created_at: string;
}

export interface ScanResult {
  chapter: string;
  headings: string[];
  key_concepts: string[];
  questions: string[];
  formulas: string[];
  suggested_topics: string[];
}

export interface ScanResponse {
  success: boolean;
  scan_id: string;
  result: ScanResult;
  error?: string;
}

// ============================================================
// API Functions
// ============================================================

/**
 * Convert a File object to base64 string
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix, keep only base64
      resolve(result.split(',')[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Scan a textbook page image
 */
export async function scanTextbook(
  imageBase64: string,
  subject: string,
  chapter?: string
): Promise<ScanResponse> {
  const response = await fetch(`${API_BASE}/api/textbook-scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_id: (await supabase.auth.getUser()).data.user?.id,
      subject,
      image_base64: imageBase64,
      chapter_hint: chapter,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Textbook scan failed');
  }

  return response.json();
}

/**
 * Get scan history for a student
 */
export async function getScanHistory(
  studentId: string,
  subject?: string
): Promise<TextbookScan[]> {
  let query = supabase
    .from('textbook_scans')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (subject) {
    query = query.eq('subject', subject);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((scan: any) => ({
    id: scan.id,
    student_id: scan.student_id,
    subject: scan.subject,
    image_url: scan.image_url,
    extracted_text: scan.extracted_text,
    chapters_detected: typeof scan.chapters_detected === 'object'
      ? scan.chapters_detected as ScanResult
      : { chapter: '', headings: [], key_concepts: [], questions: [], formulas: [], suggested_topics: [] },
    processed_at: scan.processed_at,
    created_at: scan.created_at,
  }));
}

/**
 * Get a specific scan result
 */
export async function getScanResult(scanId: string): Promise<TextbookScan | null> {
  const { data, error } = await supabase
    .from('textbook_scans')
    .select('*')
    .eq('id', scanId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    student_id: data.student_id,
    subject: data.subject,
    image_url: data.image_url,
    extracted_text: data.extracted_text,
    chapters_detected: typeof data.chapters_detected === 'object'
      ? data.chapters_detected as ScanResult
      : { chapter: '', headings: [], key_concepts: [], questions: [], formulas: [], suggested_topics: [] },
    processed_at: data.processed_at,
    created_at: data.created_at,
  };
}

/**
 * Suggest quiz topics based on a scan result
 */
export function suggestTopics(scanResult: ScanResult): string[] {
  const topics: string[] = [...(scanResult.suggested_topics || [])];

  // Add key concepts as potential topics
  for (const concept of (scanResult.key_concepts || [])) {
    if (concept.length > 3 && concept.length < 50 && !topics.includes(concept)) {
      topics.push(concept);
    }
  }

  // Add headings as topics if they are specific enough
  for (const heading of (scanResult.headings || [])) {
    if (heading.length > 5 && heading.length < 60 && !topics.includes(heading)) {
      topics.push(heading);
    }
  }

  // Limit to 10 topics
  return topics.slice(0, 10);
}

/**
 * Generate a quiz title from scan result
 */
export function generateQuizTitle(scanResult: ScanResult): string {
  const chapter = scanResult.chapter || 'Unknown Chapter';
  const questionCount = (scanResult.questions || []).length;

  if (questionCount > 0) {
    return `Practice: ${chapter} (${questionCount} questions)`;
  }

  return `Review: ${chapter}`;
}

/**
 * Get formulas formatted for display
 */
export function formatFormulas(formulas: string[]): string[] {
  return formulas.map(formula => {
    // Basic LaTeX formatting hints
    let formatted = formula;

    // Convert common patterns to LaTeX
    formatted = formatted.replace(/\^(\d+)/g, '^{$1}');
    formatted = formatted.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}');
    formatted = formatted.replace(/(\d)\/(\d)/g, '\\frac{$1}{$2}');
    formatted = formatted.replace(/pi/g, '\\pi');
    formatted = formatted.replace(/theta/g, '\\theta');
    formatted = formatted.replace(/alpha/g, '\\alpha');
    formatted = formatted.replace(/beta/g, '\\beta');
    formatted = formatted.replace(/delta/g, '\\delta');

    return formatted;
  });
}

/**
 * Get heading hierarchy for navigation
 */
export function buildHeadingTree(headings: string[]): Array<{ level: number; text: string }> {
  return headings.map(heading => {
    // Determine heading level based on numbering or formatting
    let level = 1;
    if (/^\d+\.\d+\.\d+/.test(heading)) level = 3;
    else if (/^\d+\.\d+/.test(heading)) level = 2;

    return { level, text: heading };
  });
}
