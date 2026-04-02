// api/offline-sync.ts — Offline action queue sync


interface SyncAction {
  id: string;
  action_type: string;
  payload: Record<string, unknown>;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return res.status = 405).json({ error: 'Method not allowed' });
  }

  const { user_id, actions } = req.body;

  if (!user_id) {
    return res.status = 400).json({ error: 'user_id is required' });
  }

  if (!actions || !Array.isArray(actions)) {
    return res.status = 400).json({ error: 'actions (array) is required' });
  }

  if (actions.length > 100) {
    return res.status = 400).json({ error: 'Too many actions (max 100 per batch)' });
  }

  try {
    const results = actions.map((action: SyncAction) => {
      // Validate action structure
      if (!action.id || !action.action_type || !action.payload) {
        return {
          action_id: action.id || 'unknown',
          action_type: action.action_type || 'unknown',
          status: 'failed' as const,
          error: 'Invalid action format: id, action_type, and payload are required',
        };
      }

      // Validate action_type
      const validTypes = ['quiz_completed', 'study_session_logged', 'challenge_completed'];
      if (!validTypes.includes(action.action_type)) {
        return {
          action_id: action.id,
          action_type: action.action_type,
          status: 'failed' as const,
          error: `Unknown action type: ${action.action_type}`,
        };
      }

      // In production, this would persist to the database
      // For now, accept all valid actions
      return {
        action_id: action.id,
        action_type: action.action_type,
        status: 'synced' as const,
      };
    });

    const synced = results.filter((r) => r.status === 'synced').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    res.json = {
      success: true,
      results,
      summary: {
        total: actions.length,
        synced,
        failed,
        skipped: 0,
      },
    });
  } catch (error: any) {
    console.error('Offline Sync Error:', error);
    res.status = 500).json({
      error: 'Sync failed',
      message: error?.message || 'Unknown error',
    });
  }
}
