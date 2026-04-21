
ALTER TABLE public.indicators
  ADD COLUMN IF NOT EXISTS auto_source text,
  ADD COLUMN IF NOT EXISTS auto_numerator_filter jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_denominator_filter jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_enabled boolean NOT NULL DEFAULT false;
