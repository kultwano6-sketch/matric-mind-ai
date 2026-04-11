import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const router = Router();

// App icon URL - replace with your actual icon URL
const APP_ICON = 'https://matric-mind-ai.fly.dev/icons/icon-512.png';

// Supabase admin client (service role)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase config for notifications-scheduled');
}

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Notification templates by role
const notificationTemplates = {
  student: (name: string) => ({
    title: `Hey ${name}! 📚`,
    message: `Ready to crush some quizzes? New practice questions are waiting for you in Matric Mind AI. Let's see how much you've learned! 🧠`
  }),
  teacher: (name: string) => ({
    title: `Time to check in, ${name}! 📝`,
    message: `Your learners are waiting! Review any pending assignments or check if there are new submissions to grade.`
  })),
  head_teacher: (name: string) => ({
    title: `School check-in, ${name}! 📢`,
    message: `How are things going? Consider making an announcement to keep everyone motivated, or check how your teachers and learners are doing.`
  })),
  admin: (name: string) => ({
    title: `System check, ${name}! ⚙️`,
    message: `Time to check if everything is running smoothly on Matric Mind AI. Review any system alerts or user reports that need attention.`
  })
};

// Get names by role from database
async function getUsersByRole(role: string): Promise<{ id: string; name: string }[]> {
  try {
    // Join with auth.users to get email as name fallback
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, auth.users.email')
      .eq('role', role);

    if (error) {
      console.error(`Error fetching ${role}:`, error);
      return [];
    }

    // Map to simpler format
    return (data || []).map((row: any) => ({
      id: row.user_id,
      name: row.email?.split('@')[0] || 'there'
    }));
  } catch (err) {
    console.error(`Error getting ${role} users:`, err);
    return [];
  }
}

// Insert notification
async function insertNotification(
  userId: string,
  title: string,
  message: string,
  type: string = 'reminder'
): Promise<boolean> {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
      priority: 'medium',
      action_url: '/notifications'
    });

    if (error) {
      console.error('Insert notification error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Insert notification error:', err);
    return false;
  }
}

// API endpoint to send scheduled notifications
// Called by cron job every 5 hours
router.post('/send-scheduled', async (req, res) => {
  try {
    const { role } = req.body;
    const expectedToken = process.env.CRON_SECRET_TOKEN;

    // Simple auth check
    if (expectedToken && req.headers.authorization !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!role || !notificationTemplates[role as keyof typeof notificationTemplates]) {
      return res.status(400).json({ error: 'Invalid role. Use: student, teacher, head_teacher, or admin' });
    }

    const users = await getUsersByRole(role);
    const template = notificationTemplates[role as keyof typeof notificationTemplates];
    let sentCount = 0;

    for (const user of users) {
      const { title, message } = template(user.name);
      const success = await insertNotification(user.id, title, message, 'reminder');
      if (success) sentCount++;
    }

    res.json({
      success: true,
      role,
      usersFound: users.length,
      notificationsSent: sentCount
    });
  } catch (err) {
    console.error('Scheduled notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    icon: APP_ICON,
    roles: ['student', 'teacher', 'head_teacher', 'admin']
  });
});

export default router;