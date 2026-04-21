
-- Indicators definitions table
CREATE TABLE public.indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT NOT NULL DEFAULT '%',
  calc_type TEXT NOT NULL DEFAULT 'percentage', -- percentage, absolute, average
  numerator_label TEXT NOT NULL DEFAULT 'Numerador',
  denominator_label TEXT NOT NULL DEFAULT 'Denominador',
  formula_description TEXT, -- human-readable formula description
  target_value NUMERIC,
  warning_threshold NUMERIC, -- yellow zone threshold (percentage of target)
  critical_threshold NUMERIC, -- red zone threshold (percentage of target)
  frequency TEXT NOT NULL DEFAULT 'monthly', -- daily, weekly, monthly
  department_id UUID REFERENCES public.departments(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false, -- pre-defined system indicators
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage indicators"
ON public.indicators FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view active indicators"
ON public.indicators FOR SELECT TO authenticated
USING (is_active AND (department_id IS NULL OR department_id = get_user_department(auth.uid())));

CREATE TRIGGER update_indicators_updated_at
BEFORE UPDATE ON public.indicators
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indicator values (recorded data points)
CREATE TABLE public.indicator_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  numerator_value NUMERIC NOT NULL DEFAULT 0,
  denominator_value NUMERIC NOT NULL DEFAULT 0,
  calculated_value NUMERIC,
  source TEXT NOT NULL DEFAULT 'manual', -- manual, automatic
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(indicator_id, department_id, period_start, period_end)
);

ALTER TABLE public.indicator_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage indicator values"
ON public.indicator_values FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view indicator values in their department"
ON public.indicator_values FOR SELECT TO authenticated
USING (department_id = get_user_department(auth.uid()));

CREATE POLICY "Users can insert indicator values in their department"
ON public.indicator_values FOR INSERT TO authenticated
WITH CHECK (department_id = get_user_department(auth.uid()));

CREATE TRIGGER update_indicator_values_updated_at
BEFORE UPDATE ON public.indicator_values
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indicator alerts (traffic light alerts)
CREATE TABLE public.indicator_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  indicator_value_id UUID REFERENCES public.indicator_values(id) ON DELETE SET NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  severity TEXT NOT NULL DEFAULT 'green', -- green, yellow, red
  message TEXT NOT NULL,
  current_value NUMERIC,
  target_value NUMERIC,
  is_read BOOLEAN NOT NULL DEFAULT false,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.indicator_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage indicator alerts"
ON public.indicator_alerts FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view alerts in their department"
ON public.indicator_alerts FOR SELECT TO authenticated
USING (department_id = get_user_department(auth.uid()));

CREATE POLICY "Users can mark alerts as read"
ON public.indicator_alerts FOR UPDATE TO authenticated
USING (department_id = get_user_department(auth.uid()));
