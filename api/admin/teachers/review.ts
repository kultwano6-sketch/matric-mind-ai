import { getSupabase } from '../../server/supabaseClient';

export const maxDuration = 30;

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
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

  // Verify the user making the request
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if user is admin or head teacher
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData || !['admin', 'head_teacher'].includes(roleData.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), { status: 403 });
  }

  const { requestId, action } = await req.json();

  if (!requestId || !['approve', 'reject'].includes(action)) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get the request details
  const { data: request, error: fetchError } = await supabase
    .from('teacher_approval_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    return new Response(JSON.stringify({ error: 'Request not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
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
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
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

  return new Response(JSON.stringify({ 
    success: true, 
    message: `Teacher request ${newStatus}` 
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
