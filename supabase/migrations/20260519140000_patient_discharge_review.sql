-- Revisão de alta após 48h sem gravação.
-- "Última atividade" = max(consulta criada, revisão registrada, paciente criado).
-- Quando esse instante for >= 48h atrás e o paciente continua admitted,
-- ele aparece em patients_pending_discharge_review.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS last_discharge_review_at timestamptz;

-- View "set-returning" que materializa last_activity_at.
-- security_invoker=true → RLS de patients/consultations continua aplicada.
CREATE OR REPLACE VIEW public.patients_with_last_activity
WITH (security_invoker = true) AS
SELECT
  p.*,
  GREATEST(
    p.created_at,
    COALESCE(p.last_discharge_review_at, p.created_at),
    COALESCE(
      (SELECT MAX(c.created_at)
         FROM public.consultations c
        WHERE c.patient_id = p.id),
      p.created_at
    )
  ) AS last_activity_at
FROM public.patients p
WHERE p.deleted_at IS NULL;

-- Lista os pacientes admitidos sem atividade há >= 48h.
CREATE OR REPLACE FUNCTION public.patients_pending_discharge_review()
RETURNS TABLE (
  id uuid,
  hospital_id uuid,
  full_name text,
  current_ward_id uuid,
  last_activity_at timestamptz,
  hours_since numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.hospital_id,
    v.full_name,
    v.current_ward_id,
    v.last_activity_at,
    EXTRACT(EPOCH FROM (now() - v.last_activity_at)) / 3600 AS hours_since
  FROM public.patients_with_last_activity v
  WHERE v.admission_status = 'admitted'
    AND v.last_activity_at <= now() - interval '48 hours'
  ORDER BY v.last_activity_at ASC;
$$;

-- Marca a revisão como feita "agora" — usado quando o usuário decide
-- manter o paciente internado mesmo após o alerta.
CREATE OR REPLACE FUNCTION public.mark_patient_review_now(p_patient_id uuid)
RETURNS public.patients
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.patients
     SET last_discharge_review_at = now()
   WHERE id = p_patient_id
  RETURNING *;
$$;
