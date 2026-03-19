-- Exam dates table
CREATE TABLE IF NOT EXISTS exam_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject matric_subject NOT NULL,
  exam_date DATE NOT NULL,
  paper_number INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, subject, paper_number)
);

-- Study plans table
CREATE TABLE IF NOT EXISTS study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  generated_at TIMESTAMPTZ DEFAULT now(),
  valid_until DATE,
  ai_strategy TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Daily study tasks
CREATE TABLE IF NOT EXISTS study_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject matric_subject NOT NULL,
  task_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER DEFAULT 60,
  priority INTEGER DEFAULT 1,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exam_dates_student ON exam_dates(student_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_student_active ON study_plans(student_id, is_active);
CREATE INDEX IF NOT EXISTS idx_study_tasks_student_date ON study_tasks(student_id, task_date);
CREATE INDEX IF NOT EXISTS idx_study_tasks_plan ON study_tasks(plan_id);

-- Enable RLS
ALTER TABLE exam_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exam_dates
DROP POLICY IF EXISTS "Students can manage own exam dates" ON exam_dates;
CREATE POLICY "Students can manage own exam dates" ON exam_dates
  FOR ALL USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can view student exam dates" ON exam_dates;
CREATE POLICY "Teachers can view student exam dates" ON exam_dates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'head_teacher', 'teacher')
    )
  );

-- RLS Policies for study_plans
DROP POLICY IF EXISTS "Students can manage own study plans" ON study_plans;
CREATE POLICY "Students can manage own study plans" ON study_plans
  FOR ALL USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can view student study plans" ON study_plans;
CREATE POLICY "Teachers can view student study plans" ON study_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'head_teacher', 'teacher')
    )
  );

-- RLS Policies for study_tasks
DROP POLICY IF EXISTS "Students can manage own study tasks" ON study_tasks;
CREATE POLICY "Students can manage own study tasks" ON study_tasks
  FOR ALL USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can view student study tasks" ON study_tasks;
CREATE POLICY "Teachers can view student study tasks" ON study_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'head_teacher', 'teacher')
    )
  );
