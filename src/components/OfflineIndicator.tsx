import { useOffline } from '@/hooks/useOffline';
import { Wifi, WifiOff, CloudOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

export function OfflineIndicator() {
  const { isOnline, pendingSyncs, syncPendingData } = useOffline();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    await syncPendingData();
    setIsSyncing(false);
  };

  if (isOnline && pendingSyncs === 0) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 left-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all ${
      isOnline ? 'bg-accent text-accent-foreground' : 'bg-destructive text-destructive-foreground'
    }`}>
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          <span className="text-sm font-medium">Online</span>
          {pendingSyncs > 0 && (
            <>
              <Badge variant="secondary" className="ml-1">
                {pendingSyncs} to sync
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={handleSync}
                disabled={isSyncing}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </Button>
            </>
          )}
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">Offline</span>
          {pendingSyncs > 0 && (
            <Badge variant="secondary" className="ml-1 bg-white/20">
              {pendingSyncs} pending
            </Badge>
          )}
        </>
      )}
    </div>
  );
}

export function OfflineBadge({ className = '' }: { className?: string }) {
  const { isOnline } = useOffline();

  if (isOnline) return null;

  return (
    <Badge variant="destructive" className={`gap-1 ${className}`}>
      <CloudOff className="w-3 h-3" />
      Offline
    </Badge>
  );
}

export function DownloadForOfflineButton({
  onDownload,
  isDownloaded,
  size = 'sm',
}: {
  onDownload: () => Promise<void>;
  isDownloaded: boolean;
  size?: 'sm' | 'default' | 'lg';
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload();
    } finally {
      setIsDownloading(false);
    }
  };

  if (isDownloaded) {
    return (
      <Badge variant="outline" className="gap-1 text-[hsl(var(--teacher-accent))]">
        <CloudOff className="w-3 h-3" />
        Saved offline
      </Badge>
    );
  }

  return (
    <Button
      size={size}
      variant="outline"
      onClick={handleDownload}
      disabled={isDownloading}
      className="gap-1"
    >
      {isDownloading ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : (
        <CloudOff className="w-4 h-4" />
      )}
      Save offline
    </Button>
  );
}
