// api/admin/teachers/pending.ts — List pending teacher approval requests
import type { Request, Response } from 'express';
import { getSupabase } from '../../../server/supabaseClient';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'DB not configured' });
  }

  // Verify the user making the request
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is admin or head teacher
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData || !['admin', 'head_teacher'].includes(roleData.role)) {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }

  // Get pending teacher requests
  const { data: requests, error } = await supabase
    .from('teacher_approval_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ requests });
}
