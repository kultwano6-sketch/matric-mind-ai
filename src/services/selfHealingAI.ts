// Self-Healing AI System - Auto-retry and fallback providers

import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { google } from '@ai-sdk/google';
import { logAIRequest } from './systemHealth';

// Configuration
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT = 30000; // 30 seconds

interface AIProvider {
  name: string;
  provider: 'groq' | 'google';
  model: string;
}

const PROVIDERS: AIProvider[] = [
  { name: 'Groq', provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { name: 'Google Gemini', provider: 'google', model: 'gemini-2.0-flash' },
];

interface AIRequest {
  messages: { role: string; content: string }[];
  maxTokens?: number;
}

interface AIResponse {
  text: string;
  provider: string;
  success: boolean;
  error?: string;
  responseTime: number;
}

// Execute AI request with automatic retry and fallback
export async function executeAIWithFallback(
  request: AIRequest,
  onRetry?: (attempt: number, error: string) => void
): Promise<AIResponse> {
  let lastError: string | undefined;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    for (const provider of PROVIDERS) {
      const startTime = Date.now();
      
      try {
        // Execute with timeout
        const response = await Promise.race([
          executeProviderRequest(provider, request),
          timeout(REQUEST_TIMEOUT),
        ]);
        
        const responseTime = Date.now() - startTime;
        
        // Log success
        await logAIRequest(
          request.messages[request.messages.length - 1]?.content || '',
          responseTime,
          true
        );
        
        return {
          text: response,
          provider: provider.name,
          success: true,
          responseTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        const responseTime = Date.now() - startTime;
        
        // Log failure
        await logAIRequest(
          request.messages[request.messages.length - 1]?.content || '',
          responseTime,
          false,
          lastError
        );
        
        console.warn(`AI request failed on ${provider.name} (attempt ${attempt + 1}):`, lastError);
        
        // Notify retry callback
        if (onRetry) {
          onRetry(attempt + 1, `${provider.name} failed: ${lastError}`);
        }
        
        // Continue to next provider/attempt
      }
    }
  }
  
  // All attempts failed
  return {
    text: '',
    provider: 'none',
    success: false,
    error: lastError || 'All AI providers failed',
    responseTime: 0,
  };
}

// Execute request with specific provider
async function executeProviderRequest(
  provider: AIProvider,
  request: AIRequest
): Promise<string> {
  switch (provider.provider) {
    case 'groq':
      return await groqRequest(request, provider.model);
    case 'google':
      return await googleRequest(request, provider.model);
    default:
      throw new Error(`Unknown provider: ${provider.provider}`);
  }
}

// Groq request
async function groqRequest(request: AIRequest, model: string): Promise<string> {
  const { text } = await generateText({
    model: groq(model),
    messages: request.messages,
    maxTokens: request.maxTokens || 1500,
  });
  
  return text?.trim() || '';
}

// Google Gemini request
async function googleRequest(request: AIRequest, model: string): Promise<string> {
  const { text } = await generateText({
    model: google(model),
    messages: request.messages,
    maxTokens: request.maxTokens || 1500,
  });
  
  return text?.trim() || '';
}

// Timeout helper
function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => 
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
  );
}

// Retry logic for OCR
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on certain errors
      if (lastError.message.includes('invalid') || lastError.message.includes('unauthorized')) {
        throw lastError;
      }
      
      // Wait with exponential backoff
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
}