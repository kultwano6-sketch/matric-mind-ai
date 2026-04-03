const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://acqfmfqyygzcajerghbk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjcWZtZnF5eWd6Y2FqZXJnaGJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzkyODE2MCwiZXhwIjoyMDg5NTA0MTYwfQ.jNO_DJkk63e3iyXymxrA29HhNEtjIRVR9eXgFnft1ZA';

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
CREATE TABLE IF NOT EXISTS public.parent_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL DEFAULT 'parent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(parent_user_id, student_user_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON public.parent_links(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_student ON public.parent_links(student_user_id);

ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parents can view their linked students" ON public.parent_links;
CREATE POLICY "Parents can view their linked students" ON public.parent_links FOR SELECT USING (parent_user_id = auth.uid());

DROP POLICY IF EXISTS "Parents can create links to students" ON public.parent_links;
CREATE POLICY "Parents can create links to students" ON public.parent_links FOR INSERT WITH CHECK (parent_user_id = auth.uid());

DROP POLICY IF EXISTS "Parents can delete their own links" ON public.parent_links;
CREATE POLICY "Parents can delete their own links" ON public.parent_links FOR DELETE USING (parent_user_id = auth.uid());

DROP POLICY IF EXISTS "Students can see who their parent is" ON public.parent_links;
CREATE POLICY "Students can see who their parent is" ON public.parent_links FOR SELECT USING (student_user_id = auth.uid());
`;

async function runSQL() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    if (error) throw error;
    console.log('Success:', data);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

runSQL();