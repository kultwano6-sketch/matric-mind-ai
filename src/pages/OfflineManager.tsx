// ============================================================
// Matric Mind AI - Offline Manager Page
// Manage offline sync queue and connectivity status
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Wifi, WifiOff, RefreshCw, Trash2, AlertCircle, CheckCircle2,
  Clock, Database, Shield, Zap, Smartphone, CloudOff, Cloud,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  isOnline,
  getQueuedActions,
  getAllActions,
  syncAll,
  clearSynced,
  clearAll,
  retryFailed,
  getLastSyncTime,
  formatLastSync,
  getStorageUsage,
  setupConnectivityIndicator,
  setupSyncListener,
  type OfflineAction,
} from '@/services/offlineSync';

const ACTION_TYPE_LABELS: Record<string, string> = {
  quiz_completed: 'Quiz Completed',
  study_session_logged: 'Study Session',
  challenge_completed: 'Challenge Completed',
};

const ACTION_TYPE_ICONS: Record<string, string> = {
  quiz_completed: '📝',
  study_session_logged: '📚',
  challenge_completed: '🏆',
};

export default function OfflineManager() {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actions, setActions] = useState<OfflineAction[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [storage, setStorage] = useState({ actionCount: 0, estimatedSizeKB: 0, pendingCount: 0, syncedCount: 0, failedCount: 0 });
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number; skipped: number } | null>(null);

  // Load data
  const loadData = useCallback(() => {
    setActions(getAllActions());
    setLastSync(getLastSyncTime());
    setStorage(getStorageUsage());
    setOnline(isOnline());
  }, []);

  useEffect(() => {
    loadData();

    // Set up connectivity listener
    const cleanup = setupConnectivityIndicator(
      () => {
        setOnline(true);
        loadData();
      },
      () => {
        setOnline(false);
      }
    );

    // Set up auto-sync
    const cleanupSync = setupSyncListener(
      () => setSyncing(true),
      (results) => {
        setSyncing(false);
        setSyncResult(results.summary);
        loadData();
      },
      () => setSyncing(false)
    );

    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);

    return () => {
      cleanup();
      cleanupSync();
      clearInterval(interval);
    };
  }, [loadData]);

  // Sync actions
  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncAll();
      setSyncResult(result.summary);
      loadData();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Clear synced actions
  const handleClearSynced = () => {
    const count = clearSynced();
    if (count > 0) {
      loadData();
    }
  };

  // Clear all actions
  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all queued actions?')) {
      clearAll();
      loadData();
    }
  };

  // Retry failed actions
  const handleRetryFailed = () => {
    retryFailed();
    loadData();
  };

  const pendingCount = actions.filter(a => a.sync_status === 'pending').length;
  const syncedCount = actions.filter(a => a.sync_status === 'synced').length;
  const failedCount = actions.filter(a => a.sync_status === 'failed').length;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold">Offline Manager</h1>
          <p className="text-muted-foreground mt-1">
            Manage offline actions and sync status
          </p>
        </div>

        {/* Connection Status */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className={`glass-card ${online ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={online ? {} : { scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      online
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-red-100 dark:bg-red-900/30'
                    }`}
                  >
                    {online ? (
                      <Wifi className="w-6 h-6 text-green-600" />
                    ) : (
                      <WifiOff className="w-6 h-6 text-red-600" />
                    )}
                  </motion.div>
                  <div>
                    <p className="font-semibold">
                      {online ? 'Connected' : 'Offline'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {online
                        ? 'Actions will sync automatically'
                        : 'Actions are being queued locally'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Last sync</p>
                  <p className="font-medium">{formatLastSync()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto mb-2">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold">{syncedCount}</p>
              <p className="text-xs text-muted-foreground">Synced</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-2xl font-bold">{failedCount}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </CardContent>
          </Card>
        </div>

        {/* Sync Result */}
        <AnimatePresence>
          {syncResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Card className="glass-card border-green-200 dark:border-green-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm">
                      Sync complete: {syncResult.synced} synced, {syncResult.failed} failed, {syncResult.skipped} skipped
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Storage Usage */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4" /> Storage Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{storage.actionCount} actions stored</span>
              <span className="font-medium">{storage.estimatedSizeKB} KB</span>
            </div>
            <Progress
              value={Math.min(100, (storage.actionCount / 1000) * 100)}
              className="h-2"
            />
            <p className="text-xs text-muted-foreground">
              Maximum 1000 actions can be queued
            </p>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSync}
            disabled={!online || syncing || pendingCount === 0}
          >
            {syncing ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4 mr-2" />
            )}
            Sync Now ({pendingCount})
          </Button>

          {failedCount > 0 && (
            <Button variant="outline" onClick={handleRetryFailed}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Failed
            </Button>
          )}

          {syncedCount > 0 && (
            <Button variant="outline" onClick={handleClearSynced}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Synced
            </Button>
          )}

          {actions.length > 0 && (
            <Button variant="outline" className="text-destructive" onClick={handleClearAll}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>

        {/* Queued Actions List */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm">Queued Actions</CardTitle>
            <CardDescription>
              Actions that will be synced when you reconnect
            </CardDescription>
          </CardHeader>
          <CardContent>
            {actions.length === 0 ? (
              <div className="text-center py-8">
                <CloudOff className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No queued actions</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Actions you perform offline will appear here
                </p>
              </div>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {actions.map((action) => (
                    <motion.div
                      key={action.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {ACTION_TYPE_ICONS[action.action_type] || '📋'}
                        </span>
                        <div>
                          <p className="text-sm font-medium">
                            {ACTION_TYPE_LABELS[action.action_type] || action.action_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(action.created_at).toLocaleString('en-ZA')}
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant={
                          action.sync_status === 'synced' ? 'default'
                            : action.sync_status === 'failed' ? 'destructive'
                            : 'outline'
                        }
                      >
                        {action.sync_status}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Offline Capabilities */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" /> Offline Capabilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Complete Quizzes</p>
                  <p className="text-xs text-muted-foreground">Finish quizzes offline, sync results later</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Log Study Sessions</p>
                  <p className="text-xs text-muted-foreground">Track study time, sync when online</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Daily Challenges</p>
                  <p className="text-xs text-muted-foreground">Complete challenges, sync completions</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">AI Tutor</p>
                  <p className="text-xs text-muted-foreground">Requires internet connection</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
