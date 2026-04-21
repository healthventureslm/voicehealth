
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS professional_registry text,
  ADD COLUMN IF NOT EXISTS professional_registry_type text,
  ADD COLUMN IF NOT EXISTS digital_signature_enabled boolean NOT NULL DEFAULT false;
