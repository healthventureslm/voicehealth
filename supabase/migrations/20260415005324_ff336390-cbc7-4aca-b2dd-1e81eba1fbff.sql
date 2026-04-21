
CREATE TABLE public.admin_whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage whitelist" ON public.admin_whitelist
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Check whitelist by email" ON public.admin_whitelist
  FOR SELECT TO anon, authenticated
  USING (true);

INSERT INTO public.admin_whitelist (email) VALUES
  ('marcelokal68@gmail.com'),
  ('gustavonobre5387@gmail.com');
