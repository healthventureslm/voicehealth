
CREATE TABLE public.collection_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  indicator_id uuid REFERENCES public.indicators(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  indicator_name text NOT NULL DEFAULT '',
  department_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'success',
  numerator numeric,
  denominator numeric,
  calculated_value numeric,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.collection_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage collection logs"
  ON public.collection_logs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "View logs in dept"
  ON public.collection_logs FOR SELECT
  TO authenticated
  USING (department_id = get_user_department(auth.uid()));

CREATE INDEX idx_collection_logs_batch ON public.collection_logs(batch_id);
CREATE INDEX idx_collection_logs_created ON public.collection_logs(created_at DESC);
