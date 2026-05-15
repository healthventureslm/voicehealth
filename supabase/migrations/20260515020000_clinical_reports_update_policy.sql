-- RLS estava só com SELECT/INSERT em clinical_reports, então UPDATE
-- vindo do client (médico editando filled_data via StructuredReportView)
-- retornava 0 linhas silenciosamente. PostgREST com .single() devolve
-- 406 "Cannot coerce the result to a single JSON object".
--
-- Política espelha o INSERT: autor da consulta (can_edit_consultation),
-- admin do hospital (is_hospital_admin_of) ou ward member quando o
-- report é multi-nota (consultation_id IS NULL).
--
-- Auditor NÃO pode editar — propositalmente fora.
-- Super admin já tem ALL via cr_super.

CREATE POLICY cr_update ON public.clinical_reports
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = clinical_reports.patient_id
      AND is_hospital_admin_of(auth.uid(), p.hospital_id)
  )
  OR (
    consultation_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id = clinical_reports.consultation_id
        AND can_edit_consultation(auth.uid(), c.id)
    )
  )
  OR (
    consultation_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = clinical_reports.patient_id
        AND p.current_ward_id = ANY (current_ward_ids(auth.uid()))
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = clinical_reports.patient_id
      AND is_hospital_admin_of(auth.uid(), p.hospital_id)
  )
  OR (
    consultation_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id = clinical_reports.consultation_id
        AND can_edit_consultation(auth.uid(), c.id)
    )
  )
  OR (
    consultation_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = clinical_reports.patient_id
        AND p.current_ward_id = ANY (current_ward_ids(auth.uid()))
    )
  )
);
