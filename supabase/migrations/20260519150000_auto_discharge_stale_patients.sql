-- Alta automática após 7 dias sem gravação.
-- "Última atividade" = max(criação, última revisão, última consulta) — mesma
-- regra usada em patients_pending_discharge_review (Parte 2).
-- Roda 1x por dia às 03:00 UTC via pg_cron.

CREATE OR REPLACE FUNCTION public.auto_discharge_stale_patients()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH stale AS (
    SELECT v.id
      FROM public.patients_with_last_activity v
     WHERE v.admission_status = 'admitted'
       AND v.last_activity_at <= now() - interval '7 days'
  )
  UPDATE public.patients p
     SET admission_status = 'discharged',
         discharge_reason = COALESCE(p.discharge_reason, 'Alta automática após 7 dias sem gravação')
   FROM stale
   WHERE p.id = stale.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Permite que o owner do pg_cron job execute.
REVOKE ALL ON FUNCTION public.auto_discharge_stale_patients() FROM PUBLIC;

-- Remove agendamento anterior, se existir (idempotente).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-discharge-stale-patients') THEN
    PERFORM cron.unschedule('auto-discharge-stale-patients');
  END IF;
END $$;

-- Agenda: todo dia às 03:00 UTC (00:00 BRT).
SELECT cron.schedule(
  'auto-discharge-stale-patients',
  '0 3 * * *',
  $cron$ SELECT public.auto_discharge_stale_patients(); $cron$
);
