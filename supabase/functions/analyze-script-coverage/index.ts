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
    const { transcript, fields } = await req.json();

    if (!transcript?.trim() || !Array.isArray(fields) || fields.length === 0) {
      return new Response(JSON.stringify({ covered_ids: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fieldList = fields
      .map((f: ScriptField) => `- ID: "${f.id}" | Campo: "${f.label}"`)
      .join("\n");

    const prompt = `Analise esta transcrição médica e determine quais campos do roteiro clínico foram cobertos pelo profissional durante a fala.

## Campos do Roteiro:
${fieldList}

## Transcrição:
"${transcript}"

## Regras:
- Um campo está "coberto" se o profissional mencionou, descreveu ou abordou o tema, mesmo usando palavras diferentes ou sinônimos
- Considere linguagem médica informal, abreviações e termos coloquiais
- Seja criterioso: o campo precisa ter sido realmente abordado, não apenas mencionado de passagem
- Retorne SOMENTE um JSON válido no formato: {"covered_ids": ["id1", "id2"]}
- Se nenhum campo foi coberto, retorne {"covered_ids": []}`;

    const { content } = await aiCompleteJson({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: "Você é um analisador clínico que verifica cobertura de campos em transcrições médicas. Retorne apenas JSON válido." },
        { role: "user", content: prompt },
      ],
    });

    // Extract JSON
    const jsonStr = content.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ covered_ids: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validIds = new Set(fields.map((f: ScriptField) => f.id));
    const coveredIds = Array.isArray(parsed.covered_ids)
      ? parsed.covered_ids.filter((id: string) => validIds.has(id))
      : [];

    return new Response(JSON.stringify({ covered_ids: coveredIds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("analyze-script-coverage error:", e);
    return new Response(JSON.stringify({ covered_ids: [], error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
