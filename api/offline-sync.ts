// ============================================================
// Matric Mind AI - Offline Sync API
// Handles offline action queue synchronization
// ============================================================

import { getSupabase } from '../server/supabaseClient';

export const maxDuration = 60;
export const runtime = 'edge';

interface OfflineAction {
  id: string;
  action_type: string;
  payload: Record<string, unknown>;
}

interface SyncRequest {
  user_id: string;
  actions: OfflineAction[];
}

interface SyncResult {
  action_id: string;
  action_type: string;
  status: 'synced' | 'failed' | 'skipped';
  error?: string;
}

/**
 * POST /api/offline-sync
 *
 * Syncs offline actions that were queued while the student was offline.
 *
 * Body:
 * {
 *   user_id: string,
 *   actions: [
 *     { id: string, action_type: string, payload: object },
 *     ...
 *   ]
 * }
 *
 * Supported action_types:
 * - quiz_completed: { quiz_result_id, score, subject, answers }
 * - study_session_logged: { session_id, subject, duration_sec, started_at, ended_at }
 * - challenge_completed: { challenge_id, answer, is_correct }
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: SyncRequest = await req.json();
    const { user_id, actions } = body;

    if (!user_id || !actions || !Array.isArray(actions)) {
      return new Response(JSON.stringify({ error: 'Missing required fields: user_id, actions' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results: SyncResult[] = [];

    for (const action of actions) {
      const result = await processAction(supabase, user_id, action);
      results.push(result);
    }

    // Update offline_queue table status for synced items
    const syncedIds = results.filter(r => r.status === 'synced').map(r => r.action_id);
    if (syncedIds.length > 0) {
      await supabase
        .from('offline_queue')
        .update({ sync_status: 'synced', synced_at: new Date().toISOString() })
        .in('id', syncedIds);
    }

    // Mark failed items
    const failedIds = results.filter(r => r.status === 'failed').map(r => r.action_id);
    if (failedIds.length > 0) {
      await supabase
        .from('offline_queue')
        .update({ sync_status: 'failed' })
        .in('id', failedIds);
    }

    const syncedCount = results.filter(r => r.status === 'synced').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    return new Response(JSON.stringify({
      success: true,
      results,
      summary: {
        total: actions.length,
        synced: syncedCount,
        failed: failedCount,
        skipped: skippedCount,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Offline sync error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Offline sync failed',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Process a single offline action
 */
async function processAction(
  supabase: ReturnType<typeof getSupabase>,
  userId: string,
  action: OfflineAction
): Promise<SyncResult> {
  const { id, action_type, payload } = action;

  if (!supabase) {
    return {
      action_id: id,
      action_type,
      status: 'failed',
      error: 'Database not configured',
    };
  }

  try {
    switch (action_type) {
      case 'quiz_completed':
        return await syncQuizCompleted(supabase, id, userId, payload);

      case 'study_session_logged':
        return await syncStudySession(supabase, id, userId, payload);

      case 'challenge_completed':
        return await syncChallengeCompleted(supabase, id, userId, payload);

      default:
        return {
          action_id: id,
          action_type,
          status: 'skipped',
          error: `Unknown action type: ${action_type}`,
        };
    }
  } catch (error: any) {
    return {
      action_id: id,
      action_type,
      status: 'failed',
      error: error.message,
    };
  }
}

/**
 * Sync quiz completion
 */
async function syncQuizCompleted(
  supabase: ReturnType<typeof getSupabase>,
  id: string,
  userId: string,
  payload: Record<string, unknown>
): Promise<SyncResult> {
  const quizResultId = payload.quiz_result_id as string;
  const score = payload.score as number;
  const subject = payload.subject as string;
  const answers = payload.answers as Record<string, unknown>;

  // Check for duplicate submission
  if (quizResultId) {
    const { data: existing } = await supabase
      .from('quiz_results')
      .select('id')
      .eq('id', quizResultId)
      .single();

    if (existing) {
      return {
        action_id: id,
        action_type: 'quiz_completed',
        status: 'skipped',
        error: 'Quiz result already exists (duplicate)',
      };
    }
  }

  // Insert quiz result
  const { error } = await supabase
    .from('quiz_results')
    .insert({
      id: quizResultId || undefined,
      student_id: userId,
      subject,
      score,
      questions_json: answers || {},
      completed_at: new Date().toISOString(),
    });

  if (error) throw error;

  // Update gamification XP
  const xpGained = score >= 100 ? 200 : score >= 80 ? 100 : 50;
  await supabase.rpc('add_xp', {
    p_user_id: userId,
    p_xp: xpGained,
  }).catch(() => {
    // Gamification update is best-effort
    console.warn('Failed to update gamification XP for offline quiz sync');
  });

  return {
    action_id: id,
    action_type: 'quiz_completed',
    status: 'synced',
  };
}

/**
 * Sync study session
 */
async function syncStudySession(
  supabase: ReturnType<typeof getSupabase>,
  id: string,
  userId: string,
  payload: Record<string, unknown>
): Promise<SyncResult> {
  const sessionId = payload.session_id as string;
  const subject = payload.subject as string;
  const durationSec = payload.duration_sec as number;
  const startedAt = payload.started_at as string;
  const endedAt = payload.ended_at as string;

  // Check for duplicate
  if (sessionId) {
    const { data: existing } = await supabase
      .from('study_sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (existing) {
      return {
        action_id: id,
        action_type: 'study_session_logged',
        status: 'skipped',
        error: 'Study session already exists (duplicate)',
      };
    }
  }

  const { error } = await supabase
    .from('study_sessions')
    .insert({
      id: sessionId || undefined,
      student_id: userId,
      subject,
      duration_sec: durationSec || 0,
      started_at: startedAt || new Date().toISOString(),
      ended_at: endedAt || new Date().toISOString(),
    });

  if (error) throw error;

  return {
    action_id: id,
    action_type: 'study_session_logged',
    status: 'synced',
  };
}

/**
 * Sync daily challenge completion
 */
async function syncChallengeCompleted(
  supabase: ReturnType<typeof getSupabase>,
  id: string,
  userId: string,
  payload: Record<string, unknown>
): Promise<SyncResult> {
  const challengeId = payload.challenge_id as string;
  const answer = payload.answer as string;
  const isCorrect = payload.is_correct as boolean;

  // Check for duplicate
  if (challengeId) {
    const { data: existing } = await supabase
      .from('challenge_completions')
      .select('id')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return {
        action_id: id,
        action_type: 'challenge_completed',
        status: 'skipped',
        error: 'Challenge already completed (duplicate)',
      };
    }
  }

  const { error } = await supabase
    .from('challenge_completions')
    .insert({
      challenge_id: challengeId,
      user_id: userId,
      answer,
      correct: isCorrect || false,
      completed_at: new Date().toISOString(),
    });

  if (error) throw error;

  return {
    action_id: id,
    action_type: 'challenge_completed',
    status: 'synced',
  };
}
