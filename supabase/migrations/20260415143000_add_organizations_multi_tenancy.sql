-- P1: Multi-tenancy — add organizations table and link departments to organizations
-- This enables multiple hospitals to use the same instance with data isolation

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add organization_id to departments
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS hospital_name TEXT;

-- 3. Add organization_id to core tables for direct filtering
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.clinical_reports
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.report_templates
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- 4. Create default organization for existing data
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Hospital Default', 'default')
ON CONFLICT (slug) DO NOTHING;

-- 5. Backfill existing records with default organization
UPDATE public.departments SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.consultations SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.patients SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.clinical_reports SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.report_templates SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_departments_org ON public.departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_consultations_org ON public.consultations(organization_id);
CREATE INDEX IF NOT EXISTS idx_patients_org ON public.patients(organization_id);
CREATE INDEX IF NOT EXISTS idx_clinical_reports_org ON public.clinical_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_org ON public.report_templates(organization_id);

-- 7. RLS policies for organization-level isolation
-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own organization
CREATE POLICY "Users see own organization" ON public.organizations
  FOR SELECT USING (
    id IN (
      SELECT d.organization_id FROM public.departments d
      JOIN public.profiles p ON p.department_id = d.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Update existing department policies to include org check
-- (existing RLS on departments already filters by department_id via profiles)

-- Add org-level RLS to consultations (supplements existing department RLS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Consultations org isolation' AND tablename = 'consultations'
  ) THEN
    CREATE POLICY "Consultations org isolation" ON public.consultations
      FOR ALL USING (
        organization_id IN (
          SELECT d.organization_id FROM public.departments d
          JOIN public.profiles p ON p.department_id = d.id
          WHERE p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Add org-level RLS to patients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Patients org isolation' AND tablename = 'patients'
  ) THEN
    CREATE POLICY "Patients org isolation" ON public.patients
      FOR ALL USING (
        organization_id IN (
          SELECT d.organization_id FROM public.departments d
          JOIN public.profiles p ON p.department_id = d.id
          WHERE p.user_id = auth.uid()
        )
      );
  END IF;
END $$;
