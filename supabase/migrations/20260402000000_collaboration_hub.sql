-- ============================================================
-- Matric Mind AI - Collaboration Hub Tables
-- Study groups, group members, and group messages
-- ============================================================

-- Study Groups
CREATE TABLE IF NOT EXISTS public.study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  max_members INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Group Members
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Group Messages
CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Study Groups Policies
CREATE POLICY "Anyone can view public groups"
  ON public.study_groups FOR SELECT
  USING (is_public = true);

CREATE POLICY "Admins can view all groups"
  ON public.study_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "Users can create groups"
  ON public.study_groups FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group admins can update their groups"
  ON public.study_groups FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = study_groups.id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
    )
  );

CREATE POLICY "Group admins can delete their groups"
  ON public.study_groups FOR DELETE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = study_groups.id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
    )
  );

-- Group Members Policies
CREATE POLICY "Members can view group members"
  ON public.group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id
      AND gm2.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can join public groups"
  ON public.group_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.study_groups sg
      WHERE sg.id = group_members.group_id
      AND sg.is_public = true
    )
  );

CREATE POLICY "Members can leave groups"
  ON public.group_members FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can remove members"
  ON public.group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
    )
  );

-- Group Messages Policies
CREATE POLICY "Group members can view messages"
  ON public.group_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_messages.group_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can send messages"
  ON public.group_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_messages.group_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group admins can delete messages"
  ON public.group_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_messages.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_study_groups_subject ON public.study_groups(subject);
CREATE INDEX idx_study_groups_invite ON public.study_groups(invite_code);
CREATE INDEX idx_study_groups_created ON public.study_groups(created_at DESC);
CREATE INDEX idx_group_members_group ON public.group_members(group_id);
CREATE INDEX idx_group_members_user ON public.group_members(user_id);
CREATE INDEX idx_group_messages_group ON public.group_messages(group_id);
CREATE INDEX idx_group_messages_created ON public.group_messages(created_at DESC);

-- Function to get member count
CREATE OR REPLACE FUNCTION public.get_group_member_count(group_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM public.group_members WHERE group_id = $1;
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions
GRANT ALL ON public.study_groups TO authenticated;
GRANT ALL ON public.group_members TO authenticated;
GRANT ALL ON public.group_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_member_count(UUID) TO authenticated;

-- Trigger to generate invite code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := upper(substring(md5(random()::text) from 1 for 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_invite_code
  BEFORE INSERT ON public.study_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_invite_code();

-- Trigger to update member count on changes
CREATE OR REPLACE FUNCTION public.update_group_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- This could be used to maintain a cached member_count field
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;