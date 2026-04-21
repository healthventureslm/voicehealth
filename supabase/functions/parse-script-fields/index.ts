import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiCompleteJson } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScriptField {
  id: string;
  label: string;
  required: boolean;
  keywords: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { description, sector } = await req.json();
    if (!description?.trim()) {
      return new Response(JSON.stringify({ error: "Missing description" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Você é um assistente clínico que extrai campos estruturados de um roteiro de consulta médica.

Roteiro fornecido pelo administrador:
"${description}"

${sector ? `Setor: ${sector}` : ""}

Extraia os campos/informações que devem ser coletados e retorne um JSON com este formato EXATO:
{
  "fields": [
    {
      "id": "identificacao_paciente",
      "label": "Identificação do paciente",
      "required": true,
      "keywords": ["paciente", "anos", "leito", "nome"]
    }
  ]
}

Regras obrigatórias:
- Máximo 8 campos
- id deve ser snake_case único e descritivo
- label deve ser claro e em português
- keywords: liste 3-6 palavras-chave em português SEM acentos que indicam que o campo foi coberto na fala
- Inclua sinônimos e abreviações médicas comuns nas keywords
- required = true para campos críticos ao documento, false para complementares
- Retorne SOMENTE o JSON válido, sem markdown, sem explicações`;

    const { content } = await aiCompleteJson({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "Você extrai campos estruturados de roteiros médicos. Retorne sempre JSON válido sem markdown.",
        },
        { role: "user", content: prompt },
      ],
    });

    // Strip markdown code blocks if present
    const jsonStr = content.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON in AI response");

    const parsed = JSON.parse(jsonMatch[0]);
    const fields: ScriptField[] = Array.isArray(parsed.fields) ? parsed.fields.slice(0, 8) : [];

    return new Response(JSON.stringify({ fields }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("parse-script-fields error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
