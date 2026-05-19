-- Alta automática após 7 dias sem gravação.
-- "Última atividade" = max(criação, última revisão, última consulta) — mesma
-- regra usada em patients_pending_discharge_review (Parte 2).
-- Quando a extensão pg_cron estiver disponível, roda 1x por dia às 03:00 UTC.

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

REVOKE ALL ON FUNCTION public.auto_discharge_stale_patients() FROM PUBLIC;

-- Agendamento defensivo: só registra o cron job se a extensão pg_cron
-- estiver instalada no projeto. Em projetos sem pg_cron a função fica
-- disponível para ser chamada manualmente (ex.: SQL editor ou edge
-- function) sem quebrar a migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove agendamento anterior se existir, mantém idempotência.
    BEGIN
      PERFORM cron.unschedule('auto-discharge-stale-patients');
    EXCEPTION WHEN OTHERS THEN
      -- Não havia job; segue em frente.
      NULL;
    END;

    PERFORM cron.schedule(
      'auto-discharge-stale-patients',
      '0 3 * * *',
      $cron$ SELECT public.auto_discharge_stale_patients(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron não está habilitado — auto_discharge_stale_patients() criada, mas sem agendamento automático. Habilite pg_cron e rode novamente para ativar o cron job.';
  END IF;
END $$;
