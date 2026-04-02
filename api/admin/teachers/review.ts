// api/admin/teachers/review.ts — Approve or reject teacher approval requests
import type { Request, Response } from 'express';
import { getSupabase } from '../../../server/supabaseClient';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
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

  const { requestId, action } = req.body;

  if (!requestId || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  // Get the request details
  const { data: request, error: fetchError } = await supabase
    .from('teacher_approval_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  // Update the request status
  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  const { error: updateError } = await supabase
    .from('teacher_approval_requests')
    .update({
      status: newStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }

  // If approved, create teacher profile and role
  if (action === 'approve') {
    // Insert user role
    await supabase.from('user_roles').upsert({
      user_id: request.user_id,
      role: 'teacher',
    });

    // Insert teacher profile
    await supabase.from('teacher_profiles').upsert({
      user_id: request.user_id,
      subjects: request.subjects,
      approval_status: 'approved',
    });
  }

  return res.status(200).json({
    success: true,
    message: `Teacher request ${newStatus}`,
  });
}
