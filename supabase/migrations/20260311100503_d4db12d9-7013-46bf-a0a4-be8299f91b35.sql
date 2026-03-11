
-- Study streaks table
CREATE TABLE public.study_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  login_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, login_date)
);

ALTER TABLE public.study_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own streaks" ON public.study_streaks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for assignment files
INSERT INTO storage.buckets (id, name, public) VALUES ('assignment-files', 'assignment-files', false);

-- Storage policies
CREATE POLICY "Students can upload own files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assignment-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Students can view own files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'assignment-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Teachers can view all assignment files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'assignment-files' AND (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'head_teacher') OR public.has_role(auth.uid(), 'admin')));
