ALTER TABLE public.indicators
ADD COLUMN IF NOT EXISTS auto_operation text NOT NULL DEFAULT 'count',
ADD COLUMN IF NOT EXISTS auto_agg_column text;