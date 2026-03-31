-- TEACHER APPROVAL SYSTEM
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Create teacher approval requests table
CREATE TABLE IF NOT EXISTS public.teacher_approval_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    subjects matric_subject[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- 2. Enable RLS
ALTER TABLE public.teacher_approval_requests ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Anyone can insert their own approval request
CREATE POLICY "Users can create own approval request" 
    ON public.teacher_approval_requests FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Admins and head teachers can view all requests
CREATE POLICY "Admins can view all requests" 
    ON public.teacher_approval_requests FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'head_teacher')
        )
    );

-- Admins and head teachers can update requests
CREATE POLICY "Admins can update requests" 
    ON public.teacher_approval_requests FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'head_teacher')
        )
    );

-- 4. Add status column to teacher_profiles if needed (optional)
ALTER TABLE public.teacher_profiles 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';

-- 5. Create function to check if teacher is approved
CREATE OR REPLACE FUNCTION is_teacher_approved(teacher_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.teacher_approval_requests
        WHERE user_id = teacher_user_id 
        AND status = 'approved'
    ) OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = teacher_user_id 
        AND role IN ('admin', 'head_teacher')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant access to authenticated users
GRANT ALL ON public.teacher_approval_requests TO authenticated;
