-- Limpeza total dos templates pra recomeçar do zero.
--
-- Preserva clinical_reports e consultations já gerados, só desliga a
-- referência via template_id. Reports antigos continuam consultáveis
-- via content/filled_data; só perdem o vínculo com o template que os
-- gerou.
--
-- IRREVERSÍVEL: depois de rodar isso, todos os templates somem do
-- picker. Crie novos antes de gravar consultas.

BEGIN;

-- 1. Desliga referências em clinical_reports (FK template_id).
UPDATE public.clinical_reports
SET template_id = NULL
WHERE template_id IS NOT NULL;

-- 2. Desliga referências em consultations (FK template_id).
UPDATE public.consultations
SET template_id = NULL
WHERE template_id IS NOT NULL;

-- 3. Apaga TODOS os report_templates.
DELETE FROM public.report_templates;

COMMIT;
