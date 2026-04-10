// Loading and Error UI components for better UX
// Part 4: User Flow - Loading & Error States

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  WifiOff,
  Camera,
  ImageIcon,
  CheckCircle,
  AlertTriangle,
  Info,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// ============================================================
// LOADING STATES
// ============================================================

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  variant?: 'default' | 'spinner' | 'pulse' | 'dots';
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({
  message = 'Loading...',
  fullScreen = false,
  variant = 'spinner',
  size = 'md',
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  const renderSpinner = () => (
    <Loader2 className={`${sizeClasses[size]} animate-spin`} />
  );

  const renderPulse = () => (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className={`${size === 'sm' ? 'w-2 h-2' : size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} rounded-full bg-primary`}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );

  const renderDots = () => (
    <div className="flex gap-2">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className={`${size === 'sm' ? 'w-2 h-2' : size === 'lg' ? 'w-3 h-3' : 'w-2.5 h-2.5'} rounded-full bg-primary`}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      {variant === 'spinner' && renderSpinner()}
      {variant === 'pulse' && renderPulse()}
      {variant === 'dots' && renderDots()}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}

// Skeleton for content loading
export function ContentLoader({
  lines = 3,
}: {
  lines?: number;
}) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-muted rounded"
          style={{ width: `${70 + Math.random() * 30}%` }}
        />
      ))}
    </div>
  );
}

// ============================================================
// ERROR STATES
// ============================================================

type ErrorVariant = 'error' | 'warning' | 'info' | 'offline';

interface ErrorStateProps {
  message: string;
  variant?: ErrorVariant;
  onRetry?: () => void;
  showRetry?: boolean;
  fullScreen?: boolean;
  details?: string;
}

export function ErrorState({
  message,
  variant = 'error',
  onRetry,
  showRetry = true,
  fullScreen = false,
  details,
}: ErrorStateProps) {
  const [showDetails, setShowDetails] = useState(false);

  const icons = {
    error: <XCircle className="w-8 h-8 text-destructive" />,
    warning: <AlertTriangle className="w-8 h-8 text-amber-500" />,
    info: <Info className="w-8 h-8 text-blue-500" />,
    offline: <WifiOff className="w-8 h-8 text-amber-500" />,
  };

  const variants = {
    error: 'border-destructive/20 bg-destructive/5',
    warning: 'border-amber-500/20 bg-amber-500/5',
    info: 'border-blue-500/20 bg-blue-500/5',
    offline: 'border-amber-500/20 bg-amber-500/5',
  };

  const content = (
    <Card className={variants[variant]}>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center gap-4">
          {icons[variant]}

          <div className="space-y-2">
            <p className="font-medium">{message}</p>
            {details && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? 'Hide' : 'Show'} Details
              </Button>
            )}
            {showDetails && details && (
              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                {details}
              </p>
            )}
          </div>

          {showRetry && onRetry && (
            <Button onClick={onRetry} className="mt-2">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (fullScreen) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        {content}
      </div>
    );
  }

  return content;
}

// ============================================================
// EMPTY STATES
// ============================================================

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <h3 className="font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

// ============================================================
// SUCCESS STATE
// ============================================================

interface SuccessStateProps {
  message?: string;
  onContinue?: () => void;
}

export function SuccessState({
  message = 'Success!',
  onContinue,
}: SuccessStateProps) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center text-center gap-4 py-8"
    >
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>
      <p className="font-medium">{message}</p>
      {onContinue && (
        <Button onClick={onContinue}>Continue</Button>
      )}
    </motion.div>
  );
}

// ============================================================
// INLINE STATUS
// ============================================================

interface InlineStatusProps {
  type: 'loading' | 'error' | 'success' | 'warning' | 'info';
  message: string;
}

export function InlineStatus({ type, message }: InlineStatusProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    setShow(true);
  }, [message]);

  if (!show) return null;

  const variants = {
    loading: 'bg-primary/10 text-primary',
    error: 'bg-destructive/10 text-destructive',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
  };

  const icons = {
    loading: <Loader2 className="w-4 h-4 animate-spin" />,
    error: <XCircle className="w-4 h-4" />,
    success: <CheckCircle className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    info: <Info className="w-4 h-4" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${variants[type]}`}
    >
      {icons[type]}
      <span>{message}</span>
    </motion.div>
  );
}

// ============================================================
// ADAPTIVE CONTENT WRAPPER
// ============================================================

interface AdaptiveContentProps {
  isLoading?: boolean;
  isEmpty?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  children: React.ReactNode;
  loadingMessage?: string;
}

export function AdaptiveContent({
  isLoading = false,
  isEmpty = false,
  isError = false,
  errorMessage,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyIcon,
  children,
  loadingMessage,
}: AdaptiveContentProps) {
  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <LoadingState message={loadingMessage} />
        </motion.div>
      )}

      {isError && (
        <motion.div
          key="error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <ErrorState
            message={errorMessage || 'Something went wrong'}
            fullScreen={false}
          />
        </motion.div>
      )}

      {isEmpty && (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
          />
        </motion.div>
      )}

      {!isLoading && !isError && !isEmpty && (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}