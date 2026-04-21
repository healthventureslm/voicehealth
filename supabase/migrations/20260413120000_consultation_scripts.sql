-- consultation_scripts: scripts de roteiro para gravação com teleprompter
CREATE TABLE IF NOT EXISTS consultation_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sector TEXT CHECK (sector IN ('uti', 'emergencia', 'enfermaria', 'ambulatorio')),
  report_type TEXT,
  description TEXT NOT NULL,
  fields JSONB DEFAULT '[]'::jsonb NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE consultation_scripts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active scripts
CREATE POLICY "consultation_scripts_read" ON consultation_scripts
  FOR SELECT TO authenticated
  USING (true);

-- Authenticated users can manage scripts (admin guard is at the route level)
CREATE POLICY "consultation_scripts_insert" ON consultation_scripts
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "consultation_scripts_update" ON consultation_scripts
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "consultation_scripts_delete" ON consultation_scripts
  FOR DELETE TO authenticated
  USING (true);
