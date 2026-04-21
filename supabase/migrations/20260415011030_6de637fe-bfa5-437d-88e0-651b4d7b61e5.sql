ALTER TABLE public.consultation_scripts
ADD COLUMN linked_template_id uuid REFERENCES public.report_templates(id) ON DELETE SET NULL;