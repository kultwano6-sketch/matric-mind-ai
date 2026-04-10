// Network status hook - monitors online/offline state
import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  wasOnline: boolean; // Track previous state for change detection
  connectionType: string | null;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOnline: true,
    connectionType: null,
  });

  useEffect(() => {
    // Get initial connection type
    const getConnectionType = () => {
      if (typeof navigator !== 'undefined' && 'connection' in navigator) {
        const conn = (navigator as any).connection;
        return conn?.effectiveType || conn?.type || null;
      }
      return null;
    };

    const handleOnline = () => {
      setStatus(prev => ({
        isOnline: true,
        wasOnline: prev.isOnline,
        connectionType: getConnectionType(),
      }));
    };

    const handleOffline = () => {
      setStatus(prev => ({
        isOnline: false,
        wasOnline: prev.isOnline,
        connectionType: null,
      }));
    };

    const handleConnectionChange = () => {
      setStatus(prev => ({
        ...prev,
        connectionType: getConnectionType(),
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes if available
    if ('connection' in navigator) {
      (navigator as any).connection?.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}

// Hook for handling offline-aware API calls
export function useOfflineAware() {
  const { isOnline } = useNetworkStatus();

  const fetchWithOfflineCheck = useCallback(async <T>(
    fetchFn: () => Promise<T>,
    offlineFallback?: T
  ): Promise<{ data: T | null; error: string | null; isOffline: boolean }> => {
    if (!isOnline) {
      return {
        data: offlineFallback || null,
        error: offlineFallback ? null : 'You are currently offline. Please check your internet connection.',
        isOffline: true,
      };
    }

    try {
      const data = await fetchFn();
      return { data, error: null, isOffline: false };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      return { data: null, error: errorMessage, isOffline: false };
    }
  }, [isOnline]);

  return { isOnline, fetchWithOfflineCheck };
}

// Global online status for components that can't use hooks
export const getNetworkStatus = (): boolean => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
};