-- ============================================================
-- Matric Mind AI - AI Features Migration
-- Creates tables for quiz results, weakness detection,
-- study recommendations, voice sessions, parent linking,
-- notifications, and gamification
-- ============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. quiz_results
-- Stores completed quiz attempts with scores and weak topics
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quiz_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
    questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    weak_topics TEXT[] DEFAULT '{}'::text[],
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quiz_results_student ON public.quiz_results(student_id);
CREATE INDEX idx_quiz_results_student_subject ON public.quiz_results(student_id, subject);
CREATE INDEX idx_quiz_results_completed ON public.quiz_results(completed_at DESC);

-- ============================================================
-- 2. student_weaknesses
-- Tracks per-topic weakness data for each student
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_weaknesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    error_count INTEGER NOT NULL DEFAULT 0,
    total_attempts INTEGER NOT NULL DEFAULT 0,
    mastery_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (mastery_pct >= 0 AND mastery_pct <= 100),
    last_error_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(student_id, subject, topic)
);

CREATE INDEX idx_student_weaknesses_student ON public.student_weaknesses(student_id);
CREATE INDEX idx_student_weaknesses_student_subject ON public.student_weaknesses(student_id, subject);
CREATE INDEX idx_student_weaknesses_mastery ON public.student_weaknesses(mastery_pct ASC);

-- ============================================================
-- 3. study_recommendations
-- AI-generated study recommendations for students
-- ============================================================
CREATE TABLE IF NOT EXISTS public.study_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    reason TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    dismissed_at TIMESTAMPTZ
);

CREATE INDEX idx_study_recommendations_student ON public.study_recommendations(student_id);
CREATE INDEX idx_study_recommendations_active ON public.study_recommendations(student_id, dismissed_at) WHERE dismissed_at IS NULL;

-- ============================================================
-- 4. study_plan_entries
-- Scheduled study sessions for the AI-powered study planner
-- ============================================================
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

CREATE INDEX idx_study_plan_entries_student ON public.study_plan_entries(student_id);
CREATE INDEX idx_study_plan_entries_student_date ON public.study_plan_entries(student_id, date);

-- ============================================================
-- 5. voice_sessions
-- Records voice tutor interactions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.voice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT,
    transcript TEXT DEFAULT '',
    audio_url TEXT,
    duration_sec INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_sessions_student ON public.voice_sessions(student_id);

-- ============================================================
-- 6. parent_links
-- Links parent accounts to student accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parent_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL DEFAULT 'parent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(parent_user_id, student_user_id)
);

CREATE INDEX idx_parent_links_parent ON public.parent_links(parent_user_id);
CREATE INDEX idx_parent_links_student ON public.parent_links(student_user_id);

-- ============================================================
-- 7. notifications
-- In-app notification system
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    read BOOLEAN NOT NULL DEFAULT false,
    data_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;

-- ============================================================
-- 8. gamification_state
-- Tracks XP, level, streaks, and achievements
-- ============================================================
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

