
-- LGPD Consent Records
CREATE TABLE public.lgpd_consent_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  consent_type text NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  version text NOT NULL DEFAULT '1.0',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

ALTER TABLE public.lgpd_consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own consent" ON public.lgpd_consent_records
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users create own consent" ON public.lgpd_consent_records
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users revoke own consent" ON public.lgpd_consent_records
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage consent" ON public.lgpd_consent_records
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- LGPD Audit Logs
CREATE TABLE public.lgpd_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  table_name text,
  record_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lgpd_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own logs" ON public.lgpd_audit_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins view all logs" ON public.lgpd_audit_logs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "System insert logs" ON public.lgpd_audit_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- LGPD Data Subject Requests
CREATE TABLE public.lgpd_data_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  request_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  processed_at timestamptz,
  processed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lgpd_data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own requests" ON public.lgpd_data_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users create own requests" ON public.lgpd_data_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage requests" ON public.lgpd_data_requests
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- LGPD Data Retention Policies (admin only)
CREATE TABLE public.lgpd_data_retention_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL UNIQUE,
  retention_days integer NOT NULL DEFAULT 365,
  anonymize_on_expiry boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lgpd_data_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage retention" ON public.lgpd_data_retention_policies
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "View retention policies" ON public.lgpd_data_retention_policies
  FOR SELECT TO authenticated USING (true);

-- Add consent fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN lgpd_consent_given boolean NOT NULL DEFAULT false,
  ADD COLUMN lgpd_consent_date timestamptz;

-- Indexes
CREATE INDEX idx_lgpd_consent_user ON public.lgpd_consent_records(user_id);
CREATE INDEX idx_lgpd_audit_user ON public.lgpd_audit_logs(user_id);
CREATE INDEX idx_lgpd_audit_created ON public.lgpd_audit_logs(created_at);
CREATE INDEX idx_lgpd_requests_user ON public.lgpd_data_requests(user_id);
CREATE INDEX idx_lgpd_requests_status ON public.lgpd_data_requests(status);

-- Trigger for updated_at on data_requests
CREATE TRIGGER update_lgpd_data_requests_updated_at
  BEFORE UPDATE ON public.lgpd_data_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lgpd_retention_updated_at
  BEFORE UPDATE ON public.lgpd_data_retention_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
