-- ============================================================================
-- 20260508120000_patients_directory_function.sql
-- ----------------------------------------------------------------------------
-- Diretório leve de pacientes do hospital.
--
-- Hoje a RLS de `patients` (patients_ward_select) só deixa doctor/nurse lerem
-- pacientes que estão num setor onde têm ward_assignment ativo. Isso protege
-- dados clínicos sensíveis (prontuário, leito, data de nascimento, etc.).
--
-- Mas o produto precisa que qualquer membro do hospital saiba QUE existe um
-- paciente X no setor Y — sem expor dado clínico. A solução é uma função
-- SECURITY DEFINER que devolve apenas campos não-sensíveis pra todos os
-- pacientes do hospital do usuário.
--
-- O que NÃO é exposto: medical_record, bed, date_of_birth, initials, notes,
-- created_by, metadata. Pra ler esses, o caller continua precisando da RLS
-- de `patients` (= estar no setor do paciente, ou ser admin/auditor).
--
-- Quem pode chamar: qualquer authenticated. O próprio corpo da função filtra
-- por current_hospital_ids do auth.uid().
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.list_hospital_patients()
RETURNS TABLE (
  id                uuid,
  hospital_id       uuid,
  full_name         text,
  current_ward_id   uuid,
  admission_status  patient_admission_status,
  ward_name         text,
  ward_type         ward_type
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.hospital_id,
    p.full_name,
    p.current_ward_id,
    p.admission_status,
    w.name       AS ward_name,
    w.ward_type  AS ward_type
  FROM patients p
  LEFT JOIN wards w ON w.id = p.current_ward_id
  WHERE p.deleted_at IS NULL
    AND (
      is_super_admin(auth.uid())
      OR p.hospital_id = ANY (current_hospital_ids(auth.uid()))
    )
  ORDER BY p.full_name;
$$;

REVOKE ALL ON FUNCTION public.list_hospital_patients() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_hospital_patients() TO authenticated;

COMMENT ON FUNCTION public.list_hospital_patients() IS
  'Diretório leve de pacientes do hospital do usuário. Devolve só campos não-sensíveis. Dados clínicos completos seguem protegidos pela RLS de patients.';

COMMIT;
