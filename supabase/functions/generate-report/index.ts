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
    const { consultation_id, template_id, transcription, transcriptions } = body;

    if (!consultation_id || !template_id || (!transcription && (!transcriptions || transcriptions.length === 0))) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get template
    const { data: template, error: templateError } = await supabase
      .from("report_templates")
      .select("*")
      .eq("id", template_id)
      .single();

    if (templateError || !template) throw new Error("Template not found");

    // Build combined transcription text
    let combinedText = "";
    if (transcriptions && transcriptions.length > 0) {
      // Consolidated mode: multiple transcriptions with separators
      combinedText = transcriptions
        .map((t: { text: string; date: string; index: number }, i: number) =>
          `--- Gravação ${i + 1} (${t.date}) ---\n${t.text}`
        )
        .join("\n\n");
    } else {
      combinedText = transcription;
    }

    // Replace placeholder in prompt
    const prompt = template.prompt_template.replace(/\{\{transcription\}\}/g, combinedText);

    const { content: reportContent } = await aiCompleteJson({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você é um assistente médico especializado em gerar relatórios clínicos estruturados. Gere relatórios profissionais, completos e bem formatados em português." },
        { role: "user", content: prompt },
      ],
    });

    // Get auth user from request
    const authHeader = req.headers.get("Authorization");
    let userId = null;
    if (authHeader) {
      const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id;
    }

    // Save report
    const { error: insertError } = await supabase.from("clinical_reports").insert({
      consultation_id,
      template_type: template.name,
      content: reportContent,
      generated_by: userId,
    });

    if (insertError) throw new Error("Failed to save report: " + insertError.message);

    // Update consultation status
    await supabase.from("consultations").update({ status: "completed" }).eq("id", consultation_id);

    return new Response(JSON.stringify({ success: true, content: reportContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-report error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
