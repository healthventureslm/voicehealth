-- ============================================================================
-- 06_pivot_notes_and_documents.sql
-- ----------------------------------------------------------------------------
-- Pivô conceitual: consulta vira "nota livre" por padrão; documento estruturado
-- é gerado on-demand a partir de uma OU MAIS notas.
--
-- Mudanças:
-- 1. consultations.template_id já é nullable (sem mudança).
--    Convenção: template_id IS NULL  → nota livre (só transcrição, sem report)
--               template_id IS NOT NULL → consulta clássica (gera 1 report)
-- 2. clinical_reports.consultation_id passa a ser nullable.
-- 3. clinical_reports ganha patient_id NOT NULL (denormalizado pra query)
--    e source_consultation_ids uuid[] (notas usadas como fonte na geração).
-- 4. RLS de clinical_reports atualizada pra resolver via patient_id quando
--    consultation_id for NULL.
--
-- Idempotente. Pode rodar mais de uma vez.
-- ============================================================================

BEGIN;

-- 1) consultation_id nullable
ALTER TABLE clinical_reports
  ALTER COLUMN consultation_id DROP NOT NULL;

-- 2) patient_id (denormalizado)
ALTER TABLE clinical_reports
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES patients(id) ON DELETE CASCADE;

-- backfill com base em consultation
UPDATE clinical_reports r
   SET patient_id = c.patient_id
  FROM consultations c
 WHERE r.patient_id IS NULL
   AND r.consultation_id = c.id;

ALTER TABLE clinical_reports
  ALTER COLUMN patient_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reports_patient ON clinical_reports(patient_id);

-- 3) source_consultation_ids
ALTER TABLE clinical_reports
  ADD COLUMN IF NOT EXISTS source_consultation_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

-- garantir que pelo menos um vínculo exista (consultation_id direto OU array)
ALTER TABLE clinical_reports
  DROP CONSTRAINT IF EXISTS clinical_reports_has_source;
ALTER TABLE clinical_reports
  ADD  CONSTRAINT clinical_reports_has_source
  CHECK (consultation_id IS NOT NULL OR array_length(source_consultation_ids, 1) > 0);

-- 4) RLS — derruba e recria pra contemplar caso de patient_id direto
DROP POLICY IF EXISTS cr_select ON clinical_reports;
DROP POLICY IF EXISTS cr_insert ON clinical_reports;

CREATE POLICY cr_select ON clinical_reports FOR SELECT TO authenticated
USING (
  -- via patient_id (caminho novo, sempre vale)
  EXISTS (
    SELECT 1 FROM patients p
    WHERE p.id = clinical_reports.patient_id
      AND (
        is_hospital_admin_of(auth.uid(), p.hospital_id)
        OR has_role_in_hospital(auth.uid(), 'auditor', p.hospital_id)
        OR p.current_ward_id = ANY (current_ward_ids(auth.uid()))
      )
  )
  -- ou via consulta vinculada (caminho legado, autoria)
  OR (
    consultation_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM consultations c
      WHERE c.id = clinical_reports.consultation_id
        AND c.professional_id = auth.uid()
    )
  )
);

CREATE POLICY cr_insert ON clinical_reports FOR INSERT TO authenticated
WITH CHECK (
  -- pra consulta clássica: tem que poder editar a consulta
  (
    consultation_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM consultations c
      WHERE c.id = clinical_reports.consultation_id
        AND can_edit_consultation(auth.uid(), c.id)
    )
  )
  -- pra documento gerado de notas: tem que poder atender o paciente hoje
  OR (
    consultation_id IS NULL
    AND EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = clinical_reports.patient_id
        AND p.current_ward_id = ANY (current_ward_ids(auth.uid()))
    )
  )
);

COMMIT;
