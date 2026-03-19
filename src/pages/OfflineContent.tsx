import { useOffline } from '@/hooks/useOffline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { CloudOff, Trash2, RefreshCw, HardDrive, WifiOff, Wifi, Download, BookOpen, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

export default function OfflineContent() {
  const {
    isOnline,
    isOfflineModeEnabled,
    cachedLessons,
    cachedAssignments,
    pendingSyncs,
    toggleOfflineMode,
    removeCachedLesson,
    removeCachedAssignment,
    syncPendingData,
    clearAllOfflineData,
    getOfflineStorageUsage,
  } = useOffline();

  const [storageUsage, setStorageUsage] = useState({ used: 0, quota: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    getOfflineStorageUsage().then(setStorageUsage);
  }, [getOfflineStorageUsage, cachedLessons, cachedAssignments]);

  const handleSync = async () => {
    setIsSyncing(true);
    await syncPendingData();
    setIsSyncing(false);
    toast.success('All data synced successfully');
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    await clearAllOfflineData();
    setIsClearing(false);
    toast.success('Offline data cleared');
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const usagePercentage = storageUsage.quota > 0 
    ? (storageUsage.used / storageUsage.quota) * 100 
    : 0;

  // Group content by subject
  const lessonsBySubject = cachedLessons.reduce((acc, lesson) => {
    if (!acc[lesson.subject]) acc[lesson.subject] = [];
    acc[lesson.subject].push(lesson);
    return acc;
  }, {} as Record<MatricSubject, typeof cachedLessons>);

  const assignmentsBySubject = cachedAssignments.reduce((acc, assignment) => {
    if (!acc[assignment.subject]) acc[assignment.subject] = [];
    acc[assignment.subject].push(assignment);
    return acc;
  }, {} as Record<MatricSubject, typeof cachedAssignments>);

  const allSubjects = [...new Set([
    ...Object.keys(lessonsBySubject),
    ...Object.keys(assignmentsBySubject),
  ])] as MatricSubject[];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <CloudOff className="w-8 h-8" />
            Offline Content
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your downloaded content for offline studying
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Badge className="gap-1 bg-[hsl(var(--teacher-accent))] text-white">
              <Wifi className="w-3 h-3" />
              Online
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <WifiOff className="w-3 h-3" />
              Offline
            </Badge>
          )}
        </div>
      </div>

      {/* Storage & Settings Card */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Storage Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className="font-medium">
                  {formatBytes(storageUsage.used)} / {formatBytes(storageUsage.quota)}
                </span>
              </div>
              <Progress value={usagePercentage} className="h-2" />
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{cachedLessons.length}</p>
                <p className="text-xs text-muted-foreground">Lessons</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{cachedAssignments.length}</p>
                <p className="text-xs text-muted-foreground">Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Settings & Sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Data Saver Mode</p>
                <p className="text-sm text-muted-foreground">
                  Reduce data usage when browsing
                </p>
              </div>
              <Switch
                checked={isOfflineModeEnabled}
                onCheckedChange={toggleOfflineMode}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={handleSync}
                disabled={!isOnline || pendingSyncs === 0 || isSyncing}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync ({pendingSyncs})
              </Button>
              <Button
                variant="destructive"
                className="gap-2"
                onClick={handleClearAll}
                disabled={isClearing || (cachedLessons.length === 0 && cachedAssignments.length === 0)}
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Syncs Alert */}
      {pendingSyncs > 0 && (
        <Card className="border-accent bg-accent/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Pending Offline Work</p>
              <p className="text-sm text-muted-foreground">
                You have {pendingSyncs} quiz result{pendingSyncs !== 1 ? 's' : ''} waiting to sync
              </p>
            </div>
            {isOnline && (
              <Button onClick={handleSync} disabled={isSyncing}>
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Downloaded Content by Subject */}
      {allSubjects.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-display font-semibold">Downloaded Content</h2>
          {allSubjects.map(subject => (
            <Card key={subject} className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>{SUBJECT_ICONS[subject]}</span>
                  {SUBJECT_LABELS[subject]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Lessons */}
                {lessonsBySubject[subject]?.map(lesson => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[hsl(var(--student-accent))]/20 flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-[hsl(var(--student-accent))]" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{lesson.topic}</p>
                        <p className="text-xs text-muted-foreground">
                          Saved {new Date(lesson.cachedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeCachedLesson(lesson.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                {/* Assignments */}
                {assignmentsBySubject[subject]?.map(assignment => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[hsl(var(--teacher-accent))]/20 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-[hsl(var(--teacher-accent))]" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{assignment.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Saved {new Date(assignment.cachedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeCachedAssignment(assignment.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <Download className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Offline Content</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              You haven't downloaded any content yet. Go to your lessons or assignments
              and tap the download icon to save them for offline studying.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tips Card */}
      <Card className="glass-card border-[hsl(var(--student-accent))]/30">
        <CardContent className="p-6">
          <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
            <CloudOff className="w-5 h-5" />
            Offline Study Tips
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-[hsl(var(--student-accent))]">•</span>
              Download lessons before going to areas with poor internet
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[hsl(var(--student-accent))]">•</span>
              Quiz answers are saved automatically and synced when online
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[hsl(var(--student-accent))]">•</span>
              AI Tutor requires internet - download lessons instead
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[hsl(var(--student-accent))]">•</span>
              Clear old content regularly to save storage space
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
