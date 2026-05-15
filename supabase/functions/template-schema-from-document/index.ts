// Extrai um TemplateSchema estruturado a partir de PDF/imagem de formulário
// clínico. Equivalente ao legacy generate-template-from-document, mas
// devolve JSON conforme src/templates/types.ts em vez de prompt markdown.
//
// Recebe: { file_base64, mime_type, hint? }
// Retorna: { success, schema: TemplateSchema }
//
// Estratégia de prompt: descreve o catálogo de tipos do schema e dá
// few-shot examples cobrindo os padrões mais comuns (checkbox grid,
// radio, scored scale, table). Gemini Pro multimodal lida bem com PDFs
// e fotos de formulários.

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

const SYSTEM_PROMPT = `Você é especialista em transformar formulários clínicos em papel em schemas estruturados JSON.

Analise o documento (PDF ou foto) e devolva um TemplateSchema conforme o catálogo abaixo. Use português brasileiro nos labels.

═══ ESTRUTURA DO TEMPLATE ═══

{
  "id": "slug_minusculo_com_underscores",
  "name": "Nome curto pro picker",
  "description": "Frase curta explicando quando usar",
  "version": 1,
  "layout": "free" | "sbar",   // "sbar" só se o doc for explicitamente SBAR
  "metadata": {
    "captureMode": "voice",
    "applicableRoles": ["nurse"|"doctor"],
    "applicableWardTypes": ["uti"|"enfermaria"|"centro_cirurgico"|"pronto_socorro"|"ambulatorio"]
  },
  "sections": [Section, ...]
}

Cada Section:
{
  "id": "snake_case",
  "title": "Título legível em PT-BR",
  "narrative": { "enabled": true, "hint": "..." },   // SEMPRE incluir narrative
  "fields": [Field, ...]
}

═══ CATÁLOGO DE FIELD TYPES ═══

1. text — campo de texto curto
   { "id":"x", "type":"text", "label":"X" }

2. textarea — texto longo
   { "id":"x", "type":"textarea", "label":"X", "rows":2 }

3. number — número
   { "id":"x", "type":"number", "label":"X", "min":0, "max":100 }

4. number_with_unit — número com unidade fixa (ex: PA, FC, peso)
   { "id":"x", "type":"number_with_unit", "label":"X", "unit":"mmHg" }

5. date / datetime
   { "id":"x", "type":"date", "label":"X" }

6. boolean — Sim/Não simples
   { "id":"x", "type":"boolean", "label":"X?" }

7. radio — UMA opção entre várias (forma visual: bolinhas)
   { "id":"x", "type":"radio", "label":"X",
     "options":[{"value":"A","label":"Opção A"},...] }

8. select — UMA opção entre várias (forma visual: dropdown)
   {...idem radio mas type:"select"}

9. multi_checkbox — MÚLTIPLAS opções (forma visual: grid de caixinhas marcáveis)
   { "id":"x", "type":"multi_checkbox", "label":"X",
     "options":[{"value":"A","label":"Opção A"},...] }
   USE PRA: História patológica (HAS, DM, DPOC...), dispositivos/próteses, etc.

10. scale — slider numérico (ex: dor 0-10)
    { "id":"x", "type":"scale", "label":"X", "min":0, "max":10, "step":1 }

11. scored_scale — escala clínica pontuada (BRADEN/MORSE/Glasgow/RASS/etc)
    { "id":"x", "type":"scored_scale", "label":"BRADEN",
      "items":[
        { "id":"subitem", "label":"Subitem", "options":[{"value":1,"label":"Pior"},{"value":4,"label":"Melhor"}]}
      ],
      "classification":[
        {"min":0,"max":9,"label":"Risco muito alto","color":"red"},
        ...
      ] }

12. table — lista de objetos com colunas tipadas (ex: precauções, infusões, lesões)
    { "id":"x", "type":"table", "label":"X",
      "columns":[
        { "id":"tipo", "type":"text", "label":"Tipo" },
        { "id":"data", "type":"date", "label":"Data" }
      ] }
    Colunas podem ser qualquer field type SIMPLES (não table dentro de table).

13. tri_state_checklist — lista com SIM/NÃO/N/A por item (ex: bundles)
    { "id":"x", "type":"tri_state_checklist", "label":"X",
      "items":[{"id":"item1","label":"Item 1"},...] }

14. time_window_multi — janelas horárias selecionáveis
    { "id":"x", "type":"time_window_multi", "label":"X",
      "windows":[{"id":"09","label":"09:00"},...] }

15. computed — campo calculado (ex: IMC = peso/altura²)
    { "id":"imc", "type":"computed", "label":"IMC", "unit":"kg/m²",
      "formula":{"kind":"expression","expr":"peso / ((altura / 100) ^ 2)"} }

═══ CAMPOS OPCIONAIS EM QUALQUER FIELD ═══

- "required": true   // se o doc indica obrigatório
- "visibleWhen": { "field": "outro_field", "equals": "valor" }
  Use pra campos que só aparecem condicionalmente (ex: "Reação anestésica" só se "Anestesias anteriores" = SIM)

═══ REGRAS DE CONVERSÃO ═══

- Sequências de checkboxes em grid → multi_checkbox COM TODAS as opções
- Radio buttons SIM/NÃO → radio com 2 options OU boolean (se "Não relatado" tb for opção, use radio com 3)
- Tabelas com header → table com columns
- Escalas tipo BRADEN/MORSE/GLASGOW/RASS → scored_scale com items e classification
- Sinais vitais → seção "sinais_vitais" com number_with_unit cada
- Campos "Outros:" geralmente são text livre

═══ OUTPUT ═══

Devolva APENAS o JSON do TemplateSchema, sem markdown fences, sem explicação. Garanta que é JSON válido (aspas duplas, sem trailing commas).`;

