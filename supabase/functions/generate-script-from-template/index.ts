import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiCompleteJson } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um especialista em UX clínica. Sua tarefa: a partir de um TEMPLATE
DE RELATÓRIO clínico (markdown estruturado), gerar um ROTEIRO DE
TELEPROMPTER — a lista de pontos que o profissional de saúde precisa
mencionar durante a gravação para o relatório ficar completo.

O roteiro é mostrado em tempo real ao usuário enquanto ele grava. Cada
ponto tem uma lista de KEYWORDS (palavras-chave) — se uma delas aparece
na transcrição da fala, o ponto é marcado como "coberto".

Regras para os campos do roteiro:
- Cada campo do roteiro corresponde a UM AGRUPAMENTO MACRO de informação
  no template (não um para cada bullet do template — agrupe sub-campos
  relacionados).
- Em geral 8 a 14 campos. Menos = roteiro raso; mais = poluído.
- Label: frase curta no infinitivo ou substantiva, como instrução pro
  usuário ("Avaliação neurológica (consciência, Glasgow)").
- Required = true só nos campos críticos pra qualidade do documento.
- Keywords: 4 a 12 palavras-chave em pt-BR SEM ACENTOS e em minúsculas.
  Inclua sinônimos, abreviações médicas comuns (PA, FC, SpO2, etc.),
  formas verbais ("evacuou", "evacuacao"), variações ("lucido", "lucida").
  Não use palavras genéricas demais ("paciente", "fez", "tem").
- O id é snake_case curto baseado no label.

Retorne APENAS um JSON válido (sem markdown, sem code fences):
{
  "name": "Mesmo nome do template (string exata)",
  "description": "Frase curta explicando o uso do roteiro",
  "applicable_ward_types": ["uti" | "enfermaria" | "centro_cirurgico" | "pronto_socorro" | "ambulatorio"],
  "fields": [
    {
      "id": "identificacao",
      "label": "Identificação do paciente (nome, idade)",
      "required": true,
      "keywords": ["paciente", "anos", "idade"]
    }
  ]
}

Importante:
- "name" DEVE ser idêntico ao nome do template (pareamento 1:1 por nome).
- Replique applicable_ward_types do template. Se vier vazio, mantenha vazio.
- Não invente seções que não estejam no template.`;

interface GenerateRequest {
  template_name: string;
  template_prompt: string;
  applicable_ward_types?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as GenerateRequest;
    if (!body.template_name?.trim() || !body.template_prompt?.trim()) {
      return new Response(
        JSON.stringify({ error: "template_name e template_prompt são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userText = `Template:
NAME: ${body.template_name}
APPLICABLE_WARD_TYPES: ${JSON.stringify(body.applicable_ward_types ?? [])}

PROMPT:
${body.template_prompt}

Gere o roteiro de teleprompter para este template.`;

    const { content } = await aiCompleteJson({
      model: "google/gemini-2.5-pro",
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
      console.error("Failed to parse model output as JSON:", cleaned.slice(0, 500));
      return new Response(
        JSON.stringify({
          error: "A IA retornou conteúdo inválido. Tente novamente.",
          raw: cleaned.slice(0, 1000),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const obj = parsed as Record<string, unknown>;
    if (typeof obj.name !== "string" || !Array.isArray(obj.fields)) {
      return new Response(
        JSON.stringify({
          error: "Resposta da IA sem 'name' ou 'fields'.",
          raw: obj,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sanitiza fields — garante shape consistente
    const fields = (obj.fields as unknown[])
      .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
      .map((f, i) => ({
        id: String(f.id ?? `campo_${i + 1}`).toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40),
        label: String(f.label ?? "").trim(),
        required: Boolean(f.required),
        keywords: Array.isArray(f.keywords)
          ? (f.keywords as unknown[]).map((k) => String(k).toLowerCase().trim()).filter(Boolean)
          : [],
      }))
      .filter((f) => f.id && f.label);

    if (fields.length === 0) {
      return new Response(
        JSON.stringify({ error: "A IA não conseguiu extrair campos válidos do template." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = {
      name: String(obj.name).trim(),
      description: typeof obj.description === "string" ? obj.description.trim() : "",
      applicable_ward_types: Array.isArray(obj.applicable_ward_types)
        ? (obj.applicable_ward_types as unknown[]).filter((x) => typeof x === "string")
        : [],
      fields,
    };

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-script-from-template error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
