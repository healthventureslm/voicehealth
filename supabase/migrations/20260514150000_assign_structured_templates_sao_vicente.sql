-- Associa os 2 templates estruturados (seedados como globais no
-- 20260514130500) ao hospital Clínica São Vicente, pra que os
-- profissionais de lá possam vê-los e usá-los no picker.
--
-- Idempotente: só atualiza templates que ainda estão globais
-- (hospital_id IS NULL). Se o hospital não for encontrado, falha
-- explicitamente em vez de silenciosamente deixar como global.

DO $$
DECLARE
  v_hospital_id uuid;
BEGIN
  SELECT id INTO v_hospital_id
  FROM public.hospitals
  WHERE name ILIKE '%São Vicente%' OR name ILIKE '%Sao Vicente%'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_hospital_id IS NULL THEN
    RAISE EXCEPTION 'Hospital "Clínica São Vicente" não encontrado em public.hospitals';
  END IF;

  UPDATE public.report_templates
  SET hospital_id = v_hospital_id
  WHERE hospital_id IS NULL
    AND name IN (
      'Evolução de Enfermagem',
      'Transição de Cuidado SBAR (Enfermagem)'
    );
END $$;
