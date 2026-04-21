
-- 1. Create medical_specialties table
CREATE TABLE public.medical_specialties (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  output_prompt text NOT NULL DEFAULT '',
  prompt_variables jsonb DEFAULT '[]'::jsonb,
  icon text DEFAULT 'Stethoscope',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_specialties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage specialties"
  ON public.medical_specialties FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view active specialties"
  ON public.medical_specialties FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE TRIGGER update_medical_specialties_updated_at
  BEFORE UPDATE ON public.medical_specialties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Create knowledge_documents table
CREATE TABLE public.knowledge_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  source text NOT NULL DEFAULT 'custom',
  content text NOT NULL DEFAULT '',
  chunks jsonb DEFAULT '[]'::jsonb,
  category text,
  specialty_id uuid REFERENCES public.medical_specialties(id) ON DELETE SET NULL,
  uploaded_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  search_vector tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage knowledge documents"
  ON public.knowledge_documents FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view active knowledge documents"
  ON public.knowledge_documents FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE INDEX idx_knowledge_documents_search ON public.knowledge_documents USING GIN(search_vector);
CREATE INDEX idx_knowledge_documents_specialty ON public.knowledge_documents(specialty_id);

CREATE TRIGGER update_knowledge_documents_updated_at
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION public.update_knowledge_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_knowledge_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, content ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_knowledge_search_vector();

-- 3. Add specialty_id to consultations
ALTER TABLE public.consultations
  ADD COLUMN specialty_id uuid REFERENCES public.medical_specialties(id) ON DELETE SET NULL;
