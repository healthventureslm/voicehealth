// Gera display_layout (árvore react-pdf) a partir de uma imagem/PDF do
// documento clínico alvo + o schema do template.
//
// Diferente do template-schema-from-document (que extrai a estrutura
// SEMÂNTICA dos campos), aqui o foco é a APRESENTAÇÃO VISUAL — header,
// faixas, cores, posicionamento, tipografia.
//
// Recebe: { file_base64, mime_type, schema, hint? }
// Retorna: { success, display_layout: LayoutNode }

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

const SYSTEM_PROMPT = `Você é um especialista em transformar documentos clínicos em papel num layout
declarativo react-pdf (JSON). Recebe uma foto/PDF do documento alvo + o schema do
template (que define os campos disponíveis pra preencher).

═══ FORMATO DE OUTPUT ═══

Devolva APENAS um JSON com estrutura LayoutNode. Sem code fences, sem explicação.
Nó raiz = Document. Dentro dele uma ou mais Page. Dentro de cada Page, View hierarchies.

Tipos de nó:
- { "type": "Document", "children": [Page, ...] }
- { "type": "Page", "size": "A4", "style": {...}, "children": [...] }
- { "type": "View", "style": {...}, "children": [...] }
- { "type": "Text", "style": {...}, "children": "texto com {{placeholder}}" | [Text aninhado pra estilo inline] }
- { "type": "Image", "src": "{{_hospital.logo_url}}", "style": {...} }
- { "type": "Each", "bind": "secao.lista", "itemAs": "item", "children": [...], "empty": [...]? }
- { "type": "If", "when": { "bind": "x.y", "equals": "Z" }, "children": [...], "otherwise": [...]? }
- { "type": "Checkbox", "bind": "secao.campo", "label": "Texto da opção", "equals": "valor" | "whenContains": "valor" }

Estilos react-pdf (Yoga flexbox + CSS subset). Exemplos válidos:
{
  "padding": 30, "paddingHorizontal": 36, "marginTop": 8, "marginBottom": 12,
  "flexDirection": "row" | "column", "flexWrap": "wrap", "gap": 6,
  "justifyContent": "space-between", "alignItems": "center",
  "fontSize": 9, "fontWeight": "bold" | "normal", "fontStyle": "italic",
  "color": "#222", "backgroundColor": "#e6e6e6",
  "borderWidth": 0.5, "borderColor": "#999", "borderBottomWidth": 1,
  "width": "50%" | 100, "minHeight": 20
}

⚠️ Não use propriedades CSS NÃO suportadas pelo react-pdf:
- ❌ display:grid, box-shadow, transform, transition, ::pseudo-selectors
- ✅ use flexDirection + width pra criar colunas/grids

═══ VARIÁVEIS DE CONTEXTO DISPONÍVEIS (use placeholders Mustache) ═══

Dados estruturados preenchidos pela IA (do schema do template):
- {{secao_id.campo_id}}  — qualquer field do schema. Ex: {{perfil.idade}}, {{sinais_vitais.pa_sistolica}}
- O schema é passado abaixo — replicar os ids exatos.

Metadados sempre disponíveis (NÃO INVENTAR, usar exatos):
- {{_patient.full_name}}, {{_patient.social_name}}, {{_patient.medical_record}},
  {{_patient.registration}}, {{_patient.matricula}}, {{_patient.bed}}, {{_patient.cpf}},
  {{_patient.birth_display}} (DD/MM/YYYY), {{_patient.age_display}} (ex: "79a 1m 7d"),
  {{_patient.sex}}, {{_patient.plan}}, {{_patient.attendance_type}}
- {{_hospital.name}}, {{_hospital.logo_url}}
- {{_ward.name}}
- {{_consultation.created_display}} (DD/MM/YYYY HH:mm), {{_consultation.completed_display}}
- {{_professional.full_name}}, {{_professional.registration}}
- {{_now_display}} (data/hora atual)

═══ REGRAS CRÍTICAS ═══

1) NUNCA HARDCODE dados do paciente exemplo que aparecem na foto.
   ❌ "Registro Civil: Maria Edith de Souza Godoy"
   ✅ "Registro Civil: {{_patient.full_name}}"

   ❌ "Idade: 79a 1m 7d"
   ✅ "Idade: {{_patient.age_display}}"

   ❌ "Leito: UG230"
   ✅ "Leito: {{_patient.bed}}"

2) Pra campos da seção do template, use o id do campo conforme o schema fornecido.
   Se schema tem secao "perfil" com field "idade":
   ✅ "{{perfil.idade}}"

3) Pra listas/tabelas (table fields), use Each com itemAs:
   {
     "type": "Each", "bind": "precaucoes.lista_precaucoes", "itemAs": "p",
     "children": [
       { "type": "View", "style": {"flexDirection": "row", "gap": 8},
         "children": [
           { "type": "Text", "children": "{{p.tipo}}" },
           { "type": "Text", "children": "{{p.motivo}}" }
         ]
       }
     ]
   }

4) Pra multi_checkbox renderizar como grid de checkboxes (tipo HPP):
   Use múltiplos { "type": "Checkbox", "bind": "secao.condicoes", "whenContains": "HAS", "label": "HAS" } lado a lado.
   Disponha em colunas com flexDirection: "row" + flexWrap: "wrap" + width: "33%" pra cada item.

5) Pra radio fields, use Checkbox com equals:
   { "type": "Checkbox", "bind": "secao.campo", "equals": "VALOR_A", "label": "Opção A" }

6) HEADER do documento (faixa cinza com dados do paciente) — replique fielmente
   se o doc original tiver. Use _patient/_hospital/_ward/_consultation. NÃO INVENTAR.

7) FOOTER — se o doc tem rodapé com profissional/COREN/data impressão, replique
   com {{_professional.full_name}}, {{_professional.registration}}, {{_now_display}}.

8) Replicar fielmente: cores, espaçamentos, alinhamentos, fontes (use fontSize numérico),
   bordas, faixas de seção. Quanto mais próximo do visual original, melhor.

9) Bordas e fontes do react-pdf:
   - Fonts disponíveis no react-pdf: Helvetica (default), Times-Roman, Courier
   - Para Helvetica bold: fontFamily: "Helvetica-Bold" OU style.fontWeight: "bold"
   - Use fontSize entre 7 e 14 pt pra texto, 10-16 pt pra títulos

═══ OUTPUT ═══

JSON puro, sem markdown fences. Comece direto com '{'.`;

