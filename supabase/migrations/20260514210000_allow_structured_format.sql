-- A constraint original em clinical_reports.format só permitia
-- 'markdown' (e talvez 'html'). O modo estruturado da Fase 2 usa
-- format = 'structured', então o CHECK precisa ser ampliado.

ALTER TABLE public.clinical_reports
  DROP CONSTRAINT IF EXISTS clinical_reports_format_check;

ALTER TABLE public.clinical_reports
  ADD CONSTRAINT clinical_reports_format_check
  CHECK (format IN ('markdown', 'html', 'structured'));
