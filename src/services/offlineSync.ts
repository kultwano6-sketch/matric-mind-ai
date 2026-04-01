// ============================================================
// Matric Mind AI - Offline Sync Service
// Client-side service for offline action queue and sync management
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================
// Types
// ============================================================

export interface OfflineAction {
  id: string;
  action_type: OfflineActionType;
  payload: Record<string, unknown>;
  created_at: string;
  sync_status: 'pending' | 'synced' | 'failed';
  synced_at?: string;
}

export type OfflineActionType =
  | 'quiz_completed'
  | 'study_session_logged'
  | 'challenge_completed';

export interface SyncResult {
  action_id: string;
  action_type: string;
  status: 'synced' | 'failed' | 'skipped';
  error?: string;
}

export interface SyncResponse {
  success: boolean;
  results: SyncResult[];
  summary: {
    total: number;
    synced: number;
    failed: number;
    skipped: number;
  };
}

// ============================================================
// Constants
// ============================================================

const QUEUE_STORAGE_KEY = 'matric_mind_offline_queue';
const LAST_SYNC_KEY = 'matric_mind_last_sync';
const AUTO_SYNC_LISTENER_KEY = 'matric_mind_auto_sync_listener';

// ============================================================
// Queue Management
// ============================================================

/**
 * Queue an action for offline sync
 */
export function queueAction(
  actionType: OfflineActionType,
  payload: Record<string, unknown>
): OfflineAction {
  const action: OfflineAction = {
    id: generateId(),
    action_type: actionType,
    payload,
    created_at: new Date().toISOString(),
    sync_status: 'pending',
  };

  const queue = getQueue();
  queue.push(action);
  saveQueue(queue);

  return action;
}

/**
 * Get all queued actions
 */
export function getQueuedActions(): OfflineAction[] {
  return getQueue().filter(a => a.sync_status === 'pending');
}

/**
 * Get all actions (including synced and failed)
 */
export function getAllActions(): OfflineAction[] {
  return getQueue();
}

/**
 * Get actions by status
 */
export function getActionsByStatus(status: OfflineAction['sync_status']): OfflineAction[] {
  return getQueue().filter(a => a.sync_status === status);
}

/**
 * Get the count of pending actions
 */
export function getPendingCount(): number {
  return getQueuedActions().length;
}

// ============================================================
// Sync Functions
// ============================================================

/**
 * Check if device is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Sync all pending actions with the server
 */
export async function syncAll(): Promise<SyncResponse> {
  if (!isOnline()) {
    throw new Error('Device is offline');
  }

  const pendingActions = getQueuedActions();

  if (pendingActions.length === 0) {
    return {
      success: true,
      results: [],
      summary: { total: 0, synced: 0, failed: 0, skipped: 0 },
    };
  }

  try {
    const response = await fetch(`${API_BASE}/api/offline-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: getUserId(),
        actions: pendingActions.map(a => ({
          id: a.id,
          action_type: a.action_type,
          payload: a.payload,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error('Sync request failed');
    }

    const data: SyncResponse = await response.json();

    // Update local queue with sync results
    const queue = getQueue();
    for (const result of data.results) {
      const actionIndex = queue.findIndex(a => a.id === result.action_id);
      if (actionIndex !== -1) {
        queue[actionIndex].sync_status = result.status as OfflineAction['sync_status'];
        if (result.status === 'synced') {
          queue[actionIndex].synced_at = new Date().toISOString();
        }
      }
    }
    saveQueue(queue);

    // Update last sync time
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

    return data;
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}

/**
 * Clear all synced actions from the queue
 */
export function clearSynced(): number {
  const queue = getQueue();
  const syncedCount = queue.filter(a => a.sync_status === 'synced').length;
  const remaining = queue.filter(a => a.sync_status !== 'synced');
  saveQueue(remaining);
  return syncedCount;
}

/**
 * Clear all actions from the queue (regardless of status)
 */
export function clearAll(): number {
  const queue = getQueue();
  const count = queue.length;
  saveQueue([]);
  return count;
}

/**
 * Retry failed actions
 */
export function retryFailed(): void {
  const queue = getQueue();
  for (const action of queue) {
    if (action.sync_status === 'failed') {
      action.sync_status = 'pending';
    }
  }
  saveQueue(queue);
}

/**
 * Get last sync timestamp
 */
export function getLastSyncTime(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

/**
 * Format last sync time for display
 */
export function formatLastSync(): string {
  const lastSync = getLastSyncTime();
  if (!lastSync) return 'Never synced';

  const date = new Date(lastSync);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-ZA');
}

// ============================================================
// Auto-Sync Listeners
// ============================================================

let syncListenerAttached = false;

/**
 * Set up automatic sync when coming back online
 */
export function setupSyncListener(
  onSyncStart?: () => void,
  onSyncComplete?: (results: SyncResponse) => void,
  onSyncError?: (error: Error) => void
): () => void {
  if (syncListenerAttached) {
    console.warn('Sync listener already attached');
    return () => {};
  }

  const handleOnline = async () => {
    const pendingCount = getPendingCount();
    if (pendingCount === 0) return;

    onSyncStart?.();
    try {
      const results = await syncAll();
      onSyncComplete?.(results);
    } catch (error) {
      onSyncError?.(error as Error);
    }
  };

  window.addEventListener('online', handleOnline);
  syncListenerAttached = true;
  localStorage.setItem(AUTO_SYNC_LISTENER_KEY, 'true');

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    syncListenerAttached = false;
    localStorage.removeItem(AUTO_SYNC_LISTENER_KEY);
  };
}

/**
 * Check if auto-sync listener is attached
 */
export function isSyncListenerAttached(): boolean {
  return syncListenerAttached;
}

// ============================================================
// Storage Helpers
// ============================================================

function getQueue(): OfflineAction[] {
  try {
    const data = localStorage.getItem(QUEUE_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: OfflineAction[]): void {
  // Keep max 1000 actions to avoid storage issues
  const trimmed = queue.slice(-1000);
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(trimmed));
}

function generateId(): string {
  return `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getUserId(): string {
  // Try to get from auth - this may not always be available
  // The actual user_id should be passed when calling syncAll
  try {
    const authData = localStorage.getItem('supabase.auth.token');
    if (authData) {
      const parsed = JSON.parse(authData);
      return parsed?.user?.id || '';
    }
  } catch {
    // Ignore
  }
  return '';
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get storage usage estimate for offline queue
 */
export function getStorageUsage(): {
  actionCount: number;
  estimatedSizeKB: number;
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
} {
  const queue = getQueue();
  const dataSize = localStorage.getItem(QUEUE_STORAGE_KEY)?.length || 0;

  return {
    actionCount: queue.length,
    estimatedSizeKB: Math.round(dataSize / 1024 * 10) / 10,
    pendingCount: queue.filter(a => a.sync_status === 'pending').length,
    syncedCount: queue.filter(a => a.sync_status === 'synced').length,
    failedCount: queue.filter(a => a.sync_status === 'failed').length,
  };
}

/**
 * Pre-connectivity check with visual feedback
 */
export function setupConnectivityIndicator(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  const handleOnline = () => onOnline();
  const handleOffline = () => onOffline();

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Check initial state
  if (!isOnline()) {
    onOffline();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
