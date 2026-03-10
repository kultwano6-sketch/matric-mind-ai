
-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignment_submissions;
