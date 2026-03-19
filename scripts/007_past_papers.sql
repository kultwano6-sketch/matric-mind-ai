-- Past Papers table
CREATE TABLE IF NOT EXISTS past_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject matric_subject NOT NULL,
  year INTEGER NOT NULL CHECK (year >= 2010 AND year <= 2030),
  paper_number INTEGER NOT NULL DEFAULT 1 CHECK (paper_number IN (1, 2, 3)),
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 180,
  total_marks INTEGER NOT NULL DEFAULT 150,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  memo JSONB DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subject, year, paper_number)
);

-- Past Paper Attempts table
CREATE TABLE IF NOT EXISTS past_paper_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id UUID NOT NULL REFERENCES past_papers(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INTEGER,
  total_marks INTEGER,
  percentage DECIMAL(5,2),
  time_taken_seconds INTEGER,
  ai_feedback JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_past_papers_subject_year ON past_papers(subject, year DESC);
CREATE INDEX IF NOT EXISTS idx_past_paper_attempts_student ON past_paper_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_past_paper_attempts_paper ON past_paper_attempts(paper_id);
CREATE INDEX IF NOT EXISTS idx_past_paper_attempts_completed ON past_paper_attempts(student_id, is_completed);

-- Enable RLS
ALTER TABLE past_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE past_paper_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for past_papers (everyone can read active papers)
DROP POLICY IF EXISTS "Anyone can view active past papers" ON past_papers;
CREATE POLICY "Anyone can view active past papers" ON past_papers
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage past papers" ON past_papers;
CREATE POLICY "Admins can manage past papers" ON past_papers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'head_teacher')
    )
  );

-- RLS Policies for past_paper_attempts
DROP POLICY IF EXISTS "Students can view own attempts" ON past_paper_attempts;
CREATE POLICY "Students can view own attempts" ON past_paper_attempts
  FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can create own attempts" ON past_paper_attempts;
CREATE POLICY "Students can create own attempts" ON past_paper_attempts
  FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can update own attempts" ON past_paper_attempts;
CREATE POLICY "Students can update own attempts" ON past_paper_attempts
  FOR UPDATE USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can view student attempts" ON past_paper_attempts;
CREATE POLICY "Teachers can view student attempts" ON past_paper_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'head_teacher', 'teacher')
    )
  );

