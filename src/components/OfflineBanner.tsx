// Offline Banner - Shows when user loses internet connection

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, Clock } from 'lucide-react';
import { getNetworkStatus } from '@/hooks/useNetworkStatus';

interface OfflineBannerProps {
  autoHide?: boolean; // Auto-hide after coming back online
  autoHideDelay?: number; // ms to wait before hiding
}

export function OfflineBanner({ autoHide = true, autoHideDelay = 3000 }: OfflineBannerProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnecting, setShowReconnecting] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnecting(true);
      
      if (autoHide) {
        setTimeout(() => {
          setShowReconnecting(false);
        }, autoHideDelay);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnecting(false);
    };

    // Initial check
    setIsOnline(getNetworkStatus());

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also poll every few seconds as backup
    const interval = setInterval(() => {
      const status = getNetworkStatus();
      if (status !== isOnline) {
        if (status) handleOnline();
        else handleOffline();
      }
    }, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isOnline, autoHide, autoHideDelay]);

  // Don't show anything if online and not reconnecting
  if (isOnline && !showReconnecting) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-50"
      >
        <div className={`
          flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium
          ${isOnline 
            ? 'bg-green-600 text-white' 
            : 'bg-amber-600 text-white'
          }
        `}>
          {isOnline ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Reconnecting...</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span>You are offline. Some features may not work.</span>
              <button
                onClick={() => window.location.reload()}
                className="ml-2 px-3 py-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Compact offline indicator for header/toolbar
export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(getNetworkStatus());
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-xs">
      <WifiOff className="w-3 h-3" />
      <span>Offline</span>
    </div>
  );
}

export default OfflineBanner;