import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiCompleteJson } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { specialty_name, specialty_description, base_prompt } = await req.json();
    if (!specialty_name) {
      return new Response(JSON.stringify({ error: "specialty_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um especialista em criar prompts médicos para geração de relatórios clínicos ambulatoriais.
Crie um prompt detalhado e estruturado para a especialidade médica informada.

O prompt deve incluir:
1. Identificação do paciente (com variáveis {{patient_name}}, {{date}})
2. Queixa principal
3. História da doença atual (HDA) com sintomas específicos da especialidade
4. Antecedentes relevantes para a especialidade
5. Exame físico específico da especialidade com campos estruturados
6. Exames complementares típicos
7. Impressão diagnóstica com CID-10
8. Conduta (prescrições, orientações, retorno)
9. Alertas clínicos

O prompt deve ser escrito em português brasileiro, ser profissional e completo.
Retorne APENAS o prompt, sem explicações adicionais.`;

    const userMessage = base_prompt
      ? `Refine e melhore este prompt para a especialidade "${specialty_name}" (${specialty_description || ""}):\n\n${base_prompt}`
      : `Crie um prompt de saída de consulta ambulatorial para a especialidade: "${specialty_name}". Descrição: ${specialty_description || "Não fornecida"}.`;

    const { content: generatedPrompt } = await aiCompleteJson({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    return new Response(JSON.stringify({ success: true, prompt: generatedPrompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-specialty-prompt error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