interface GenerateRequest {
  file_base64: string;
  mime_type: string;
  hint?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as GenerateRequest;
    if (!body.file_base64 || !body.mime_type) {
      return json({ error: "file_base64 e mime_type são obrigatórios" }, 400);
    }

    const approxBytes = (body.file_base64.length * 3) / 4;
    if (approxBytes > 10 * 1024 * 1024) {
      return json({ error: "Arquivo muito grande (limite ~10MB)" }, 413);
    }

    const dataUrl = `data:${body.mime_type};base64,${body.file_base64}`;
    const userText = body.hint?.trim()
      ? `Tipo de documento: ${body.hint.trim()}\n\nExtraia o TemplateSchema do documento anexo.`
      : "Extraia o TemplateSchema do documento anexo.";

    const { content } = await aiCompleteJson({
      model: "google/gemini-2.5-pro",
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
      console.error("[template-schema-from-document] JSON inválido:", cleaned.slice(0, 500));
      return json(
        {
          error: "IA retornou JSON inválido. Tente outro arquivo ou ajuste a dica.",
          raw: cleaned.slice(0, 1000),
        },
        502,
      );
    }

    const obj = parsed as Record<string, unknown>;
    if (!obj.name || !Array.isArray(obj.sections)) {
      return json(
        {
          error: "Schema sem 'name' ou 'sections'. Tente outro documento.",
          raw: obj,
        },
        502,
      );
    }

    // Sanitização básica — força defaults seguros
    const schema = {
      id: typeof obj.id === "string" ? obj.id : "template_" + Date.now(),
      name: String(obj.name).trim(),
      description: typeof obj.description === "string" ? obj.description.trim() : "",
      version: 1,
      layout: obj.layout === "sbar" ? "sbar" : "free",
      metadata: obj.metadata ?? {
        captureMode: "voice",
        applicableRoles: ["nurse"],
        applicableWardTypes: [],
      },
      sections: obj.sections,
    };

    return json({ success: true, schema });
  } catch (e: any) {
    console.error("template-schema-from-document error:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
