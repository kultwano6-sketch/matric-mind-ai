// Monitoring Service - Logs errors, performance, and health metrics
// Part 6: Monitoring Infrastructure

import { supabase } from '@/integrations/supabase/client';

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type ServiceName = 'ai' | 'ocr' | 'database' | 'api' | 'storage' | 'auth';

export interface LogEntry {
  id?: string;
  level: LogLevel;
  service: ServiceName;
  message: string;
  details?: Record<string, any>;
  user_id?: string;
  session_id?: string;
  duration_ms?: number;
  created_at?: string;
}

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  response_time_ms: number;
  status_code: number;
  timestamp: string;
}

export interface HealthStatus {
  service: ServiceName;
  status: 'healthy' | 'degraded' | 'down';
  last_check: string;
  response_time_ms?: number;
  error_count?: number;
}

// In-memory buffer for logged errors (sent periodically)
const logBuffer: LogEntry[] = [];
const MAX_BUFFER_SIZE = 50;
let flushScheduled = false;

// ============================================================
// LOGGING FUNCTIONS
// ============================================================

// Add to buffer (async, doesn't block)
export function log(level: LogLevel, service: ServiceName, message: string, details?: Record<string, any>) {
  const entry: LogEntry = {
    level,
    service,
    message,
    details,
    created_at: new Date().toISOString(),
  };

  // Console output for development
  const prefix = {
    debug: '🔍',
    info: 'ℹ️',
    warning: '⚠️',
    error: '🔴',
    critical: '🚨',
  }[level];

  console.log(`${prefix} [${service.toUpperCase()}] ${message}`, details || '');

  // Add to buffer
  logBuffer.push(entry);

  // Flush if buffer is full
  if (logBuffer.length >= MAX_BUFFER_SIZE) {
    flushLogs();
  } else if (!flushScheduled) {
    // Schedule flush in 30 seconds
    flushScheduled = true;
    setTimeout(() => {
      flushLogs();
      flushScheduled = false;
    }, 30000);
  }
}

// Convenience functions
export function logInfo(service: ServiceName, message: string, details?: Record<string, any>) {
  log('info', service, message, details);
}

export function logWarning(service: ServiceName, message: string, details?: Record<string, any>) {
  log('warning', service, message, details);
}

export function logError(service: ServiceName, message: string, details?: Record<string, any>) {
  log('error', service, message, details);
}

export function logCritical(service: ServiceName, message: string, details?: Record<string, any>) {
  log('critical', service, message, details);
}

// ============================================================
// PERFORMANCE TRACKING
// ============================================================

// Track API call performance
export async function trackAPICall(
  endpoint: string,
  method: string,
  startTime: number,
  statusCode: number,
  error?: Error
): Promise<void> {
  const duration = performance.now() - startTime;
  
  log(
    statusCode >= 500 || error ? 'error' : duration > 2000 ? 'warning' : 'info',
    'api',
    `${method} ${endpoint}`,
    {
      duration_ms: Math.round(duration),
      status_code: statusCode,
      slow: duration > 2000,
      error: error?.message,
    }
  );
}

// Track AI performance
export async function trackAIRequest(
  model: string,
  startTime: number,
  success: boolean,
  error?: Error
): Promise<void> {
  const duration = performance.now() - startTime;

  log(
    error ? 'error' : duration > 10000 || !success ? 'warning' : 'info',
    'ai',
    `AI request: ${model}`,
    {
      duration_ms: Math.round(duration),
      model,
      success,
      slow: duration > 10000,
      error: error?.message,
    }
  );
}

// Track OCR performance
export async function trackOCRRequest(
  imageSize: number,
  startTime: number,
  success: boolean,
  error?: Error
): Promise<void> {
  const duration = performance.now() - startTime;

  log(
    error ? 'error' : success && duration > 5000 ? 'warning' : 'info',
    'ocr',
    'OCR request',
    {
      duration_ms: Math.round(duration),
      image_size: imageSize,
      success,
      slow: duration > 5000,
      error: error?.message,
    }
  );
}

// ============================================================
// FLUSH LOGS TO DATABASE
// ============================================================

async function flushLogs(): Promise<void> {
  if (logBuffer.length === 0) return;

  const entries = [...logBuffer];
  logBuffer.length = 0;

  // Try to write to database (won't fail the app if it doesn't work)
  try {
    const { error } = await supabase.from('system_logs').insert(
      entries.map(e => ({
        level: e.level,
        service: e.service,
        message: e.message,
        details: e.details ? JSON.stringify(e.details) : null,
        created_at: e.created_at || new Date().toISOString(),
      }))
    );

    if (error) {
      console.error('Failed to flush logs to database:', error);
    }
  } catch (err) {
    console.error('Error flushing logs:', err);
  }
}

// Force flush (call on app close)
export function forceFlushLogs(): Promise<void> {
  return flushLogs();
}

// ============================================================
// HEALTH CHECK
// ============================================================

const healthCheckCache: Map<ServiceName, HealthStatus> = new Map();
const HEALTH_CHECK_TTL = 60000; // 1 minute

export async function checkServiceHealth(service: ServiceName): Promise<HealthStatus> {
  // Check cache first
  const cached = healthCheckCache.get(service);
  if (cached && Date.now() - new Date(cached.last_check).getTime() < HEALTH_CHECK_TTL) {
    return cached;
  }

  const startTime = performance.now();
  let status: 'healthy' | 'degraded' | 'down' = 'healthy';

  try {
    switch (service) {
      case 'database': {
        await supabase.from('profiles').select('id').limit(1).throwOnError();
        break;
      }
      case 'api':
      case 'ai':
      case 'ocr': {
        // Just mark as healthy for now - could ping actual endpoints
        break;
      }
      default:
        break;
    }
  } catch {
    status = 'down';
  }

  const responseTime = performance.now() - startTime;
  const health: HealthStatus = {
    service,
    status,
    last_check: new Date().toISOString(),
    response_time_ms: responseTime,
  };

  healthCheckCache.set(service, health);
  return health;
}

// Get all services health
export async function getAllHealth(): Promise<HealthStatus[]> {
  const services: ServiceName[] = ['database', 'api', 'ai', 'ocr'];
  return Promise.all(services.map(checkServiceHealth));
}

// ============================================================
// AGGREGATED ANALYTICS
// ============================================================

export async function getErrorAnalytics(hours: number = 24): Promise<{
  total: number;
  by_service: Record<ServiceName, number>;
  by_level: Record<LogLevel, number>;
}> {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - hours);

  try {
    const { data, error } = await supabase
      .from('system_logs')
      .select('service, level')
      .gte('created_at', startDate.toISOString())
      .in('level', ['error', 'critical']);

    if (error) throw error;

    const result = {
      total: data?.length || 0,
      by_service: {} as Record<ServiceName, number>,
      by_level: {} as Record<LogLevel, number>,
    };

    data?.forEach(log => {
      result.by_service[log.service as ServiceName] = (result.by_service[log.service as ServiceName] || 0) + 1;
      result.by_level[log.level as LogLevel] = (result.by_level[log.level as LogLevel] || 0) + 1;
    });

    return result;
  } catch {
    return {
      total: 0,
      by_service: {},
      by_level: {},
    };
  }
}