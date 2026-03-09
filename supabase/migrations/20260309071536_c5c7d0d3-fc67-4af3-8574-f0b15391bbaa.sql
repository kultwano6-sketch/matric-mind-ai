
-- Fix the overly permissive activity_log insert policy
DROP POLICY "System can insert activity log" ON public.activity_log;
CREATE POLICY "Authenticated users can log own activity" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