CREATE INDEX idx_gamification_state_user ON public.gamification_state(user_id);
CREATE INDEX idx_gamification_state_xp ON public.gamification_state(xp DESC);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_weaknesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plan_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_state ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function: Check if current user is a teacher
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('teacher', 'head_teacher')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function: Check if student is in teacher's subjects/classes
CREATE OR REPLACE FUNCTION public.is_teacher_of_student(p_student_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('teacher', 'head_teacher')
          AND (
            public.is_admin()
            OR EXISTS (
              SELECT 1 FROM public.student_profiles sp
              WHERE sp.user_id = p_student_id
            )
          )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- RLS Policies for quiz_results
-- ============================================================
CREATE POLICY "Students can view own quiz results"
    ON public.quiz_results FOR SELECT
    USING (student_id = auth.uid());

CREATE POLICY "Students can insert own quiz results"
    ON public.quiz_results FOR INSERT
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view their students quiz results"
    ON public.quiz_results FOR SELECT
    USING (public.is_teacher_of_student(student_id));

CREATE POLICY "Admins can view all quiz results"
    ON public.quiz_results FOR SELECT
    USING (public.is_admin());

-- ============================================================
-- RLS Policies for student_weaknesses
-- ============================================================
CREATE POLICY "Students can view own weaknesses"
    ON public.student_weaknesses FOR SELECT
    USING (student_id = auth.uid());

CREATE POLICY "Students can insert own weaknesses"
    ON public.student_weaknesses FOR INSERT
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own weaknesses"
    ON public.student_weaknesses FOR UPDATE
    USING (student_id = auth.uid());

CREATE POLICY "Teachers can view student weaknesses"
    ON public.student_weaknesses FOR SELECT
    USING (public.is_teacher_of_student(student_id));

CREATE POLICY "Admins can view all weaknesses"
    ON public.student_weaknesses FOR SELECT
    USING (public.is_admin());

-- ============================================================
-- RLS Policies for study_recommendations
-- ============================================================
CREATE POLICY "Students can view own recommendations"
    ON public.study_recommendations FOR SELECT
    USING (student_id = auth.uid());

CREATE POLICY "Students can update own recommendations"
    ON public.study_recommendations FOR UPDATE
    USING (student_id = auth.uid());

CREATE POLICY "Teachers can view student recommendations"
    ON public.study_recommendations FOR SELECT
    USING (public.is_teacher_of_student(student_id));

CREATE POLICY "Admins can view all recommendations"
    ON public.study_recommendations FOR SELECT
    USING (public.is_admin());

-- ============================================================
-- RLS Policies for study_plan_entries
-- ============================================================
CREATE POLICY "Students can CRUD own study plan entries"
    ON public.study_plan_entries FOR ALL
    USING (student_id = auth.uid())
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view student study plans"
    ON public.study_plan_entries FOR SELECT
    USING (public.is_teacher_of_student(student_id));

CREATE POLICY "Admins can view all study plans"
    ON public.study_plan_entries FOR SELECT
    USING (public.is_admin());

-- ============================================================
-- RLS Policies for voice_sessions
-- ============================================================
CREATE POLICY "Students can CRUD own voice sessions"
    ON public.voice_sessions FOR ALL
    USING (student_id = auth.uid())
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "Admins can view all voice sessions"
    ON public.voice_sessions FOR SELECT
    USING (public.is_admin());

-- ============================================================
-- RLS Policies for parent_links
-- ============================================================
CREATE POLICY "Parents can view their linked students"
    ON public.parent_links FOR SELECT
    USING (parent_user_id = auth.uid());

CREATE POLICY "Parents can create links to students"
    ON public.parent_links FOR INSERT
    WITH CHECK (parent_user_id = auth.uid());

CREATE POLICY "Parents can delete their own links"
    ON public.parent_links FOR DELETE
    USING (parent_user_id = auth.uid());

CREATE POLICY "Students can see who their parent is"
    ON public.parent_links FOR SELECT
    USING (student_user_id = auth.uid());

CREATE POLICY "Admins can view all parent links"
    ON public.parent_links FOR ALL
    USING (public.is_admin());

-- ============================================================
-- RLS Policies for notifications
-- ============================================================
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all notifications"
    ON public.notifications FOR SELECT
    USING (public.is_admin());

-- ============================================================
-- RLS Policies for gamification_state
-- ============================================================
CREATE POLICY "Users can view own gamification state"
    ON public.gamification_state FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own gamification state"
    ON public.gamification_state FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own gamification state"
    ON public.gamification_state FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all gamification states"
    ON public.gamification_state FOR SELECT
    USING (public.is_admin());

-- ============================================================
-- Seed default gamification state for existing users
-- ============================================================
INSERT INTO public.gamification_state (user_id, xp, level, streak_days, achievements_json)
SELECT id, 0, 1, 0, '[]'::jsonb
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.gamification_state)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- Trigger: Auto-create gamification state on new user signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_gamification_for_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.gamification_state (user_id, xp, level, streak_days, achievements_json)
    VALUES (NEW.id, 0, 1, 0, '[]'::jsonb)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_gamification_for_user
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_gamification_for_user();

-- ============================================================
-- Function: Upsert student weakness from quiz result
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_student_weakness(
    p_student_id UUID,
    p_subject TEXT,
    p_topic TEXT,
    p_is_correct BOOLEAN
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.student_weaknesses (student_id, subject, topic, error_count, total_attempts, mastery_pct, last_error_at)
    VALUES (
        p_student_id,
        p_subject,
        p_topic,
        CASE WHEN NOT p_is_correct THEN 1 ELSE 0 END,
        1,
        CASE WHEN p_is_correct THEN 100.00 ELSE 0.00 END,
        CASE WHEN NOT p_is_correct THEN now() ELSE NULL END
    )
    ON CONFLICT (student_id, subject, topic) DO UPDATE SET
        error_count = student_weaknesses.error_count + CASE WHEN NOT p_is_correct THEN 1 ELSE 0 END,
        total_attempts = student_weaknesses.total_attempts + 1,
        mastery_pct = ROUND(
            ((student_weaknesses.total_attempts - student_weaknesses.error_count + CASE WHEN p_is_correct THEN 1 ELSE 0 END)::numeric
            / (student_weaknesses.total_attempts + 1)::numeric) * 100, 2
        ),
        last_error_at = CASE WHEN NOT p_is_correct THEN now() ELSE student_weaknesses.last_error_at END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
