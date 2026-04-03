-- Fix: Create parent_links table if missing
-- Run this in Supabase SQL Editor

-- Check and create parent_links table
CREATE TABLE IF NOT EXISTS public.parent_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL DEFAULT 'parent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(parent_user_id, student_user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON public.parent_links(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_student ON public.parent_links(student_user_id);

-- Enable RLS
ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Parents can view their linked students" ON public.parent_links;
CREATE POLICY "Parents can view their linked students"
    ON public.parent_links FOR SELECT
    USING (parent_user_id = auth.uid());

DROP POLICY IF EXISTS "Parents can create links to students" ON public.parent_links;
CREATE POLICY "Parents can create links to students"
    ON public.parent_links FOR INSERT
    WITH CHECK (parent_user_id = auth.uid());

DROP POLICY IF EXISTS "Parents can delete their own links" ON public.parent_links;
CREATE POLICY "Parents can delete their own links"
    ON public.parent_links FOR DELETE
    USING (parent_user_id = auth.uid());

DROP POLICY IF EXISTS "Students can see who their parent is" ON public.parent_links;
CREATE POLICY "Students can see who their parent is"
    ON public.parent_links FOR SELECT
    USING (student_user_id = auth.uid());

-- Grant permissions
GRANT ALL ON public.parent_links TO authenticated;
GRANT ALL ON public.parent_links TO anon;

-- Verify
SELECT 'parent_links table created/updated successfully' as result;