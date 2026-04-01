-- ============================================================
-- Matric Mind AI - Advanced Features Migration
-- Date: 2026-04-01
-- Adds: Exam Simulations, Study Sessions, Daily Challenges,
--        Extended Notifications, Teacher Analytics, Study Groups,
--        Achievement Unlocks
-- ============================================================

-- 1. Exam Simulations
CREATE TABLE IF NOT EXISTS public.exam_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  total_marks INTEGER NOT NULL DEFAULT 100,
  time_limit_min INTEGER NOT NULL DEFAULT 120,
  questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers_json JSONB DEFAULT '{}'::jsonb,
  score INTEGER,
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.exam_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own exams" ON public.exam_simulations
  FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can create exams" ON public.exam_simulations
  FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can update own exams" ON public.exam_simulations
  FOR UPDATE USING (auth.uid() = student_id);

CREATE INDEX idx_exam_simulations_student ON public.exam_simulations(student_id);
CREATE INDEX idx_exam_simulations_subject ON public.exam_simulations(subject);
CREATE INDEX idx_exam_simulations_completed ON public.exam_simulations(completed_at);

-- 2. Study Sessions (time tracking)
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_sec INTEGER DEFAULT 0,
  focus_score INTEGER CHECK (focus_score >= 0 AND focus_score <= 100),
  notes TEXT,
  session_type TEXT DEFAULT 'study' CHECK (session_type IN ('study', 'revision', 'practice', 'exam_prep')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage own sessions" ON public.study_sessions
  FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "Teachers can view class sessions" ON public.study_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teacher_profiles tp
      WHERE tp.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.student_profiles sp
        WHERE sp.user_id = study_sessions.student_id
        AND sp.school_id = tp.school_id
      )
    )
  );

CREATE INDEX idx_study_sessions_student ON public.study_sessions(student_id);
CREATE INDEX idx_study_sessions_subject ON public.study_sessions(subject);
CREATE INDEX idx_study_sessions_started ON public.study_sessions(started_at);

-- 3. Daily Challenges
CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('mcq', 'short_answer', 'problem_solving', 'equation', 'word_problem')),
  content_json JSONB NOT NULL,
  difficulty INTEGER NOT NULL CHECK (difficulty >= 1 AND difficulty <= 5),
  xp_reward INTEGER NOT NULL DEFAULT 25,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subject, date, challenge_type)
);

ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view daily challenges" ON public.daily_challenges
  FOR SELECT USING (true);

CREATE INDEX idx_daily_challenges_date ON public.daily_challenges(date);
CREATE INDEX idx_daily_challenges_subject ON public.daily_challenges(subject);

-- 4. Challenge Completions
CREATE TABLE IF NOT EXISTS public.challenge_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  correct BOOLEAN NOT NULL DEFAULT false,
  time_taken_sec INTEGER,
  xp_earned INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

ALTER TABLE public.challenge_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own completions" ON public.challenge_completions
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_challenge_completions_user ON public.challenge_completions(user_id);
CREATE INDEX idx_challenge_completions_challenge ON public.challenge_completions(challenge_id);

-- 5. Notifications Extended (push subscription support)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS push_subscription JSONB;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS push_sent BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'info' CHECK (notification_type IN ('info', 'achievement', 'reminder', 'assignment', 'social', 'system'));

-- 6. Teacher Analytics Cache
CREATE TABLE IF NOT EXISTS public.teacher_analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  cache_type TEXT DEFAULT 'class_overview' CHECK (cache_type IN ('class_overview', 'subject_breakdown', 'student_progress')),
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '1 hour'),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.teacher_analytics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage own cache" ON public.teacher_analytics_cache
  FOR ALL USING (auth.uid() = teacher_id);

CREATE INDEX idx_teacher_cache_teacher ON public.teacher_analytics_cache(teacher_id);
CREATE INDEX idx_teacher_cache_expires ON public.teacher_analytics_cache(expires_at);

