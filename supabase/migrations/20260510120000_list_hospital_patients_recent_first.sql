-- ============================================================================
-- 20260510120000_list_hospital_patients_recent_first.sql
-- ----------------------------------------------------------------------------
-- Atualiza a função list_hospital_patients pra:
--  1. Retornar created_at (pra debug/futuro)
--  2. Ordenar por created_at DESC (mais recentes primeiro)
--
-- Drop+Create porque mudar o RETURNS TABLE não pode ser feito via OR REPLACE.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.list_hospital_patients();

CREATE FUNCTION public.list_hospital_patients()
RETURNS TABLE (
  id                uuid,
  hospital_id       uuid,
  full_name         text,
  current_ward_id   uuid,
  admission_status  patient_admission_status,
  ward_name         text,
  ward_type         ward_type,
  created_at        timestamptz
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
    w.ward_type  AS ward_type,
    p.created_at
  FROM patients p
  LEFT JOIN wards w ON w.id = p.current_ward_id
  WHERE p.deleted_at IS NULL
    AND (
      is_super_admin(auth.uid())
      OR p.hospital_id = ANY (current_hospital_ids(auth.uid()))
    )
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_hospital_patients() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_hospital_patients() TO authenticated;

COMMENT ON FUNCTION public.list_hospital_patients() IS
  'Diretório leve de pacientes do hospital do usuário. Ordenado por created_at DESC (mais recentes primeiro). Devolve só campos não-sensíveis; dados clínicos completos seguem protegidos pela RLS de patients.';

COMMIT;
