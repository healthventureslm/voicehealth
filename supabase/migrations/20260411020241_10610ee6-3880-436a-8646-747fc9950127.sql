
-- 1. Add current_ward_id and admission_status to patients
ALTER TABLE public.patients
  ADD COLUMN current_ward_id uuid REFERENCES public.wards(id),
  ADD COLUMN admission_status text NOT NULL DEFAULT 'internado';

-- 2. Create patient_ward_history
CREATE TABLE public.patient_ward_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  ward_id uuid NOT NULL REFERENCES public.wards(id),
  admitted_at timestamptz NOT NULL DEFAULT now(),
  discharged_at timestamptz,
  discharged_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_ward_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View history in dept" ON public.patient_ward_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.patients p WHERE p.id = patient_ward_history.patient_id
    AND p.department_id = get_user_department(auth.uid())
  ));

CREATE POLICY "Insert history in dept" ON public.patient_ward_history
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.patients p WHERE p.id = patient_ward_history.patient_id
    AND p.department_id = get_user_department(auth.uid())
  ));

CREATE POLICY "Update history in dept" ON public.patient_ward_history
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.patients p WHERE p.id = patient_ward_history.patient_id
    AND p.department_id = get_user_department(auth.uid())
  ));

CREATE POLICY "Admins manage history" ON public.patient_ward_history
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 3. Add professional_role to profiles
ALTER TABLE public.profiles ADD COLUMN professional_role text;

-- 4. Add hospital_name to departments
ALTER TABLE public.departments ADD COLUMN hospital_name text;

-- 5. Add ward_id to consultations
ALTER TABLE public.consultations ADD COLUMN ward_id uuid REFERENCES public.wards(id);

-- Index for performance
CREATE INDEX idx_patient_ward_history_patient ON public.patient_ward_history(patient_id);
CREATE INDEX idx_patients_current_ward ON public.patients(current_ward_id);
CREATE INDEX idx_consultations_ward ON public.consultations(ward_id);
