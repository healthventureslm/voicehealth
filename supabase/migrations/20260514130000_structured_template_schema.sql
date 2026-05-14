-- Fase 2 do sistema de templates estruturados.
--
-- Adiciona duas colunas JSONB nullable pra coexistência com o modo markdown
-- legado: templates antigos seguem usando `prompt`; templates novos populam
-- `schema` e a IA devolve JSON validado em `filled_data`.
--
-- A migração não toca em nenhum template existente — todos continuam
-- funcionando idênticos enquanto a feature é implementada.

ALTER TABLE public.report_templates
  ADD COLUMN IF NOT EXISTS schema JSONB;

COMMENT ON COLUMN public.report_templates.schema IS
  'Schema estruturado do template (TemplateSchema em src/templates/types.ts). '
  'Quando preenchido, a geração usa modo estruturado: IA devolve JSON validado '
  'em vez de markdown livre. Quando NULL, fallback para o campo `prompt` (legacy).';

ALTER TABLE public.clinical_reports
  ADD COLUMN IF NOT EXISTS filled_data JSONB;

COMMENT ON COLUMN public.clinical_reports.filled_data IS
  'Resposta estruturada da IA preenchendo o schema do template. '
  'Convive com `content` (markdown): no modo estruturado, content é derivado '
  'do filled_data pra exportação PDF.';

-- Índice GIN pra queries que precisam buscar por chaves dentro do schema
-- (ex: listar templates que usam um determinado tipo de campo).
CREATE INDEX IF NOT EXISTS idx_report_templates_schema_gin
  ON public.report_templates USING GIN (schema);

CREATE INDEX IF NOT EXISTS idx_clinical_reports_filled_data_gin
  ON public.clinical_reports USING GIN (filled_data);
