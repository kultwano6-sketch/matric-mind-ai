import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

// IndexedDB wrapper for offline storage
const DB_NAME = 'matricmind-offline';
const DB_VERSION = 1;

interface OfflineLesson {
  id: string;
  subject: MatricSubject;
  topic: string;
  content: string;
  cachedAt: string;
}

interface OfflineAssignment {
  id: string;
  title: string;
  subject: MatricSubject;
  questions: any;
  cachedAt: string;
}

interface OfflineQuizResult {
  id: string;
  subject: MatricSubject;
  answers: any;
  completedAt: string;
  synced: boolean;
}

interface OfflineContextType {
  isOnline: boolean;
  isOfflineModeEnabled: boolean;
  cachedLessons: OfflineLesson[];
  cachedAssignments: OfflineAssignment[];
  pendingSyncs: number;
  toggleOfflineMode: () => void;
  cacheLesson: (lesson: Omit<OfflineLesson, 'cachedAt'>) => Promise<void>;
  cacheAssignment: (assignment: Omit<OfflineAssignment, 'cachedAt'>) => Promise<void>;
  removeCachedLesson: (id: string) => Promise<void>;
  removeCachedAssignment: (id: string) => Promise<void>;
  saveOfflineQuizResult: (result: Omit<OfflineQuizResult, 'synced'>) => Promise<void>;
  syncPendingData: () => Promise<void>;
  getCachedLesson: (id: string) => OfflineLesson | undefined;
  getCachedAssignment: (id: string) => OfflineAssignment | undefined;
  getOfflineStorageUsage: () => Promise<{ used: number; quota: number }>;
  clearAllOfflineData: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('lessons')) {
        db.createObjectStore('lessons', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('assignments')) {
        db.createObjectStore('assignments', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('quizResults')) {
        const store = db.createObjectStore('quizResults', { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function put<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function remove(storeName: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isOfflineModeEnabled, setIsOfflineModeEnabled] = useState(false);
  const [cachedLessons, setCachedLessons] = useState<OfflineLesson[]>([]);
  const [cachedAssignments, setCachedAssignments] = useState<OfflineAssignment[]>([]);
  const [pendingSyncs, setPendingSyncs] = useState(0);

  // Load initial data from IndexedDB
  useEffect(() => {
    const loadOfflineData = async () => {
      try {
        const lessons = await getAll<OfflineLesson>('lessons');
        const assignments = await getAll<OfflineAssignment>('assignments');
        const quizResults = await getAll<OfflineQuizResult>('quizResults');
        const unsyncedResults = quizResults.filter(r => !r.synced);
        
        setCachedLessons(lessons);
        setCachedAssignments(assignments);
        setPendingSyncs(unsyncedResults.length);

        // Load offline mode setting
        const settings = await getAll<{ key: string; value: boolean }>('settings');
        const offlineSetting = settings.find(s => s.key === 'offlineModeEnabled');
        if (offlineSetting) {
          setIsOfflineModeEnabled(offlineSetting.value);
        }
      } catch (error) {
        console.error('Failed to load offline data:', error);
      }
    };

    loadOfflineData();
  }, []);

  // Network status listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      syncPendingData();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleOfflineMode = useCallback(async () => {
    const newValue = !isOfflineModeEnabled;
    setIsOfflineModeEnabled(newValue);
    await put('settings', { key: 'offlineModeEnabled', value: newValue });
  }, [isOfflineModeEnabled]);

  const cacheLesson = useCallback(async (lesson: Omit<OfflineLesson, 'cachedAt'>) => {
    const lessonWithTimestamp: OfflineLesson = {
      ...lesson,
      cachedAt: new Date().toISOString(),
    };
    await put('lessons', lessonWithTimestamp);
    setCachedLessons(prev => {
      const filtered = prev.filter(l => l.id !== lesson.id);
      return [...filtered, lessonWithTimestamp];
    });
  }, []);

  const cacheAssignment = useCallback(async (assignment: Omit<OfflineAssignment, 'cachedAt'>) => {
    const assignmentWithTimestamp: OfflineAssignment = {
      ...assignment,
      cachedAt: new Date().toISOString(),
    };
    await put('assignments', assignmentWithTimestamp);
    setCachedAssignments(prev => {
      const filtered = prev.filter(a => a.id !== assignment.id);
      return [...filtered, assignmentWithTimestamp];
    });
  }, []);

  const removeCachedLesson = useCallback(async (id: string) => {
    await remove('lessons', id);
    setCachedLessons(prev => prev.filter(l => l.id !== id));
  }, []);

  const removeCachedAssignment = useCallback(async (id: string) => {
    await remove('assignments', id);
    setCachedAssignments(prev => prev.filter(a => a.id !== id));
  }, []);

  const saveOfflineQuizResult = useCallback(async (result: Omit<OfflineQuizResult, 'synced'>) => {
    const resultWithSyncStatus: OfflineQuizResult = {
      ...result,
      synced: false,
    };
    await put('quizResults', resultWithSyncStatus);
    setPendingSyncs(prev => prev + 1);
  }, []);

  const syncPendingData = useCallback(async () => {
    if (!isOnline) return;

    try {
      const quizResults = await getAll<OfflineQuizResult>('quizResults');
      const unsyncedResults = quizResults.filter(r => !r.synced);

      for (const result of unsyncedResults) {
        try {
          // Sync to Supabase
          await supabase.from('assignment_submissions').insert({
            assignment_id: result.id,
            student_id: (await supabase.auth.getUser()).data.user?.id || '',
            answers: result.answers,
            submitted_at: result.completedAt,
          });

          // Mark as synced
          await put('quizResults', { ...result, synced: true });
        } catch (error) {
          console.error('Failed to sync quiz result:', error);
        }
      }

      // Refresh pending count
      const updatedResults = await getAll<OfflineQuizResult>('quizResults');
      setPendingSyncs(updatedResults.filter(r => !r.synced).length);
    } catch (error) {
      console.error('Failed to sync pending data:', error);
    }
  }, [isOnline]);

  const getCachedLesson = useCallback((id: string) => {
    return cachedLessons.find(l => l.id === id);
  }, [cachedLessons]);

  const getCachedAssignment = useCallback((id: string) => {
    return cachedAssignments.find(a => a.id === id);
  }, [cachedAssignments]);

  const getOfflineStorageUsage = useCallback(async (): Promise<{ used: number; quota: number }> => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { used: 0, quota: 0 };
  }, []);

  const clearAllOfflineData = useCallback(async () => {
    await clearStore('lessons');
    await clearStore('assignments');
    await clearStore('quizResults');
    setCachedLessons([]);
    setCachedAssignments([]);
    setPendingSyncs(0);
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isOfflineModeEnabled,
        cachedLessons,
        cachedAssignments,
        pendingSyncs,
        toggleOfflineMode,
        cacheLesson,
        cacheAssignment,
        removeCachedLesson,
        removeCachedAssignment,
        saveOfflineQuizResult,
        syncPendingData,
        getCachedLesson,
        getCachedAssignment,
        getOfflineStorageUsage,
        clearAllOfflineData,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
