// System Health Monitor Component
// Part 6: Monitoring - Visual health dashboard

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Server, 
  Brain, 
  Database,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getNetworkStatus } from '@/hooks/useNetworkStatus';
import { checkServiceHealth, getAllHealth, type HealthStatus } from '@/services/monitoring';

interface SystemStatusProps {
  compact?: boolean;
  showDetails?: boolean;
}

export function SystemStatus({ compact = false, showDetails = false }: SystemStatusProps) {
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const checkHealth = async () => {
    setIsLoading(true);
    try {
      const [onlineStatus, healthData] = await Promise.all([
        Promise.resolve(getNetworkStatus()),
        getAllHealth(),
      ]);
      setIsOnline(onlineStatus);
      setHealth(healthData);
      setLastCheck(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Health check failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
          isOnline 
            ? 'bg-green-100 text-green-700' 
            : 'bg-red-100 text-red-700'
        }`}>
          {isOnline ? (
            <>
              <CheckCircle className="w-3 h-3" />
              Online
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3" />
              Offline
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            System Status
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={checkHealth}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Network Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className="text-sm">Network</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${
            isOnline 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {isOnline ? 'Connected' : 'Offline'}
          </span>
        </div>

        {/* Services */}
        {showDetails && health.map((service) => (
          <div key={service.service} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {service.service === 'database' && <Database className="w-4 h-4" />}
              {service.service === 'ai' && <Brain className="w-4 h-4" />}
              {service.service === 'ocr' && <Server className="w-4 h-4" />}
              {service.service === 'api' && <Activity className="w-4 h-4" />}
              <span className="text-sm capitalize">{service.service}</span>
            </div>
            <div className="flex items-center gap-2">
              {service.response_time_ms && (
                <span className="text-xs text-muted-foreground">
                  {Math.round(service.response_time_ms)}ms
                </span>
              )}
              <span className={`text-xs px-2 py-1 rounded ${
                service.status === 'healthy' 
                  ? 'bg-green-100 text-green-700' 
                  : service.status === 'degraded'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {service.status}
              </span>
            </div>
          </div>
        ))}

        {/* Last Check */}
        {lastCheck && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            Last checked: {lastCheck}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Status indicator for navbar
export function StatusIndicator() {
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

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
      isOnline 
        ? 'bg-green-100 text-green-700' 
        : 'bg-amber-100 text-amber-700'
    }`}>
      <motion.div
        animate={{
          scale: isOnline ? 1 : [1, 1.2, 1],
        }}
        transition={{
          repeat: isOnline ? 0 : Infinity,
          duration: 1,
        }}
      >
        {isOnline ? (
          <CheckCircle className="w-3 h-3" />
        ) : (
          <AlertTriangle className="w-3 h-3" />
        )}
      </motion.div>
      <span>{isOnline ? 'Online' : 'Offline'}</span>
    </div>
  );
}

export default SystemStatus;