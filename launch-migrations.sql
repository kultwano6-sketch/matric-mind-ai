-- Core tables missing from the app
CREATE TABLE IF NOT EXISTS public.gamification_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  streak_days INTEGER NOT NULL DEFAULT 0,
  achievements_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_activity TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gamification_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own gamification" ON public.gamification_state FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_gamification_user ON public.gamification_state(user_id);

CREATE TABLE IF NOT EXISTS public.quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  weak_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own quiz results" ON public.quiz_results FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can insert own quiz results" ON public.quiz_results FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_student ON public.quiz_results(student_id);

CREATE TABLE IF NOT EXISTS public.student_weaknesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  error_count INTEGER NOT NULL DEFAULT 0,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  mastery_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_error_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, subject, topic)
);

ALTER TABLE public.student_weaknesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own weaknesses" ON public.student_weaknesses FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can insert own weaknesses" ON public.student_weaknesses FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can update own weaknesses" ON public.student_weaknesses FOR UPDATE USING (auth.uid() = student_id);
CREATE INDEX IF NOT EXISTS idx_weaknesses_student ON public.student_weaknesses(student_id);

CREATE TABLE IF NOT EXISTS public.study_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  reason TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ
);

ALTER TABLE public.study_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own recommendations" ON public.study_recommendations FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can update own recommendations" ON public.study_recommendations FOR UPDATE USING (auth.uid() = student_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_student ON public.study_recommendations(student_id);

CREATE TABLE IF NOT EXISTS public.voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT DEFAULT '',
  transcript TEXT DEFAULT '',
  audio_url TEXT DEFAULT '',
  duration_sec INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can manage own voice sessions" ON public.voice_sessions FOR ALL USING (auth.uid() = student_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_student ON public.voice_sessions(student_id);

CREATE TABLE IF NOT EXISTS public.study_plan_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 30,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_plan_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can manage own study plan" ON public.study_plan_entries FOR ALL USING (auth.uid() = student_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_student ON public.study_plan_entries(student_id, date);

CREATE TABLE IF NOT EXISTS public.parent_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'parent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_user_id, student_user_id)
);

ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents can view own parent links" ON public.parent_links FOR SELECT USING (auth.uid() = parent_user_id);
CREATE POLICY "Parents can insert own parent links" ON public.parent_links FOR INSERT WITH CHECK (auth.uid() = parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON public.parent_links(parent_user_id);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  notification_type TEXT DEFAULT 'info',
  action_url TEXT DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  data_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read);

CREATE TABLE IF NOT EXISTS public.achievement_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  xp_awarded INTEGER DEFAULT 0,
  category TEXT DEFAULT 'general',
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.achievement_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own achievements" ON public.achievement_unlocks FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_user ON public.achievement_unlocks(user_id);

CREATE TABLE IF NOT EXISTS public.study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_members INTEGER DEFAULT 10,
  is_public BOOLEAN DEFAULT true,
  invite_code TEXT UNIQUE DEFAULT upper(substring(md5(random()::text) from 1 for 8)),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view public study groups" ON public.study_groups FOR SELECT USING (is_public OR auth.uid() = created_by);
CREATE POLICY "Users can create study groups" ON public.study_groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE INDEX IF NOT EXISTS idx_study_groups_public ON public.study_groups(is_public);

CREATE TABLE IF NOT EXISTS public.study_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view group membership" ON public.study_group_members FOR SELECT USING (true);
CREATE POLICY "Users can join study groups" ON public.study_group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.study_group_members(group_id);

CREATE TABLE IF NOT EXISTS public.study_group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.study_group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members can view messages" ON public.study_group_messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.study_group_members WHERE group_id = study_group_messages.group_id AND user_id = auth.uid()));
CREATE POLICY "Group members can send messages" ON public.study_group_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.study_group_members WHERE group_id = study_group_messages.group_id AND user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON public.study_group_messages(group_id, created_at);
