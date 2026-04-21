
CREATE TABLE public.prompt_wizard_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  context_type TEXT NOT NULL DEFAULT 'template',
  context_name TEXT,
  context_description TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'in_progress',
  question_number INTEGER NOT NULL DEFAULT 0,
  generated_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.prompt_wizard_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
ON public.prompt_wizard_sessions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create own sessions"
ON public.prompt_wizard_sessions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
ON public.prompt_wizard_sessions FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
ON public.prompt_wizard_sessions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_prompt_wizard_sessions_updated_at
BEFORE UPDATE ON public.prompt_wizard_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
