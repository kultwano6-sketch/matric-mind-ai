-- Fix RLS policies for study_groups and study_group_members
-- Run in Supabase SQL Editor

-- Ensure study_groups table exists
CREATE TABLE IF NOT EXISTS public.study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_members INTEGER DEFAULT 10,
  is_public BOOLEAN DEFAULT true,
  invite_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Generate invite code if not provided
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := upper(substring(md5(random()::text) from 1 for 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_invite ON public.study_groups;
CREATE TRIGGER trg_generate_invite
  BEFORE INSERT ON public.study_groups
  FOR EACH ROW
  EXECUTE FUNCTION generate_invite_code();

-- Enable and fix RLS
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view public groups" ON public.study_groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.study_groups;
DROP POLICY IF EXISTS "Creators can update groups" ON public.study_groups;

-- Create permissive policies
CREATE POLICY "Anyone can view public groups" ON public.study_groups
  FOR SELECT USING (is_public = true);

CREATE POLICY "Members can view groups they created" ON public.study_groups
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Authenticated users can create groups" ON public.study_groups
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Group creators can update" ON public.study_groups
  FOR UPDATE USING (created_by = auth.uid());

-- Study group members table
CREATE TABLE IF NOT EXISTS public.study_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view group membership" ON public.study_group_members;
DROP POLICY IF EXISTS "Users can join groups" ON public.study_group_members;
DROP POLICY IF EXISTS "Members can leave groups" ON public.study_group_members;

CREATE POLICY "Members can view groups" ON public.study_group_members
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can join" ON public.study_group_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Members can leave" ON public.study_group_members
  FOR DELETE USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON public.study_groups TO authenticated, anon;
GRANT ALL ON public.study_group_members TO authenticated, anon;

-- Verify
SELECT 'RLS policies fixed' as result;