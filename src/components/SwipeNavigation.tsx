import { ReactNode, useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SwipeNavigationProps {
  children: ReactNode;
}

// Navigation history with timestamps for 5-min refresh
interface HistoryEntry {
  path: string;
  timestamp: number;
}

const EXCLUDED_PATHS = ['/', '/auth', '/reset-password'];
const SWIPE_THRESHOLD = 80; // pixels
const SWIPE_EDGE_ZONE = 50; // pixels from edge to start swipe
const REFRESH_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export default function SwipeNavigation({ children }: SwipeNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [swipeIndicator, setSwipeIndicator] = useState<'back' | 'forward' | null>(null);

  // Track navigation history
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef<number>(-1);

  // Record navigation
  useEffect(() => {
    if (EXCLUDED_PATHS.includes(location.pathname)) return;

    const history = historyRef.current;
    const idx = historyIndexRef.current;

    // If we're navigating to a new path (not going back/forward)
    if (idx === -1 || history[idx]?.path !== location.pathname) {
      // Remove forward history if we navigate to a new page
      if (idx < history.length - 1) {
        historyRef.current = history.slice(0, idx + 1);
      }
      historyRef.current.push({ path: location.pathname, timestamp: Date.now() });
      historyIndexRef.current = historyRef.current.length - 1;
    }
  }, [location.pathname]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (EXCLUDED_PATHS.includes(location.pathname)) return;
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, [location.pathname]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;

    const deltaX = e.touches[0].clientX - touchStart.current.x;
    const deltaY = e.touches[0].clientY - touchStart.current.y;

    // Only trigger if horizontal swipe is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
      if (deltaX > 0 && historyIndexRef.current > 0) {
        setSwipeIndicator('back');
      } else if (deltaX < 0 && historyIndexRef.current < historyRef.current.length - 1) {
        setSwipeIndicator('forward');
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;

    const deltaX = e.changedTouches[0].clientX - touchStart.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStart.current.y;

    // Only handle horizontal swipes
    if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
      const history = historyRef.current;
      const idx = historyIndexRef.current;

      if (deltaX > 0 && idx > 0) {
        // Swipe right → go back
        const target = history[idx - 1];
        // Check if page needs refresh (5 min timeout)
        if (Date.now() - target.timestamp > REFRESH_TIMEOUT) {
          // Update timestamp and force refresh
          history[idx - 1].timestamp = Date.now();
          navigate(target.path, { replace: true });
          // Force a full reload by navigating twice
          setTimeout(() => window.location.href = target.path, 0);
        } else {
          navigate(target.path);
        }
        historyIndexRef.current = idx - 1;
      } else if (deltaX < 0 && idx < history.length - 1) {
        // Swipe left → go forward
        const target = history[idx + 1];
        if (Date.now() - target.timestamp > REFRESH_TIMEOUT) {
          history[idx + 1].timestamp = Date.now();
          setTimeout(() => window.location.href = target.path, 0);
        } else {
          navigate(target.path);
        }
        historyIndexRef.current = idx + 1;
      }
    }

    touchStart.current = null;
    setSwipeIndicator(null);
  }, [navigate]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative min-h-screen"
    >
      {/* Swipe indicator overlay */}
      {swipeIndicator && (
        <div className={`fixed top-1/2 -translate-y-1/2 z-[100] px-4 py-2 rounded-full bg-primary/80 text-primary-foreground text-sm font-medium backdrop-blur-sm transition-opacity ${
          swipeIndicator === 'back' ? 'left-4' : 'right-4'
        }`}>
          {swipeIndicator === 'back' ? '← Back' : 'Forward →'}
        </div>
      )}
      {children}
    </div>
  );
}
