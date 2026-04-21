
-- Helper function
CREATE OR REPLACE FUNCTION public.is_auditor_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'auditor')
  )
$$;

-- wards
CREATE TABLE public.wards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  ward_type text NOT NULL DEFAULT 'enfermaria',
  bed_count integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage wards" ON public.wards FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view wards in dept" ON public.wards FOR SELECT TO authenticated
  USING (department_id = get_user_department(auth.uid()));
CREATE TRIGGER update_wards_updated_at BEFORE UPDATE ON public.wards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ipsg_goals
CREATE TABLE public.ipsg_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  edition text NOT NULL DEFAULT '8th',
  target_value numeric,
  warning_threshold numeric,
  critical_threshold numeric,
  unit text NOT NULL DEFAULT '%',
  is_active boolean NOT NULL DEFAULT true,
  is_customizable boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ipsg_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View goals" ON public.ipsg_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage goals" ON public.ipsg_goals FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_ipsg_goals_updated_at BEFORE UPDATE ON public.ipsg_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ipsg_audit_checklists
CREATE TABLE public.ipsg_audit_checklists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ipsg_goal_id uuid NOT NULL REFERENCES public.ipsg_goals(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  frequency text NOT NULL DEFAULT 'daily',
  applicable_ward_types text[] DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ipsg_audit_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View checklists" ON public.ipsg_audit_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage checklists" ON public.ipsg_audit_checklists FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_checklists_updated_at BEFORE UPDATE ON public.ipsg_audit_checklists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ipsg_audit_records
CREATE TABLE public.ipsg_audit_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id uuid REFERENCES public.ipsg_audit_checklists(id) ON DELETE SET NULL,
  ipsg_goal_id uuid NOT NULL REFERENCES public.ipsg_goals(id) ON DELETE CASCADE,
  ward_id uuid REFERENCES public.wards(id) ON DELETE SET NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  auditor_id uuid NOT NULL,
  audit_date date NOT NULL DEFAULT CURRENT_DATE,
  responses jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_items integer NOT NULL DEFAULT 0,
  conforming_items integer NOT NULL DEFAULT 0,
  conformity_rate numeric GENERATED ALWAYS AS (
    CASE WHEN total_items > 0 THEN ROUND((conforming_items::numeric / total_items) * 100, 2) ELSE 0 END
  ) STORED,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ipsg_audit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View audits in dept" ON public.ipsg_audit_records FOR SELECT TO authenticated
  USING (department_id = get_user_department(auth.uid()));
CREATE POLICY "Auditors insert audits" ON public.ipsg_audit_records FOR INSERT TO authenticated
  WITH CHECK (department_id = get_user_department(auth.uid()) AND is_auditor_or_admin(auth.uid()));
CREATE POLICY "Auditors update audits" ON public.ipsg_audit_records FOR UPDATE TO authenticated
  USING (department_id = get_user_department(auth.uid()) AND is_auditor_or_admin(auth.uid()));
CREATE POLICY "Nurses insert audits" ON public.ipsg_audit_records FOR INSERT TO authenticated
  WITH CHECK (department_id = get_user_department(auth.uid()) AND (has_role(auth.uid(), 'enfermeiro') OR has_role(auth.uid(), 'tecnico')));
CREATE TRIGGER update_audit_records_updated_at BEFORE UPDATE ON public.ipsg_audit_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER PUBLICATION supabase_realtime ADD TABLE public.ipsg_audit_records;

-- ipsg_events
CREATE TABLE public.ipsg_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ipsg_goal_id uuid NOT NULL REFERENCES public.ipsg_goals(id) ON DELETE CASCADE,
  ward_id uuid REFERENCES public.wards(id) ON DELETE SET NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  is_conforming boolean NOT NULL DEFAULT true,
  details jsonb DEFAULT '{}'::jsonb,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ipsg_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View events in dept" ON public.ipsg_events FOR SELECT TO authenticated
  USING (department_id = get_user_department(auth.uid()));
CREATE POLICY "Insert events in dept" ON public.ipsg_events FOR INSERT TO authenticated
  WITH CHECK (department_id = get_user_department(auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE public.ipsg_events;

-- ipsg_action_plans
CREATE TABLE public.ipsg_action_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ipsg_goal_id uuid NOT NULL REFERENCES public.ipsg_goals(id) ON DELETE CASCADE,
  audit_record_id uuid REFERENCES public.ipsg_audit_records(id) ON DELETE SET NULL,
  ward_id uuid REFERENCES public.wards(id) ON DELETE SET NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  responsible_id uuid,
  due_date date,
  status text NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ipsg_action_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View plans in dept" ON public.ipsg_action_plans FOR SELECT TO authenticated
  USING (department_id = get_user_department(auth.uid()));
CREATE POLICY "Auditors manage plans" ON public.ipsg_action_plans FOR ALL TO authenticated
  USING (department_id = get_user_department(auth.uid()) AND is_auditor_or_admin(auth.uid()))
  WITH CHECK (department_id = get_user_department(auth.uid()) AND is_auditor_or_admin(auth.uid()));
CREATE TRIGGER update_action_plans_updated_at BEFORE UPDATE ON public.ipsg_action_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- high_alert_medications
CREATE TABLE public.high_alert_medications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  category text,
  risk_level text NOT NULL DEFAULT 'high',
  storage_requirements text,
  lasa_pairs jsonb DEFAULT '[]'::jsonb,
  last_review_date date,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.high_alert_medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View medications" ON public.high_alert_medications FOR SELECT TO authenticated
  USING ((department_id IS NULL) OR (department_id = get_user_department(auth.uid())));
CREATE POLICY "Admins manage medications" ON public.high_alert_medications FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_medications_updated_at BEFORE UPDATE ON public.high_alert_medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- surgical_checklists
CREATE TABLE public.surgical_checklists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_id uuid REFERENCES public.consultations(id) ON DELETE SET NULL,
  ward_id uuid REFERENCES public.wards(id) ON DELETE SET NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  pre_op_verification jsonb DEFAULT '{}'::jsonb,
  site_marking jsonb DEFAULT '{}'::jsonb,
  first_timeout jsonb DEFAULT '{}'::jsonb,
  second_timeout jsonb DEFAULT '{}'::jsonb,
  sign_out jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.surgical_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View surgical checklists in dept" ON public.surgical_checklists FOR SELECT TO authenticated
  USING (department_id = get_user_department(auth.uid()));
CREATE POLICY "Insert surgical checklists" ON public.surgical_checklists FOR INSERT TO authenticated
  WITH CHECK (department_id = get_user_department(auth.uid()));
CREATE POLICY "Update surgical checklists" ON public.surgical_checklists FOR UPDATE TO authenticated
  USING (department_id = get_user_department(auth.uid()));
CREATE TRIGGER update_surgical_checklists_updated_at BEFORE UPDATE ON public.surgical_checklists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- infection_surveillance
CREATE TABLE public.infection_surveillance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ward_id uuid REFERENCES public.wards(id) ON DELETE SET NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  infection_type text NOT NULL,
  device_type text,
  onset_date date NOT NULL DEFAULT CURRENT_DATE,
  organism text,
  is_device_related boolean NOT NULL DEFAULT false,
  bundle_compliance jsonb DEFAULT '{}'::jsonb,
  notes text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.infection_surveillance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View infections in dept" ON public.infection_surveillance FOR SELECT TO authenticated
  USING (department_id = get_user_department(auth.uid()));
CREATE POLICY "Insert infections" ON public.infection_surveillance FOR INSERT TO authenticated
  WITH CHECK (department_id = get_user_department(auth.uid()));
CREATE POLICY "Auditors manage infections" ON public.infection_surveillance FOR ALL TO authenticated
  USING (department_id = get_user_department(auth.uid()) AND is_auditor_or_admin(auth.uid()))
  WITH CHECK (department_id = get_user_department(auth.uid()) AND is_auditor_or_admin(auth.uid()));
CREATE TRIGGER update_infections_updated_at BEFORE UPDATE ON public.infection_surveillance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed IPSG goals
INSERT INTO public.ipsg_goals (code, name, description, target_value, warning_threshold, critical_threshold, unit, sort_order) VALUES
  ('IPSG.1', 'Identificação Correta do Paciente', 'Garantir que o paciente correto receba o procedimento ou tratamento correto, usando pelo menos dois identificadores.', 95, 90, 80, '%', 1),
  ('IPSG.2', 'Comunicação Efetiva', 'Melhorar a efetividade da comunicação entre profissionais de saúde, incluindo SBAR, read-back e handoff estruturado.', 90, 85, 75, '%', 2),
  ('IPSG.3', 'Segurança de Medicamentos de Alto Alerta', 'Melhorar a segurança no uso de medicamentos de alto alerta, incluindo gestão LASA e dupla checagem.', 95, 90, 80, '%', 3),
  ('IPSG.4', 'Cirurgia Segura', 'Garantir cirurgia no local correto, procedimento correto e paciente correto (Universal Protocol com duplo time-out).', 100, 95, 90, '%', 4),
  ('IPSG.5', 'Redução do Risco de Infecções', 'Reduzir o risco de infecções associadas aos cuidados de saúde, incluindo higiene das mãos e bundles de prevenção.', 80, 70, 60, '%', 5),
  ('QUEDAS', 'Prevenção de Quedas', 'Reduzir o risco de danos ao paciente resultantes de quedas (AOP.02.00 na 8ª edição JCI).', 2, 3, 5, 'por 1000 pac-dia', 6);

-- Indexes
CREATE INDEX idx_wards_department ON public.wards(department_id);
CREATE INDEX idx_audit_records_dept ON public.ipsg_audit_records(department_id);
CREATE INDEX idx_audit_records_goal ON public.ipsg_audit_records(ipsg_goal_id);
CREATE INDEX idx_audit_records_date ON public.ipsg_audit_records(audit_date);
CREATE INDEX idx_events_dept ON public.ipsg_events(department_id);
CREATE INDEX idx_events_goal ON public.ipsg_events(ipsg_goal_id);
CREATE INDEX idx_events_created ON public.ipsg_events(created_at);
CREATE INDEX idx_action_plans_dept ON public.ipsg_action_plans(department_id);
CREATE INDEX idx_action_plans_status ON public.ipsg_action_plans(status);
CREATE INDEX idx_infections_dept ON public.infection_surveillance(department_id);