-- Insert sample past papers (Mathematics 2023)
INSERT INTO past_papers (subject, year, paper_number, title, duration_minutes, total_marks, questions, memo)
VALUES 
  ('mathematics', 2023, 1, 'Mathematics Paper 1 - November 2023', 180, 150, 
   '[
     {"number": 1, "marks": 15, "type": "structured", "question": "Solve the following equations:\n\n1.1 Solve for x: 2x² - 5x - 3 = 0\n1.2 Solve for x and y simultaneously:\n    2x + y = 7\n    x² - y = 11\n1.3 If f(x) = 2x - 3, solve for x if f(x) = 5"},
     {"number": 2, "marks": 20, "type": "structured", "question": "Given the arithmetic sequence: 5; 9; 13; ...\n\n2.1 Write down the next two terms.\n2.2 Determine the nth term of the sequence.\n2.3 Calculate the sum of the first 20 terms.\n2.4 Which term of the sequence equals 101?"},
     {"number": 3, "marks": 25, "type": "structured", "question": "Given f(x) = x² - 4x - 5\n\n3.1 Factorise f(x)\n3.2 Write down the x-intercepts of f\n3.3 Determine the turning point of f\n3.4 Sketch the graph of f, clearly showing all intercepts and the turning point\n3.5 For which values of x is f(x) ≥ 0?"},
     {"number": 4, "marks": 20, "type": "structured", "question": "The graph of g(x) = aˣ + q passes through the points (0; 4) and (1; 10).\n\n4.1 Determine the values of a and q.\n4.2 Write down the equation of the asymptote.\n4.3 Determine the range of g.\n4.4 Calculate the value of x for which g(x) = 58."},
     {"number": 5, "marks": 25, "type": "structured", "question": "In the diagram, P(3; 4) is a point in the Cartesian plane. OP makes an angle θ with the positive x-axis.\n\n5.1 Calculate the length of OP.\n5.2 Determine the value of tan θ.\n5.3 Calculate the value of cos²θ + sin²θ without using a calculator.\n5.4 Simplify: (sin θ + cos θ)² - 1"},
     {"number": 6, "marks": 20, "type": "structured", "question": "Financial Mathematics:\n\n6.1 R15 000 is invested at 8% p.a. compound interest. Calculate the value of the investment after 5 years.\n6.2 A car depreciates at 15% p.a. on a reducing balance. If it is worth R80 000 now, what was its original value 3 years ago?\n6.3 Calculate the effective interest rate if the nominal rate is 12% p.a. compounded monthly."},
     {"number": 7, "marks": 25, "type": "structured", "question": "Calculus:\n\n7.1 Determine f''(x) if f(x) = 3x⁴ - 2x³ + x - 7\n7.2 The curve y = x³ - 6x² + 9x has a local maximum at point A. Determine the coordinates of A.\n7.3 Determine the equation of the tangent to the curve y = x² - 3x + 2 at the point where x = 2."}
   ]'::jsonb,
   '[
     {"number": 1, "marks": 15, "answers": "1.1 x = 3 or x = -1/2\n1.2 x = 3, y = 1 OR x = -6, y = 19\n1.3 x = 4"},
     {"number": 2, "marks": 20, "answers": "2.1 17; 21\n2.2 Tn = 4n + 1\n2.3 S₂₀ = 940\n2.4 n = 25"},
     {"number": 3, "marks": 25, "answers": "3.1 f(x) = (x - 5)(x + 1)\n3.2 x = 5 or x = -1\n3.3 Turning point: (2; -9)\n3.4 [Graph with correct shape, intercepts and TP]\n3.5 x ≤ -1 or x ≥ 5"},
     {"number": 4, "marks": 20, "answers": "4.1 a = 3, q = 3\n4.2 y = 3\n4.3 y > 3\n4.4 x = 3"},
     {"number": 5, "marks": 25, "answers": "5.1 OP = 5\n5.2 tan θ = 4/3\n5.3 cos²θ + sin²θ = 1\n5.4 2sin θ cos θ OR sin 2θ"},
     {"number": 6, "marks": 20, "answers": "6.1 R22 039,93\n6.2 R130 525,54\n6.3 12,68%"},
     {"number": 7, "marks": 25, "answers": "7.1 f''(x) = 36x² - 12x\n7.2 A(1; 4)\n7.3 y = x - 2"}
   ]'::jsonb),
  ('mathematics', 2023, 2, 'Mathematics Paper 2 - November 2023', 180, 150,
   '[
     {"number": 1, "marks": 18, "type": "structured", "question": "Statistics:\nThe marks obtained by 12 learners in a Mathematics test are:\n45; 52; 60; 48; 55; 62; 58; 50; 47; 63; 54; 59\n\n1.1 Calculate the mean mark.\n1.2 Calculate the standard deviation.\n1.3 Determine the number of learners whose marks lie within ONE standard deviation of the mean.\n1.4 Draw a box-and-whisker diagram for the data."},
     {"number": 2, "marks": 22, "type": "structured", "question": "Analytical Geometry:\nA(-2; 3), B(4; 1) and C(6; 7) are vertices of triangle ABC.\n\n2.1 Calculate the length of AB.\n2.2 Calculate the gradient of AC.\n2.3 Determine the equation of line BC.\n2.4 Calculate the area of triangle ABC.\n2.5 Determine whether triangle ABC is right-angled. Show all working."},
     {"number": 3, "marks": 25, "type": "structured", "question": "Trigonometry:\n\n3.1 Prove that: (1 - cos²θ)/sin θ = sin θ\n3.2 Simplify without using a calculator: cos 150° × tan 225° / sin(-60°)\n3.3 Solve for x ∈ [0°; 360°]: 2sin²x - sin x - 1 = 0\n3.4 In triangle PQR, p = 7, q = 8 and R̂ = 60°. Calculate the length of r."},
     {"number": 4, "marks": 30, "type": "structured", "question": "Euclidean Geometry:\nIn the diagram, O is the centre of the circle. A, B, C and D are points on the circumference. AC and BD intersect at E. AÔB = 100°.\n\n4.1 Calculate AĈB, giving reasons.\n4.2 If AÊD = 65°, calculate AB̂D.\n4.3 Prove that ABEC is a cyclic quadrilateral.\n4.4 If AB = 10 cm and BC = 8 cm, calculate the radius of the circle."},
     {"number": 5, "marks": 25, "type": "structured", "question": "3D Trigonometry:\nA vertical tower AB stands on horizontal ground. From a point C on the ground, the angle of elevation to the top of the tower is 35°. D is another point on the ground such that CD = 50 m, AĈD = 70° and AD̂C = 85°.\n\n5.1 Calculate the distance AC.\n5.2 Calculate the height of the tower AB.\n5.3 Calculate the distance from D to the top of the tower."},
     {"number": 6, "marks": 30, "type": "structured", "question": "Circle Geometry and Proportionality:\nIn the diagram, PA is a tangent to circle ABCD at A. BC is produced to meet PA at P. AD || BC.\n\n6.1 Prove that PA² = PB × PC.\n6.2 If PB = 4 and BC = 5, calculate PA.\n6.3 Prove that triangle PAD is isosceles."}
   ]'::jsonb,
   '[
     {"number": 1, "marks": 18, "answers": "1.1 Mean = 54,42\n1.2 Standard deviation = 5,77\n1.3 8 learners\n1.4 Box-and-whisker with: Min=45, Q1=48,5, M=54,5, Q3=59,5, Max=63"},
     {"number": 2, "marks": 22, "answers": "2.1 AB = 2√10\n2.2 mAC = 1/2\n2.3 y = 3x - 11\n2.4 Area = 22 square units\n2.5 No, triangle ABC is not right-angled"},
     {"number": 3, "marks": 25, "answers": "3.1 LHS = sin²θ/sinθ = sinθ = RHS\n3.2 = √3/2\n3.3 x = 90° or x = 210° or x = 330°\n3.4 r = √57 or r ≈ 7,55"},
     {"number": 4, "marks": 30, "answers": "4.1 AĈB = 50° (angle at centre = 2 × angle at circumference)\n4.2 AB̂D = 25°\n4.3 [Proof using properties of cyclic quadrilaterals]\n4.4 r = 6,53 cm"},
     {"number": 5, "marks": 25, "answers": "5.1 AC = 124,45 m\n5.2 AB = 87,14 m\n5.3 AD = 109,26 m"},
     {"number": 6, "marks": 30, "answers": "6.1 [Proof using tangent-secant theorem]\n6.2 PA = 6\n6.3 [Proof showing PA = PD]"}
   ]'::jsonb),
  ('physical_sciences', 2023, 1, 'Physical Sciences Paper 1 (Physics) - November 2023', 180, 150,
   '[
     {"number": 1, "marks": 20, "type": "multiple_choice", "question": "Multiple choice questions covering Newton''s Laws, momentum, work-energy, waves, electricity and magnetism."},
     {"number": 2, "marks": 25, "type": "structured", "question": "Newton''s Laws:\n\nA 2 kg block rests on a rough horizontal surface. A force of 15 N is applied at an angle of 30° above the horizontal.\n\n2.1 Draw a free-body diagram showing ALL forces acting on the block.\n2.2 Calculate the normal force exerted on the block.\n2.3 If the coefficient of kinetic friction is 0,3, calculate the acceleration of the block.\n2.4 The force is now removed. How far will the block travel before coming to rest if it was moving at 4 m·s⁻¹?"},
     {"number": 3, "marks": 25, "type": "structured", "question": "Momentum and Impulse:\n\nA 1500 kg car travelling at 20 m·s⁻¹ collides head-on with a 1000 kg car travelling at 15 m·s⁻¹ in the opposite direction. After the collision, the cars move together.\n\n3.1 Calculate the velocity of the cars immediately after the collision.\n3.2 Is this collision elastic or inelastic? Support your answer with a calculation.\n3.3 Calculate the impulse experienced by the lighter car.\n3.4 If the collision lasted 0,15 s, calculate the average force exerted on the heavier car."},
     {"number": 4, "marks": 30, "type": "structured", "question": "Electricity:\n\nA circuit consists of a 12 V battery with internal resistance 0,5 Ω connected to three resistors: R₁ = 4 Ω, R₂ = 6 Ω (in series), and R₃ = 3 Ω (in parallel with R₂).\n\n4.1 Calculate the total external resistance.\n4.2 Calculate the current through the battery.\n4.3 Calculate the potential difference across R₁.\n4.4 Calculate the power dissipated in R₃.\n4.5 How would the reading on a voltmeter connected across the battery terminals change if R₃ were removed?"},
     {"number": 5, "marks": 25, "type": "structured", "question": "Waves and Light:\n\n5.1 A standing wave is formed on a string 2,4 m long. If the frequency of the wave is 50 Hz and 6 antinodes are observed, calculate the speed of the wave.\n5.2 Light travels from water (n = 1,33) into glass (n = 1,52). If the angle of incidence is 40°, calculate the angle of refraction.\n5.3 Calculate the critical angle for light travelling from glass to water.\n5.4 Explain why a diamond sparkles more than glass."},
     {"number": 6, "marks": 25, "type": "structured", "question": "Electromagnetism:\n\nA straight conductor carrying a current of 5 A is placed perpendicular to a magnetic field of 0,2 T. The length of the conductor in the field is 30 cm.\n\n6.1 Calculate the force on the conductor.\n6.2 State the direction of the force using the right-hand rule.\n6.3 If this conductor is part of a DC motor, explain how continuous rotation is achieved.\n6.4 Calculate the magnetic flux through a rectangular coil of area 0,05 m² placed perpendicular to the field."}
   ]'::jsonb,
   NULL)
ON CONFLICT (subject, year, paper_number) DO NOTHING;
