-- Add storage bucket for group files
-- Run this in Supabase SQL Editor

-- Create storage bucket for group files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'group-files',
  'group-files',
  true,
  52428800, -- 50MB
  ARRAY['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their groups
CREATE POLICY "Users can upload group files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'group-files' 
  AND (storage.foldername(name))[1] IN (
    SELECT sg.id::text FROM study_groups sg
    JOIN study_group_members sgm ON sgm.group_id = sg.id
    WHERE sgm.user_id = auth.uid()
  )
);

-- Allow group members to view files
CREATE POLICY "Group members can view files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'group-files'
  AND (storage.foldername(name))[1] IN (
    SELECT sg.id::text FROM study_groups sg
    JOIN study_group_members sgm ON sgm.group_id = sg.id
    WHERE sgm.user_id = auth.uid()
  )
);

-- Allow file owners to delete their files
CREATE POLICY "Users can delete own files" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'group-files'
  AND name ILIKE '%' || auth.uid()::text || '%'
);

-- Create study_group_messages table if not exists (for voice/video/file messages)
CREATE TABLE IF NOT EXISTS public.study_group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'voice', 'video', 'image')),
  file_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  duration_sec INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view messages" ON public.study_group_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM study_group_members
    WHERE group_id = study_group_messages.group_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Group members can send messages" ON public.study_group_messages
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM study_group_members
    WHERE group_id = study_group_messages.group_id
    AND user_id = auth.uid()
  )
);

CREATE INDEX idx_messages_group ON public.study_group_messages(group_id);
CREATE INDEX idx_messages_created ON public.study_group_messages(created_at);

-- Grant permissions
GRANT ALL ON public.study_group_messages TO authenticated;
GRANT ALL ON public.study_group_messages TO anon;