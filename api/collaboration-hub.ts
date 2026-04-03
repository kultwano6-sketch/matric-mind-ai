// api/collaboration-hub.ts — Study groups API

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to get user from header
async function getUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  
  try {
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    return user?.id || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const userId = await getUser(req);

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    switch (action) {
      case 'list-groups': {
        // List all public groups or user's groups
        const { data: groups, error } = await supabase
          .from('study_groups')
          .select('*')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        // Add member counts
        const groupsWithCounts = await Promise.all((groups || []).map(async (group: any) => {
          const { count } = await supabase
            .from('study_group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);
          
          return { ...group, member_count: count || 0 };
        }));

        return new Response(JSON.stringify({ groups: groupsWithCounts }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'my-groups': {
        // List groups user is a member of
        const { data: memberships, error } = await supabase
          .from('study_group_members')
          .select('*, study_groups(*)')
          .eq('user_id', userId);

        if (error) throw error;

        const groups = (memberships || []).map((m: any) => ({
          ...m.study_groups,
          role: m.role,
          joined_at: m.joined_at,
        }));

        return new Response(JSON.stringify({ groups }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'group-details': {
        const groupId = searchParams.get('group_id');
        if (!groupId) {
          return new Response(JSON.stringify({ error: 'group_id required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Get group details
        const { data: group, error } = await supabase
          .from('study_groups')
          .select('*')
          .eq('id', groupId)
          .single();

        if (error) throw error;

        // Get members with profiles
        const { data: members } = await supabase
          .from('study_group_members')
          .select('id, user_id, role, joined_at, profiles(full_name, avatar_url)')
          .eq('group_id', groupId)
          .order('joined_at', { ascending: true });

        // Get recent messages
        const { data: messages } = await supabase
          .from('study_group_messages')
          .select('id, user_id, content, created_at, profiles(full_name)')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false })
          .limit(50);

        return new Response(JSON.stringify({
          group,
          members: members || [],
          messages: (messages || []).reverse(),
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ 
          message: 'Use ?action=list-groups, ?action=my-groups, or ?action=group-details&group_id=...',
          endpoints: [
            'GET ?action=list-groups - List public groups',
            'GET ?action=my-groups - List user\'s groups',
            'GET ?action=group-details&group_id=UUID - Get group details',
            'POST - Create, join, or send message',
          ]
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  } catch (error: any) {
    console.error('Collaboration Hub API Error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process request',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(req: Request) {
  const userId = await getUser(req);

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { action, ...data } = body;

  try {
    switch (action) {
      case 'create-group': {
        if (!data.name) {
          return new Response(JSON.stringify({ error: 'Group name required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const { data: group, error } = await supabase
          .from('study_groups')
          .insert({
            name: data.name,
            subject: data.subject || 'general',
            description: data.description || '',
            created_by: userId,
            is_public: data.is_public !== false,
          })
          .select()
          .single();

        if (error) throw error;

        // Add creator as admin
        await supabase.from('study_group_members').insert({
          group_id: group.id,
          user_id: userId,
          role: 'admin',
        });

        return new Response(JSON.stringify({ 
          success: true, 
          group,
          invite_code: group.invite_code,
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'join-group': {
        if (!data.invite_code && !data.group_id) {
          return new Response(JSON.stringify({ error: 'invite_code or group_id required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Find group
        let groupId = data.group_id;
        if (data.invite_code) {
          const { data: group } = await supabase
            .from('study_groups')
            .select('id')
            .eq('invite_code', data.invite_code.toUpperCase())
            .single();

          if (!group) {
            return new Response(JSON.stringify({ error: 'Invalid invite code' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          groupId = group.id;
        }

        // Check if already a member
        const { data: existing } = await supabase
          .from('study_group_members')
          .select('id')
          .eq('group_id', groupId)
          .eq('user_id', userId)
          .single();

        if (existing) {
          return new Response(JSON.stringify({ error: 'Already a member' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Join
        const { error } = await supabase.from('study_group_members').insert({
          group_id: groupId,
          user_id: userId,
          role: 'member',
        });

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, message: 'Joined group' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'leave-group': {
        if (!data.group_id) {
          return new Response(JSON.stringify({ error: 'group_id required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const { error } = await supabase
          .from('study_group_members')
          .delete()
          .eq('group_id', data.group_id)
          .eq('user_id', userId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, message: 'Left group' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'send-message': {
        if (!data.group_id || !data.content) {
          return new Response(JSON.stringify({ error: 'group_id and content required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Check membership
        const { data: membership } = await supabase
          .from('study_group_members')
          .select('id')
          .eq('group_id', data.group_id)
          .eq('user_id', userId)
          .single();

        if (!membership) {
          return new Response(JSON.stringify({ error: 'Not a member of this group' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const { data: message, error } = await supabase
          .from('study_group_messages')
          .insert({
            group_id: data.group_id,
            user_id: userId,
            content: data.content,
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, message }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'delete-group': {
        if (!data.group_id) {
          return new Response(JSON.stringify({ error: 'group_id required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Check if user is admin or creator
        const { data: group } = await supabase
          .from('study_groups')
          .select('created_by')
          .eq('id', data.group_id)
          .single();

        const { data: adminMember } = await supabase
          .from('study_group_members')
          .select('id')
          .eq('group_id', data.group_id)
          .eq('user_id', userId)
          .eq('role', 'admin')
          .single();

        if (group?.created_by !== userId && !adminMember) {
          return new Response(JSON.stringify({ error: 'Only admins can delete groups' }), {
            status: 403,
          });
        }

        const { error } = await supabase
          .from('study_groups')
          .delete()
          .eq('id', data.group_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, message: 'Group deleted' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ 
          error: 'Unknown action',
          available_actions: ['create-group', 'join-group', 'leave-group', 'send-message', 'delete-group'],
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  } catch (error: any) {
    console.error('Collaboration Hub API Error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process request',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}