interface GenerateRequest {
  file_base64: string;
  mime_type: string;
  schema: Record<string, unknown>;
  hint?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as GenerateRequest;
    if (!body.file_base64 || !body.mime_type || !body.schema) {
      return json({ error: "file_base64, mime_type e schema são obrigatórios" }, 400);
    }

    const approxBytes = (body.file_base64.length * 3) / 4;
    if (approxBytes > 10 * 1024 * 1024) {
      return json({ error: "Arquivo muito grande (limite ~10MB)" }, 413);
    }

    // Resumo do schema pra IA — só ids e estrutura, não as opções todas (economiza tokens)
    const schemaSummary = summarizeSchema(body.schema);

    const dataUrl = `data:${body.mime_type};base64,${body.file_base64}`;
    const userText = `Schema do template (use estes ids nos placeholders):
\`\`\`
${schemaSummary}
\`\`\`

${body.hint?.trim() ? `Dica adicional: ${body.hint.trim()}\n\n` : ""}Gere o display_layout JSON replicando fielmente o layout visual do documento anexo.`;

    const { content } = await aiCompleteJson({
      model: "google/gemini-2.5-pro",
      // Layout JSON pra docs grandes (Histórico ~10 seções) facilmente
      // passa de 8k tokens. Default trunca silenciosamente.
      maxOutputTokens: 32768,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
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
      console.error("[template-design-from-document] JSON inválido:", cleaned.slice(0, 500));
      return json(
        {
          error: "IA retornou JSON malformado. Tente outro arquivo.",
          raw: cleaned.slice(0, 2000),
        },
        502,
      );
    }

    const obj = parsed as Record<string, unknown>;
    if (obj.type !== "Document" || !Array.isArray(obj.children)) {
      return json(
        { error: "Layout sem nó raiz Document válido", raw: obj },
        502,
      );
    }

    return json({ success: true, display_layout: obj });
  } catch (e: any) {
    console.error("template-design-from-document error:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

// Compacta o schema em texto curto pra IA: lista seções + ids dos fields.
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
      } else if (Array.isArray(field.items)) {
        extra = ` [${field.items.length} items]`;
      } else if (Array.isArray(field.columns)) {
        const cols = (field.columns as Record<string, unknown>[]).map((c) => c.id).join(",");
        extra = ` columns=[${cols}]`;
      }
      lines.push(`- ${section.id}.${field.id} (${type})${extra}`);
    }
  }
  return lines.join("\n");
}
