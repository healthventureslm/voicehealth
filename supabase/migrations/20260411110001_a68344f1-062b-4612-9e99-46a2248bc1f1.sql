
-- App settings key-value store
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed default cron schedule
INSERT INTO public.app_settings (key, value, description)
VALUES ('cron_schedule', '0 6 * * *', 'Agendamento cron da coleta automática de indicadores (formato cron)');

-- Function to update the cron job schedule (called by edge function)
CREATE OR REPLACE FUNCTION public.update_cron_schedule(new_schedule text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
BEGIN
  -- Remove existing job if any
  PERFORM cron.unschedule('scheduled-indicator-collect');
  
  -- Create new job with the updated schedule
  PERFORM cron.schedule(
    'scheduled-indicator-collect',
    new_schedule,
    format(
      $job$
      SELECT net.http_post(
        url := '%s/functions/v1/scheduled-collect',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
        body := concat('{"time": "', now(), '"}')::jsonb
      ) AS request_id;
      $job$,
      current_setting('app.settings.supabase_url', true),
      current_setting('app.settings.supabase_anon_key', true)
    )
  );
END;
$$;
