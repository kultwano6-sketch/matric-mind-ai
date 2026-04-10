// API utilities with retry logic and error handling

import { getNetworkStatus } from '@/hooks/useNetworkStatus';

export interface APIResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOn: (error: APIError) => boolean;
}

export interface APIError {
  message: string;
  status?: number;
  isNetworkError?: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryOn: (error) => {
    // Retry on network errors, 5xx errors, or timeout
    return error.isNetworkError || 
           (error.status !== undefined && error.status >= 500) ||
           error.message.toLowerCase().includes('timeout') ||
           error.message.toLowerCase().includes('network');
  },
};

// Check if we're online
export function isOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return getNetworkStatus();
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate delay with exponential backoff
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const delay = baseDelay * Math.pow(2, attempt);
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.min(Math.max(delay + jitter, 0), maxDelay);
}

// Enhanced fetch with retry logic
export async function fetchWithRetry<T = any>(
  url: string,
  options?: RequestInit,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<APIResponse<T>> {
  // First check network status
  if (!isOnline()) {
    return {
      data: null,
      error: 'You are currently offline. Please check your internet connection.',
      status: 0,
    };
  }

  let lastError: APIError = { message: 'Unknown error' };

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // For non-OK responses, try to parse error message
      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // Not JSON, use default message
        }

        // If it's a 5xx error or rate limit, might be worth retrying
        if (response.status >= 500 || response.status === 429) {
          lastError = { message: errorMessage, status: response.status };
          
          if (attempt < config.maxRetries && config.retryOn(lastError)) {
            const delay = calculateDelay(attempt, config.baseDelayMs, config.maxDelayMs);
            console.log(`Retrying after ${delay}ms (attempt ${attempt + 1}/${config.maxRetries})`);
            await sleep(delay);
            continue;
          }
        }

        return {
          data: null,
          error: errorMessage,
          status: response.status,
        };
      }

      // Parse successful response
      const data = await response.json();
      return {
        data,
        error: null,
        status: response.status,
      };

    } catch (error: any) {
      // Handle different error types
      if (error.name === 'AbortError') {
        lastError = { message: 'Request timed out. Please try again.', isNetworkError: true };
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        lastError = { message: 'Network error. Please check your connection.', isNetworkError: true };
      } else {
        lastError = { message: error.message || 'An unexpected error occurred' };
      }

      // Check if we should retry
      if (attempt < config.maxRetries && config.retryOn(lastError)) {
        const delay = calculateDelay(attempt, config.baseDelayMs, config.maxDelayMs);
        console.log(`Retrying after ${delay}ms (attempt ${attempt + 1}/${config.maxRetries}): ${lastError.message}`);
        await sleep(delay);
      } else {
        break;
      }
    }
  }

  // All retries exhausted
  return {
    data: null,
    error: lastError.message,
    status: 0,
  };
}

// Wrapper specifically for API calls that returns solution data
export async function callAPISolve<T = any>(
  endpoint: string,
  body: object,
  timeoutMs: number = 60000
): Promise<{ data: T | null; error: string | null }> {
  const result = await fetchWithRetry<T>(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, {
    ...DEFAULT_RETRY_CONFIG,
    maxRetries: 2,
  });

  return {
    data: result.data,
    error: result.error,
  };
}