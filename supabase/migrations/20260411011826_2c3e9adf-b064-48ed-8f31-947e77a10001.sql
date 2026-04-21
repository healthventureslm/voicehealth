
-- Table: indicator_subtypes
CREATE TABLE public.indicator_subtypes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  bundle_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_value NUMERIC,
  warning_threshold NUMERIC,
  critical_threshold NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(indicator_id, code)
);

ALTER TABLE public.indicator_subtypes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage subtypes" ON public.indicator_subtypes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "View subtypes" ON public.indicator_subtypes FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER update_indicator_subtypes_updated_at
  BEFORE UPDATE ON public.indicator_subtypes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: indicator_events
CREATE TABLE public.indicator_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  subtype_id UUID REFERENCES public.indicator_subtypes(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  ward_id UUID REFERENCES public.wards(id) ON DELETE SET NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bundle_compliance JSONB DEFAULT '{}'::jsonb,
  bundle_score NUMERIC,
  notes TEXT,
  recorded_by UUID NOT NULL,
  root_cause TEXT,
  corrective_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.indicator_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View events in dept" ON public.indicator_events FOR SELECT TO authenticated
  USING (department_id = get_user_department(auth.uid()));

CREATE POLICY "Insert events in dept" ON public.indicator_events FOR INSERT TO authenticated
  WITH CHECK (department_id = get_user_department(auth.uid()));

CREATE POLICY "Auditors manage events" ON public.indicator_events FOR ALL TO authenticated
  USING (department_id = get_user_department(auth.uid()) AND is_auditor_or_admin(auth.uid()))
  WITH CHECK (department_id = get_user_department(auth.uid()) AND is_auditor_or_admin(auth.uid()));

CREATE TRIGGER update_indicator_events_updated_at
  BEFORE UPDATE ON public.indicator_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: bundle_alerts
CREATE TABLE public.bundle_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.indicator_events(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  subtype_id UUID REFERENCES public.indicator_subtypes(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  ward_id UUID REFERENCES public.wards(id) ON DELETE SET NULL,
  failed_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  severity TEXT NOT NULL DEFAULT 'warning',
  message TEXT NOT NULL,
  notified_users JSONB DEFAULT '[]'::jsonb,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bundle_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View alerts in dept" ON public.bundle_alerts FOR SELECT TO authenticated
  USING (department_id = get_user_department(auth.uid()));

CREATE POLICY "Resolve alerts in dept" ON public.bundle_alerts FOR UPDATE TO authenticated
  USING (department_id = get_user_department(auth.uid()));

CREATE POLICY "Admins manage alerts" ON public.bundle_alerts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Enable Realtime for bundle_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.bundle_alerts;

-- Add subtype_id to indicator_values
ALTER TABLE public.indicator_values ADD COLUMN subtype_id UUID REFERENCES public.indicator_subtypes(id) ON DELETE SET NULL;
