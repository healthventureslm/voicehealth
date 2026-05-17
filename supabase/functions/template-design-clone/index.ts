// Clona o display_layout visual de um template-fonte adaptando os placeholders
// pros field ids do template-alvo. Mantém: header, footer, faixas de seção,
// fontes, cores. Substitui: placeholders de campos da seção do body que não
// existem no target schema.
//
// Recebe: { source_layout, target_schema, hint? }
// Retorna: { success, display_layout }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiCompleteJson } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `Você recebe um display_layout JSON (árvore react-pdf) de um template FONTE
e o schema de um template ALVO. Sua tarefa: produzir um NOVO display_layout que:

1. PRESERVE o "shell visual" do fonte:
   - Cabeçalho do documento (logo, faixa cinza do paciente, título)
   - Rodapé (assinatura profissional, COREN, página)
   - Estilo das faixas de seção (cor de fundo, fonte do título, padding)
   - Tipografia (fontFamily, fontSize, fontWeight)
   - Paleta de cores
   - Margens e spacing geral
   - Estrutura de View hierárquica

2. ADAPTE o BODY (área de conteúdo) pros campos do schema alvo:
   - Substitua seções e fields do source pelos do target
   - Use os ids do target schema nos placeholders {{secao_id.field_id}}
   - Mantenha estilo das seções (mesma faixa cinza, mesma tipografia)
   - Pra multi_checkbox: replicar grid de Checkbox com whenContains
   - Pra radio: Checkbox com equals
   - Pra table: Each loop
   - Pra text/number/etc: Text simples

3. MANTENHA placeholders de metadata identicos (não trocar pelos do schema):
   - {{_patient.full_name}}, {{_patient.bed}}, etc. — sempre iguais
   - {{_hospital.logo_url}}, {{_hospital.name}} — sempre iguais
   - {{_ward.name}}, {{_consultation.created_display}}, {{_professional.*}}

═══ FORMATO LayoutNode ═══

(igual ao template-design-from-document — Document/Page/View/Text/Image/Each/If/Checkbox)

═══ REGRA CRÍTICA ═══

Devolva APENAS o JSON do novo display_layout. Sem markdown fences. Nó raiz = Document.`;

interface CloneRequest {
  source_layout: Record<string, unknown>;
  target_schema: Record<string, unknown>;
  hint?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as CloneRequest;
    if (!body.source_layout || !body.target_schema) {
      return json({ error: "source_layout e target_schema são obrigatórios" }, 400);
    }

    const sourceJson = JSON.stringify(body.source_layout, null, 2);
    const targetSummary = summarizeSchema(body.target_schema);

    const userText = `═══ LAYOUT FONTE (preservar shell visual) ═══

\`\`\`json
${sourceJson}
\`\`\`

═══ SCHEMA ALVO (adaptar body pra estes ids) ═══

\`\`\`
${targetSummary}
\`\`\`

${body.hint?.trim() ? `Dica: ${body.hint.trim()}\n\n` : ""}Gere o display_layout adaptado.`;

    const { content } = await aiCompleteJson({
      model: "google/gemini-2.5-pro",
      maxOutputTokens: 32768,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
    });

    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("[template-design-clone] JSON inválido:", cleaned.slice(0, 500));
      return json(
        {
          error: "IA retornou JSON malformado. Tente novamente.",
          raw: cleaned.slice(0, 2000),
        },
        502,
      );
    }

    const obj = parsed as Record<string, unknown>;
    if (obj.type !== "Document") {
      return json(
        { error: "Layout sem nó raiz Document", raw: obj },
        502,
      );
    }

    return json({ success: true, display_layout: obj });
  } catch (e: any) {
    console.error("template-design-clone error:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function summarizeSchema(schema: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`Template: ${schema.name ?? ""}`);
  const sections = Array.isArray(schema.sections) ? schema.sections : [];
  for (const section of sections as Record<string, unknown>[]) {
    lines.push(`\n## ${section.id} — ${section.title ?? ""}`);
    const fields = Array.isArray(section.fields) ? section.fields : [];
    for (const field of fields as Record<string, unknown>[]) {
      const type = field.type as string;
      let extra = "";
      if (Array.isArray(field.options)) {
        const opts = (field.options as Record<string, unknown>[])
          .map((o) => o.value)
          .slice(0, 6)
          .join("|");
        extra = ` [${opts}${field.options.length > 6 ? "..." : ""}]`;
      }
      lines.push(`- ${section.id}.${field.id} (${type})${extra}`);
    }
  }
  return lines.join("\n");
}
