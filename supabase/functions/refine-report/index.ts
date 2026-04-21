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
    const body = await req.json();
    const { report_content, user_message, report_type, report_id } = body;

    if (!report_content || !user_message) {
      return new Response(
        JSON.stringify({ error: "Missing report_content or user_message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um assistente médico especializado em refinar documentos clínicos.

Tipo de documento: ${report_type || "documento clínico"}

Regras:
- Aplique APENAS a modificação solicitada pelo usuário, preservando todo o restante do documento.
- Mantenha a formatação, seções e estrutura existentes.
- Use linguagem médica profissional em português brasileiro.
- Se a instrução for remover algo, remova-o completamente sem deixar marcadores vazios.
- Se a instrução for adicionar algo, insira no local mais apropriado do documento.
- Se a instrução for corrigir algo, corrija mantendo o contexto.
- Nunca adicione comentários sobre as alterações feitas — retorne APENAS o documento refinado.`;

    const userPrompt = `Documento atual:
${report_content}

Instrução do usuário: ${user_message}

Retorne o documento completo refinado conforme a instrução acima.`;

    const { content: refinedContent } = await aiCompleteJson({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    if (!refinedContent.trim()) {
      throw new Error("Resposta vazia do modelo de IA");
    }

    // If report_id provided, update the record in clinical_reports
    if (report_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const authHeader = req.headers.get("authorization") || "";

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { error: updateError } = await supabase
        .from("clinical_reports")
        .update({ content: refinedContent })
        .eq("id", report_id);

      if (updateError) {
        console.error("Failed to update clinical_report:", updateError.message);
        // Don't throw — still return the refined content even if DB update fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, refined_content: refinedContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("refine-report error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
