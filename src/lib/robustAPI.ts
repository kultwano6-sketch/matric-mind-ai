// Enhanced API wrapper with retry, error handling, and performance tracking
// Part 4: User Flow & Part 7: Reliability

import { getNetworkStatus } from '@/hooks/useNetworkStatus';
import { parseError, getErrorMessage, shouldRetry, type APIError } from './errorHandler';

export interface APIRequestConfig {
  // Retry options
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryCondition?: (error: APIError) => boolean;
  
  // Timeout
  timeoutMs?: number;
  
  // Offline handling
  offlineFallback?: any;
  allowOfflineRetry?: boolean;
}

const DEFAULT_CONFIG: Required<APIRequestConfig> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryCondition: (error) => error.retryable,
  timeoutMs: 30000,
  offlineFallback: null,
  allowOfflineRetry: false,
};

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Calculate delay with exponential backoff + jitter
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
  return Math.min(Math.max(exponentialDelay + jitter, baseDelay * 0.8), maxDelay);
}

// Enhanced fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutId);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Main API call function with full retry logic
export async function robustAPICall<T = any>(
  url: string,
  body: object,
  config: APIRequestConfig = {}
): Promise<{ data: T | null; error: string | null; retryCount: number }> {
  const {
    maxRetries,
    baseDelayMs,
    maxDelayMs,
    retryCondition,
    timeoutMs,
    offlineFallback,
    allowOfflineRetry,
  } = { ...DEFAULT_CONFIG, ...config };

  // Check network status first
  if (!getNetworkStatus()) {
    if (offlineFallback !== undefined) {
      return {
        data: offlineFallback,
        error: null,
        retryCount: 0,
      };
    }
    return {
      data: null,
      error: 'You are currently offline. Please check your internet connection.',
      retryCount: 0,
    };
  }

  let lastError: APIError | null = null;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Make the request
      const startTime = performance.now();
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        timeoutMs
      );

      const responseTime = performance.now() - startTime;

      // Success - parse response
      if (response.ok) {
        const data = await response.json();
        
        // Log performance (in production, would log to analytics)
        if (responseTime > 2000) {
          console.warn(`🐢 Slow API call: ${responseTime}ms to ${url}`);
        }
        
        return {
          data,
          error: null,
          retryCount,
        };
      }

      // HTTP error - try to parse error message
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // Not JSON
      }

      // Parse into APIError
      lastError = parseError(new Error(errorMessage));

      // Check if should retry
      if (attempt < maxRetries && retryCondition(lastError)) {
        retryCount++;
        const delay = calculateDelay(
          attempt,
          baseDelayMs,
          maxDelayMs
        );
        console.log(
          `🔄 Retrying after ${Math.round(delay)}ms (attempt ${retryCount}/${maxRetries}): ${lastError.userMessage}`
        );
        await sleep(delay);
        continue;
      }

      // Don't retry - return error
      return {
        data: null,
        error: lastError.userMessage,
        retryCount,
      };
    } catch (error) {
      // Network/fetch error
      lastError = parseError(error);

      // Check if we should retry
      if (attempt < maxRetries && retryCondition(lastError)) {
        retryCount++;
        const delay = calculateDelay(
          attempt,
          baseDelayMs,
          maxDelayMs
        );
        console.log(
          `🔄 Retrying after ${delay}ms (attempt ${retryCount}/${maxRetries}): ${lastError.userMessage}`
        );
        await sleep(delay);
        continue;
      }

      // All retries exhausted
      return {
        data: null,
        error: lastError.userMessage,
        retryCount,
      };
    }
  }

  // Should not reach here, but handle it
  return {
    data: null,
    error: lastError?.userMessage || 'An unexpected error occurred',
    retryCount,
  };
}

// Wrapper for SnapSolve specifically
export async function callSnapSolveAPI(
  imageBase64: string | null,
  question: string | null,
  subject: string,
  action: string = 'solve',
  extracted_text?: string
): Promise<{
  data: any | null;
  error: string | null;
}> {
  const result = await robustAPICall('/api/ocr-pipeline', {
    image: imageBase64,
    question,
    subject,
    action,
    extracted_text,
  }, {
    maxRetries: 3,
    baseDelayMs: 1500,
    maxDelayMs: 15000,
    timeoutMs: 60000, // OCR can take longer
  });

  return {
    data: result.data,
    error: result.error,
  };
}

// Health check function
export async function checkAPIHealth(): Promise<{
  status: 'online' | 'slow' | 'offline';
  responseTime: number | null;
}> {
  const startTime = performance.now();

  try {
    const response = await fetchWithTimeout(
      '/api/health',
      { method: 'GET' },
      5000
    );

    const responseTime = performance.now() - startTime;

    if (response.ok) {
      return {
        status: responseTime < 1000 ? 'online' : 'slow',
        responseTime,
      };
    }

    return {
      status: 'offline',
      responseTime,
    };
  } catch {
    return {
      status: 'offline',
      responseTime: null,
    };
  }
}