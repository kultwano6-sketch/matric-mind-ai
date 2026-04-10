// Performance monitoring hook - tracks and reports performance metrics
import { useState, useEffect, useCallback, useRef } from 'react';

export interface PerformanceMetrics {
  // Timing metrics
  pageLoadTime: number | null;
  apiResponseTime: number | null;
  renderTime: number | null;
  // Counters
  apiCalls: number;
  failedCalls: number;
  ocrRequests: number;
  failedOCR: number;
  // Current state
  isLoading: boolean;
  lastError: string | null;
  slowRequests: string[];
}

interface PerformanceMarker {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

const SLOW_THRESHOLD_MS = 2000; // Consider request slow if > 2s

export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    pageLoadTime: null,
    apiResponseTime: null,
    renderTime: null,
    apiCalls: 0,
    failedCalls: 0,
    ocrRequests: 0,
    failedOCR: 0,
    isLoading: false,
    lastError: null,
    slowRequests: [],
  });

  const activeRequests = useRef<Map<string, PerformanceMarker>>(new Map());
  const renderStart = useRef<number>(0);

  // Mark start of an operation
  const markStart = useCallback((name: string) => {
    const marker: PerformanceMarker = {
      name,
      startTime: performance.now(),
    };
    activeRequests.current.set(name, marker);
    setMetrics(prev => ({ ...prev, isLoading: true }));
  }, []);

  // Mark end of an operation
  const markEnd = useCallback((name: string, success: boolean = true, isOCR: boolean = false) => {
    const marker = activeRequests.current.get(name);
    if (!marker) return;

    const endTime = performance.now();
    const duration = endTime - marker.startTime;
    marker.endTime = endTime;
    marker.duration = duration;

    // Update metrics
    setMetrics(prev => {
      const newMetrics = { ...prev };
      newMetrics.isLoading = false;

      // Track API response time
      if (name.startsWith('api_')) {
        newMetrics.apiResponseTime = duration;
        newMetrics.apiCalls = (newMetrics.apiCalls || 0) + 1;
        if (!success) {
          newMetrics.failedCalls = (newMetrics.failedCalls || 0) + 1;
        }
      }

      // Track OCR specifically
      if (isOCR) {
        newMetrics.ocrRequests = (newMetrics.ocrRequests || 0) + 1;
        if (!success) {
          newMetrics.failedOCR = (newMetrics.failedOCR || 0) + 1;
        }
      }

      // Track slow requests
      if (duration > SLOW_THRESHOLD_MS) {
        newMetrics.slowRequests = [
          ...newMetrics.slowRequests.slice(-4),
          `${name}: ${Math.round(duration)}ms`,
        ];
      }

      if (!success) {
        newMetrics.lastError = `Failed: ${name} (${Math.round(duration)}ms)`;
      }

      return newMetrics;
    });

    activeRequests.current.delete(name);
  }, []);

  // Track page load
  useEffect(() => {
    const loadTime = performance.timing?.loadEventEnd - performance.timing?.navigationStart;
    if (loadTime && loadTime > 0) {
      setMetrics(prev => ({ ...prev, pageLoadTime: loadTime }));
    }
  }, []);

  // Track render time
  const trackRender = useCallback(() => {
    const renderTime = performance.now() - renderStart.current;
    setMetrics(prev => ({ ...prev, renderTime }));
  }, []);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      apiResponseTime: null,
      renderTime: null,
      isLoading: false,
      lastError: null,
      slowRequests: [],
    }));
  }, []);

  // Get summary stats
  const getStats = useCallback(() => {
    const {
      apiCalls,
      failedCalls,
      ocrRequests,
      failedOCR,
      apiResponseTime,
      slowRequests,
    } = metrics;

    const apiFailureRate = apiCalls > 0 ? Math.round((failedCalls / apiCalls) * 100) : 0;
    const ocrFailureRate = ocrRequests > 0 ? Math.round((failedOCR / ocrRequests) * 100) : 0;

    return {
      apiCalls,
      failedCalls,
      apiFailureRate,
      ocrRequests,
      failedOCR,
      ocrFailureRate,
      avgResponseTime: apiResponseTime ? Math.round(apiResponseTime) : null,
      slowRequests,
    };
  }, [metrics]);

  return {
    metrics,
    markStart,
    markEnd,
    trackRender,
    resetMetrics,
    getStats,
  };
}

// Export singleton for API layer access
let globalMetrics: PerformanceMetrics = {
  pageLoadTime: null,
  apiResponseTime: null,
  renderTime: null,
  apiCalls: 0,
  failedCalls: 0,
  ocrRequests: 0,
  failedOCR: 0,
  isLoading: false,
  lastError: null,
  slowRequests: [],
};

export function getGlobalMetrics(): PerformanceMetrics {
  return { ...globalMetrics };
}

export function updateGlobalMetrics(updates: Partial<PerformanceMetrics>) {
  globalMetrics = { ...globalMetrics, ...updates };
}