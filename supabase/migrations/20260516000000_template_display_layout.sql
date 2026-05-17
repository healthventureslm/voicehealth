-- Suporte a design fiel via react-pdf: cada template pode opcionalmente
-- ter uma display_layout (árvore JSON de nós do react-pdf — Document,
-- Page, View, Text, etc) que substitui o exportador markdown default
-- quando gerar PDF.
--
-- Quando display_layout é NULL, mantém o fluxo atual (jsPDF + markdown
-- derivado do schema).

ALTER TABLE public.report_templates
  ADD COLUMN IF NOT EXISTS display_layout JSONB;

COMMENT ON COLUMN public.report_templates.display_layout IS
  'Árvore declarativa de nós react-pdf pra renderização fiel do PDF. '
  'Cada nó: { type: "Document"|"Page"|"View"|"Text"|"Image"|"Each"|"If", '
  'style?, children?, src?, bind?, equals? }. '
  'Strings podem ter placeholders Mustache {{path.to.value}} resolvidos '
  'contra filled_data. NULL = usar fluxo markdown→jsPDF default.';

CREATE INDEX IF NOT EXISTS idx_report_templates_display_layout_gin
  ON public.report_templates USING GIN (display_layout);
