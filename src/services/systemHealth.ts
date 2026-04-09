// System observability - tracks AI, OCR, and API health

import { supabase } from '@/integrations/supabase/client';

// Health check types
export type ServiceStatus = 'online' | 'slow' | 'failed' | 'unknown';

export interface SystemHealth {
  ai: ServiceStatus;
  ocr: ServiceStatus;
  database: ServiceStatus;
  lastCheck: string;
  responseTimes: {
    ai?: number;
    ocr?: number;
    db?: number;
  };
}

export interface SystemLog {
  id?: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  service: 'ai' | 'ocr' | 'database' | 'api' | 'notification';
  message: string;
  details?: string;
  response_time_ms?: number;
  created_at: string;
}

// Initialize logging table
export async function initLoggingTable() {
  // This would be done via migration, but helper function for runtime
  console.log('System logging initialized');
}

// Log an event
export async function logEvent(log: Omit<SystemLog, 'id' | 'created_at'>) {
  try {
    await supabase.from('system_logs').insert({
      ...log,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log event:', error);
  }
}

// Log AI request/response
export async function logAIRequest(prompt: string, responseTime: number, success: boolean, error?: string) {
  await logEvent({
    level: success ? 'info' : 'error',
    service: 'ai',
    message: success ? 'AI request successful' : 'AI request failed',
    details: error ? `${error.substring(0, 200)}... Prompt: ${prompt.substring(0, 100)}` : undefined,
    response_time_ms: responseTime,
  });
}

// Log OCR request
export async function logOCRRequest(imageSize: number, responseTime: number, success: boolean, error?: string) {
  await logEvent({
    level: success ? 'info' : 'error',
    service: 'ocr',
    message: success ? 'OCR successful' : 'OCR failed',
    details: error ? `Error: ${error}` : `Image size: ${imageSize} bytes`,
    response_time_ms: responseTime,
  });
}

// Get recent logs
export async function getRecentLogs(limit: number = 50, service?: string): Promise<SystemLog[]> {
  try {
    let query = supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (service) {
      query = query.eq('service', service);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to get logs:', error);
    return [];
  }
}

// Get failure analytics
export async function getFailureAnalytics(days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    const { data, error } = await supabase
      .from('system_logs')
      .select('service, level, created_at')
      .gte('created_at', startDate.toISOString())
      .eq('level', 'error');

    if (error) throw error;

    // Group by service
    const byService: Record<string, number> = {};
    data?.forEach(log => {
      byService[log.service] = (byService[log.service] || 0) + 1;
    });

    return {
      totalFailures: data?.length || 0,
      byService,
      period: days,
    };
  } catch (error) {
    console.error('Failed to get analytics:', error);
    return { totalFailures: 0, byService: {}, period: days };
  }
}

// Get AI failure rate
export async function getAIFailureRate(hours: number = 24) {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - hours);

  try {
    const { data: allRequests } = await supabase
      .from('system_logs')
      .select('level')
      .eq('service', 'ai')
      .gte('created_at', startDate.toISOString());

    const { data: failedRequests } = await supabase
      .from('system_logs')
      .select('level')
      .eq('service', 'ai')
      .eq('level', 'error')
      .gte('created_at', startDate.toISOString());

    const total = allRequests?.length || 0;
    const failed = failedRequests?.length || 0;

    return {
      total,
      failed,
      rate: total > 0 ? Math.round((failed / total) * 100) : 0,
      period: hours,
    };
  } catch (error) {
    return { total: 0, failed: 0, rate: 0, period: hours };
  }
}

// Quick health check
export async function quickHealthCheck(): Promise<SystemHealth> {
  const health: SystemHealth = {
    ai: 'unknown',
    ocr: 'unknown',
    database: 'unknown',
    lastCheck: new Date().toISOString(),
    responseTimes: {},
  };

  // Check database
  const dbStart = Date.now();
  try {
    await supabase.from('profiles').select('id').limit(1);
    health.database = 'online';
    health.responseTimes.db = Date.now() - dbStart;
  } catch {
    health.database = 'failed';
  }

  return health;
}