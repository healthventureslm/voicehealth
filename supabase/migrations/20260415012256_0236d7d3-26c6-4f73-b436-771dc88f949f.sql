
ALTER TABLE public.consultations
ADD COLUMN ai_summary text;

ALTER TABLE public.report_templates
ADD COLUMN requires_serial boolean NOT NULL DEFAULT false,
ADD COLUMN min_recordings integer NOT NULL DEFAULT 1;