-- 7. Study Group Invites
CREATE TABLE IF NOT EXISTS public.study_group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,
  invited_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE(group_id, invited_user_id)
);

ALTER TABLE public.study_group_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invites" ON public.study_group_invites
  FOR SELECT USING (auth.uid() = invited_user_id OR auth.uid() = invited_by);
CREATE POLICY "Users can respond to invites" ON public.study_group_invites
  FOR UPDATE USING (auth.uid() = invited_user_id);
CREATE POLICY "Users can create invites" ON public.study_group_invites
  FOR INSERT WITH CHECK (auth.uid() = invited_by);

CREATE INDEX idx_group_invites_user ON public.study_group_invites(invited_user_id);
CREATE INDEX idx_group_invites_group ON public.study_group_invites(group_id);

-- 8. Achievement Unlocks (detailed tracking)
CREATE TABLE IF NOT EXISTS public.achievement_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  achievement_description TEXT,
  achievement_icon TEXT,
  xp_awarded INTEGER DEFAULT 0,
  category TEXT DEFAULT 'general',
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.achievement_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements" ON public.achievement_unlocks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert achievements" ON public.achievement_unlocks
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_achievement_unlocks_user ON public.achievement_unlocks(user_id);
CREATE INDEX idx_achievement_unlocks_category ON public.achievement_unlocks(category);

-- 9. Study Groups (if not exists)
CREATE TABLE IF NOT EXISTS public.study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_members INTEGER DEFAULT 10,
  is_public BOOLEAN DEFAULT true,
  invite_code TEXT UNIQUE DEFAULT upper(substring(md5(random()::text) from 1 for 8)),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public groups" ON public.study_groups
  FOR SELECT USING (is_public = true OR created_by = auth.uid());
CREATE POLICY "Users can create groups" ON public.study_groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update groups" ON public.study_groups
  FOR UPDATE USING (auth.uid() = created_by);

-- 10. Study Group Members (if not exists)
CREATE TABLE IF NOT EXISTS public.study_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view group membership" ON public.study_group_members
  FOR SELECT USING (true);
CREATE POLICY "Users can join groups" ON public.study_group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can leave groups" ON public.study_group_members
  FOR DELETE USING (auth.uid() = user_id);

-- 11. Group Messages (simple chat)
CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'question', 'answer', 'file')),
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view messages" ON public.group_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.study_group_members
      WHERE group_id = group_messages.group_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "Group members can send messages" ON public.group_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.study_group_members
      WHERE group_id = group_messages.group_id AND user_id = auth.uid()
    )
  );

CREATE INDEX idx_group_messages_group ON public.group_messages(group_id);
CREATE INDEX idx_group_messages_created ON public.group_messages(created_at);

-- 12. Performance view for analytics
CREATE OR REPLACE VIEW public.v_student_performance_summary AS
SELECT
  sp.user_id as student_id,
  sp.grade,
  sp.subjects,
  COALESCE(AVG(qr.score), 0) as avg_quiz_score,
  COUNT(DISTINCT qr.id) as total_quizzes,
  COALESCE(ss.total_study_seconds, 0) as total_study_seconds,
  COALESCE(gs.streak_days, 0) as current_streak,
  COALESCE(gs.xp, 0) as total_xp,
  COALESCE(gs.level, 1) as current_level
FROM public.student_profiles sp
LEFT JOIN public.quiz_results qr ON qr.student_id = sp.user_id
LEFT JOIN (
  SELECT student_id, SUM(duration_sec) as total_study_seconds
  FROM public.study_sessions
  WHERE ended_at IS NOT NULL
  GROUP BY student_id
) ss ON ss.student_id = sp.user_id
LEFT JOIN public.gamification_state gs ON gs.user_id = sp.user_id
GROUP BY sp.user_id, sp.grade, sp.subjects, ss.total_study_seconds, gs.streak_days, gs.xp, gs.level;

-- Grant access to the view
GRANT SELECT ON public.v_student_performance_summary TO authenticated;

-- Cleanup trigger for expired teacher cache
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.teacher_analytics_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
