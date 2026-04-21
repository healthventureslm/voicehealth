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
    const { consultation_id, specialty_id, transcription } = await req.json();
    if (!consultation_id || !specialty_id || !transcription) {
      return new Response(JSON.stringify({ error: "Missing required fields: consultation_id, specialty_id, transcription" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get specialty and its output prompt
    const { data: specialty, error: specError } = await supabase
      .from("medical_specialties")
      .select("*")
      .eq("id", specialty_id)
      .single();
    if (specError || !specialty) throw new Error("Specialty not found");

    // 2. Get patient info from consultation
    const { data: consultation } = await supabase
      .from("consultations")
      .select("*, patients(full_name, date_of_birth)")
      .eq("id", consultation_id)
      .single();

    const patientName = (consultation as any)?.patients?.full_name || "Não informado";
    const today = new Date().toLocaleDateString("pt-BR");

    // 3. RAG: Vector search using search-knowledge function
    let ragContext = "";
    try {
      const searchUrl = `${supabaseUrl}/functions/v1/search-knowledge`;
      const searchResp = await fetch(searchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          query: transcription.substring(0, 2000),
          specialty_id: specialty_id,
          match_count: 5,
          match_threshold: 0.3,
        }),
      });

      if (searchResp.ok) {
        const searchResult = await searchResp.json();
        if (searchResult.context && searchResult.count > 0) {
          ragContext = "\n\n## REFERÊNCIAS MÉDICAS (Base de Conhecimento - Busca Vetorial)\n" + searchResult.context;
          console.log(`RAG: Found ${searchResult.count} relevant chunks via vector search`);
        }
      }
    } catch (ragErr) {
      console.warn("RAG vector search failed, proceeding without context:", ragErr);
    }

    // 4. Build prompt from specialty template
    let outputPrompt = specialty.output_prompt
      .replace(/\{\{patient_name\}\}/g, patientName)
      .replace(/\{\{date\}\}/g, today)
      .replace(/\{\{age\}\}/g, "");

    // 5. Call AI with specialty prompt + RAG context
    const systemPrompt = `Você é um médico ${specialty.name} experiente atuando em ambulatório. 
Gere um relatório clínico completo, profissional e bem formatado em português brasileiro.
Use o formato Markdown com cabeçalhos claros.
Preencha TODAS as seções com base na transcrição fornecida.
Se alguma informação não estiver na transcrição, indique "Não avaliado/referido na consulta".
${ragContext}`;

    const userPrompt = `${outputPrompt}\n\n## TRANSCRIÇÃO DA CONSULTA:\n${transcription}`;

    const { content: reportContent } = await aiCompleteJson({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    // 6. Get user id
    const authHeader = req.headers.get("Authorization");
    let userId = null;
    if (authHeader) {
      const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
      const userClient = createClient(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id;
    }

    // 7. Save report
    const { error: insertError } = await supabase.from("clinical_reports").insert({
      consultation_id,
      template_type: `Ambulatório - ${specialty.name}`,
      content: reportContent,
      generated_by: userId,
    });
    if (insertError) throw new Error("Failed to save report: " + insertError.message);

    // 8. Update consultation status
    await supabase.from("consultations").update({ status: "completed" }).eq("id", consultation_id);

    return new Response(JSON.stringify({ success: true, content: reportContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ambulatory-report error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
