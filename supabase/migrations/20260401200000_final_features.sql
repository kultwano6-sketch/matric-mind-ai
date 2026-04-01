-- ============================================================
-- Matric Mind AI - Final Features Migration
-- Tables: conversation_sessions, textbook_scans, progress_snapshots,
--          offline_queue, language_preferences, notification_preferences
-- ============================================================

-- Conversation sessions for multi-turn AI tutoring
CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  messages_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own conversation sessions"
  ON public.conversation_sessions FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own conversation sessions"
  ON public.conversation_sessions FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own conversation sessions"
  ON public.conversation_sessions FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "Teachers can view their students' conversations"
  ON public.conversation_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_profiles tp
      WHERE tp.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.student_profiles sp
        WHERE sp.user_id = conversation_sessions.student_id
        AND sp.teacher_id = tp.id
      )
    )
  );

CREATE INDEX idx_conversation_sessions_student ON public.conversation_sessions(student_id);
CREATE INDEX idx_conversation_sessions_subject ON public.conversation_sessions(subject);
CREATE INDEX idx_conversation_sessions_started ON public.conversation_sessions(started_at DESC);

-- Textbook scans for OCR-based learning
CREATE TABLE IF NOT EXISTS public.textbook_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  image_url TEXT,
  extracted_text TEXT,
  chapters_detected JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.textbook_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own textbook scans"
  ON public.textbook_scans FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own textbook scans"
  ON public.textbook_scans FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own textbook scans"
  ON public.textbook_scans FOR UPDATE
  USING (auth.uid() = student_id);

CREATE INDEX idx_textbook_scans_student ON public.textbook_scans(student_id);
CREATE INDEX idx_textbook_scans_subject ON public.textbook_scans(subject);
CREATE INDEX idx_textbook_scans_created ON public.textbook_scans(created_at DESC);

-- Progress snapshots for trend analysis
CREATE TABLE IF NOT EXISTS public.progress_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  topic_scores_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  quiz_count INTEGER NOT NULL DEFAULT 0,
  study_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.progress_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own progress snapshots"
  ON public.progress_snapshots FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own progress snapshots"
  ON public.progress_snapshots FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Teachers can view their students' snapshots"
  ON public.progress_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_profiles tp
      WHERE tp.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.student_profiles sp
        WHERE sp.user_id = progress_snapshots.student_id
        AND sp.teacher_id = tp.id
      )
    )
  );

CREATE POLICY "Parents can view linked students' snapshots"
  ON public.progress_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_links pl
      WHERE pl.parent_id = auth.uid()
      AND pl.student_id = progress_snapshots.student_id
    )
  );

CREATE INDEX idx_progress_snapshots_student ON public.progress_snapshots(student_id);
CREATE INDEX idx_progress_snapshots_subject ON public.progress_snapshots(subject);
CREATE INDEX idx_progress_snapshots_date ON public.progress_snapshots(snapshot_date DESC);
CREATE INDEX idx_progress_snapshots_student_subject_date ON public.progress_snapshots(student_id, subject, snapshot_date DESC);

-- Offline queue for syncing actions when reconnected
CREATE TABLE IF NOT EXISTS public.offline_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);

ALTER TABLE public.offline_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own offline queue"
  ON public.offline_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own offline queue"
  ON public.offline_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own offline queue"
  ON public.offline_queue FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own synced offline queue"
  ON public.offline_queue FOR DELETE
  USING (auth.uid() = user_id AND sync_status = 'synced');

CREATE INDEX idx_offline_queue_user ON public.offline_queue(user_id);
CREATE INDEX idx_offline_queue_status ON public.offline_queue(sync_status);
CREATE INDEX idx_offline_queue_user_status ON public.offline_queue(user_id, sync_status);

-- Language preferences for i18n
CREATE TABLE IF NOT EXISTS public.language_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'af', 'zu', 'xh', 'st', 'tn', 'ss', 've', 'ts', 'sw')),
  translate_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.language_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own language preferences"
  ON public.language_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_language_preferences_user ON public.language_preferences(user_id);

-- Notification preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  channels_json JSONB NOT NULL DEFAULT '["announcements","quiz_results","streaks","study_reminders"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notification preferences"
  ON public.notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_notification_preferences_user ON public.notification_preferences(user_id);

-- Seed default language preferences for existing users
INSERT INTO public.language_preferences (user_id, preferred_language, translate_enabled)
SELECT id, 'en', false
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.language_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- Seed default notification preferences for existing users
INSERT INTO public.notification_preferences (user_id, push_enabled, email_enabled, channels_json)
SELECT id, true, true, '["announcements","quiz_results","streaks","study_reminders"]'::jsonb
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.notification_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- Grant usage on new tables to authenticated role
GRANT ALL ON public.conversation_sessions TO authenticated;
GRANT ALL ON public.textbook_scans TO authenticated;
GRANT ALL ON public.progress_snapshots TO authenticated;
GRANT ALL ON public.offline_queue TO authenticated;
GRANT ALL ON public.language_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO authenticated;
