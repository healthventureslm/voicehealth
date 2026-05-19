-- Alta de pacientes: registra timestamp, motivo e quem deu alta.
-- admission_status já existe e suporta 'discharged'; aqui só guardamos o contexto.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS discharged_at timestamptz,
  ADD COLUMN IF NOT EXISTS discharge_reason text,
  ADD COLUMN IF NOT EXISTS discharged_by uuid REFERENCES auth.users(id);

-- Mantém discharged_at em sincronia com admission_status (idempotente):
-- - Ao marcar discharged, seta discharged_at = now() se ainda não setado.
-- - Ao voltar pra admitted (readmissão), limpa os campos.
CREATE OR REPLACE FUNCTION public.sync_patient_discharge_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.admission_status = 'discharged' AND (OLD.admission_status IS DISTINCT FROM 'discharged') THEN
    IF NEW.discharged_at IS NULL THEN
      NEW.discharged_at := now();
    END IF;
  ELSIF NEW.admission_status = 'admitted' AND OLD.admission_status = 'discharged' THEN
    NEW.discharged_at := NULL;
    NEW.discharge_reason := NULL;
    NEW.discharged_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_patient_discharge_fields ON public.patients;
CREATE TRIGGER trg_sync_patient_discharge_fields
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  WHEN (NEW.admission_status IS DISTINCT FROM OLD.admission_status)
  EXECUTE FUNCTION public.sync_patient_discharge_fields();

CREATE INDEX IF NOT EXISTS idx_patients_discharged_at
  ON public.patients(discharged_at)
  WHERE admission_status = 'discharged' AND deleted_at IS NULL;
