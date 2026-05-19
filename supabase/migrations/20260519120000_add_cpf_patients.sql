-- Adiciona CPF ao cadastro de pacientes.
-- Armazenado como 11 dígitos (somente números). Único por hospital quando preenchido.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS cpf text;

ALTER TABLE public.patients
  ADD CONSTRAINT patients_cpf_digits_chk
  CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$');

CREATE UNIQUE INDEX IF NOT EXISTS patients_hospital_cpf_uniq
  ON public.patients (hospital_id, cpf)
  WHERE cpf IS NOT NULL AND deleted_at IS NULL;
