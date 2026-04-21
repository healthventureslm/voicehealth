-- Adiciona número do atendimento à tabela de pacientes
-- date_of_birth já existe no schema original; encounter_number é campo novo
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS encounter_number TEXT;
