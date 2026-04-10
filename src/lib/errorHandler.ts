// API Error Handler - Centralized error handling with user-friendly messages
// Part 2: Failure Handling Infrastructure

// ============================================================
// ERROR TYPES
// ============================================================

export type ErrorCode = 
  | 'NETWORK_OFFLINE'
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_ERROR'
  | 'API_SERVER_ERROR'
  | 'API_RATE_LIMIT'
  | 'API_UNAUTHORIZED'
  | 'API_FORBIDDEN'
  | 'OCR_FAILED'
  | 'OCR_LOW_CONFIDENCE'
  | 'OCR_NO_TEXT'
  | 'AI_TIMEOUT'
  | 'AI_OVERLOADED'
  | 'AI_CONTENT_FILTERED'
  | 'DATABASE_ERROR'
  | 'UNKNOWN_ERROR';

export interface APIError {
  code: ErrorCode;
  message: string;
  userMessage: string;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  originalError?: Error;
}

// ============================================================
// ERROR MAPPING
// ============================================================

const ERROR_MAP: Record<string, Omit<APIError, 'originalError'>> = {
  // Network errors
  'Failed to fetch': {
    code: 'NETWORK_ERROR',
    message: 'Failed to fetch',
    userMessage: 'Unable to connect to the server. Please check your internet connection.',
    retryable: true,
    severity: 'medium',
  },
  'Network request failed': {
    code: 'NETWORK_ERROR',
    message: 'Network request failed',
    userMessage: 'Unable to connect to the server. Please check your internet connection.',
    retryable: true,
    severity: 'medium',
  },
  'NetworkError': {
    code: 'NETWORK_ERROR',
    message: 'NetworkError',
    userMessage: 'A network error occurred. Please check your internet connection.',
    retryable: true,
    severity: 'medium',
  },
  'net::ERR_INTERNET_DISCONNECTED': {
    code: 'NETWORK_OFFLINE',
    message: 'net::ERR_INTERNET_DISCONNECTED',
    userMessage: 'You appear to be offline. Please check your internet connection.',
    retryable: true,
    severity: 'medium',
  },
  'timeout': {
    code: 'NETWORK_TIMEOUT',
    message: 'Request timed out',
    userMessage: 'The request took too long. Please try again.',
    retryable: true,
    severity: 'low',
  },
  'timeout exceeded': {
    code: 'NETWORK_TIMEOUT',
    message: 'Timeout exceeded',
    userMessage: 'The request timed out. Please try again.',
    retryable: true,
    severity: 'low',
  },

  // HTTP errors
  '500': {
    code: 'API_SERVER_ERROR',
    message: 'Internal Server Error',
    userMessage: 'Something went wrong on our end. Please try again in a moment.',
    retryable: true,
    severity: 'high',
  },
  '502': {
    code: 'API_SERVER_ERROR',
    message: 'Bad Gateway',
    userMessage: 'Server temporarily unavailable. Please try again.',
    retryable: true,
    severity: 'high',
  },
  '503': {
    code: 'API_SERVER_ERROR',
    message: 'Service Unavailable',
    userMessage: 'Service temporarily unavailable. Please try again later.',
    retryable: true,
    severity: 'high',
  },
  '504': {
    code: 'API_SERVER_ERROR',
    message: 'Gateway Timeout',
    userMessage: 'The server is taking too long. Please try again.',
    retryable: true,
    severity: 'medium',
  },
  '429': {
    code: 'API_RATE_LIMIT',
    message: 'Rate Limited',
    userMessage: 'Too many requests. Please wait a moment and try again.',
    retryable: true,
    severity: 'medium',
  },
  '401': {
    code: 'API_UNAUTHORIZED',
    message: 'Unauthorized',
    userMessage: 'Your session has expired. Please log in again.',
    retryable: false,
    severity: 'high',
  },
  '403': {
    code: 'API_FORBIDDEN',
    message: 'Forbidden',
    userMessage: "You don't have permission to perform this action.",
    retryable: false,
    severity: 'high',
  },

  // OCR specific errors
  'OCR extraction failed': {
    code: 'OCR_FAILED',
    message: 'OCR extraction failed',
    userMessage: 'Could not read the image. Try a clearer photo.',
    retryable: true,
    severity: 'medium',
  },
  'Could not read the image': {
    code: 'OCR_FAILED',
    message: 'Could not read the image clearly',
    userMessage: 'Could not read the image clearly. Try a clearer photo with better lighting.',
    retryable: true,
    severity: 'medium',
  },
  'No text found': {
    code: 'OCR_NO_TEXT',
    message: 'No text detected in image',
    userMessage: 'No text detected in the image. Try a clearer photo.',
    retryable: true,
    severity: 'medium',
  },
  'low confidence': {
    code: 'OCR_LOW_CONFIDENCE',
    message: 'Low OCR confidence',
    userMessage: 'Could not read the image clearly. Please verify or retake.',
    retryable: true,
    severity: 'low',
  },

  // AI specific errors
  'rate_limit_exceeded': {
    code: 'AI_OVERLOADED',
    message: 'AI rate limit exceeded',
    userMessage: 'AI service is busy. Please try again in a moment.',
    retryable: true,
    severity: 'medium',
  },
  'content_filter': {
    code: 'AI_CONTENT_FILTERED',
    message: 'Content filtered',
    userMessage: 'This content was flagged by our safety filters.',
    retryable: false,
    severity: 'high',
  },
  'context_length_exceeded': {
    code: 'AI_TIMEOUT',
    message: 'Input too long',
    userMessage: 'Input is too long. Please shorten and try again.',
    retryable: false,
    severity: 'medium',
  },
};

// ============================================================
// MAIN ERROR PARSER
// ============================================================

export function parseError(error: unknown): APIError {
  // If already an APIError, return it
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return error as APIError;
  }

  const originalError = error instanceof Error ? error : new Error(String(error));
  const errorMessage = originalError.message.toLowerCase();

  // Try to match against known errors
  for (const [key, value] of Object.entries(ERROR_MAP)) {
    if (errorMessage.includes(key.toLowerCase())) {
      return { ...value, originalError };
    }
  }

  // Check for HTTP status codes in error
  const statusMatch = errorMessage.match(/\b(4\d{2}|5\d{2})\b/);
  if (statusMatch) {
    const status = statusMatch[1];
    const statusError = ERROR_MAP[status];
    if (statusError) {
      return { ...statusError, originalError };
    }
  }

  // Default fallback - show more specific message
  console.error('Unhandled error:', originalError);
  return {
    code: 'UNKNOWN_ERROR',
    message: originalError.message,
    userMessage: `Something went wrong. Check your connection and try again.`,
    retryable: true,
    severity: 'medium',
    originalError,
  };
}

// ============================================================
// USER-FRIENDLY MESSAGE GENERATOR
// ============================================================

export function getErrorMessage(error: unknown, customMessages?: Partial<Record<ErrorCode, string>>): string {
  const parsed = parseError(error);
  
  // Check for custom message first
  if (customMessages && customMessages[parsed.code]) {
    return customMessages[parsed.code]!;
  }
  
  return parsed.userMessage;
}

// ============================================================
// RETRY DECISION
// ============================================================

export function shouldRetry(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.retryable;
}

// ============================================================
// SEVERITY CHECK
// ============================================================

export function isCritical(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.severity === 'critical';
}

export function isHighSeverity(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.severity === 'high' || parsed.severity === 'critical';
}