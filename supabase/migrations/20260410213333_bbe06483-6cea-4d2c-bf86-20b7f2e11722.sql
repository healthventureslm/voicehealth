
-- Fix profiles INSERT policy: only allow inserting own profile
DROP POLICY "System can insert profiles" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Fix clinical alerts INSERT policy: restrict to consultation owner
DROP POLICY "System can insert alerts" ON public.clinical_alerts;
CREATE POLICY "Users can insert alerts for their consultations" ON public.clinical_alerts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.consultations c WHERE c.id = consultation_id AND c.professional_id = auth.uid()));
