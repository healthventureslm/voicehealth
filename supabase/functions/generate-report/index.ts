// Edge function: generate-report
// Adaptada para o schema v2:
//   - report_templates.prompt_template → report_templates.prompt
//   - clinical_reports.template_type   → clinical_reports.template_id (FK)
//   - clinical_reports é versionado: cada nova chamada cria nova versão
//
// Recebe: { consultation_id, template_id, transcription }
// Retorna: { success, content, version }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { consultation_id, template_id, transcription } = body;

    if (!consultation_id || !template_id || !transcription) {
      return json({ error: "Missing fields: consultation_id, template_id, transcription" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Identifica o usuário autor (pra clinical_reports.generated_by)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const publishableKey =
        Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id ?? null;
    }

    // Busca template
    const { data: template, error: templateError } = await supabase
      .from("report_templates")
      .select("id, name, prompt")
      .eq("id", template_id)
      .single();
    if (templateError || !template) {
      return json({ error: "Template não encontrado" }, 404);
    }

    // patient_id da consulta (clinical_reports.patient_id é NOT NULL agora)
    const { data: consultation, error: cErr } = await supabase
      .from("consultations")
      .select("patient_id")
      .eq("id", consultation_id)
      .single();
    if (cErr || !consultation) {
      return json({ error: "Consulta não encontrada" }, 404);
    }

    // O prompt do template pode ter placeholder {{transcription}} ou esperar
    // o texto via mensagem de usuário separada — suportamos os dois.
    const promptHasPlaceholder = /\{\{transcription\}\}/.test(template.prompt);
    const userPrompt = promptHasPlaceholder
      ? template.prompt.replace(/\{\{transcription\}\}/g, transcription)
      : `${template.prompt}\n\nTranscrição:\n${transcription}`;

    // Chama LLM
    const { content: reportContent } = await aiCompleteJson({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Você é um assistente clínico em português do Brasil. Gere relatórios profissionais, estruturados, em markdown. Não invente dados que não estejam na transcrição.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    // Próxima versão (1, 2, 3, ...) — cada chamada gera nova versão
    const { data: existing } = await supabase
      .from("clinical_reports")
      .select("version")
      .eq("consultation_id", consultation_id)
      .order("version", { ascending: false })
      .limit(1);
    const nextVersion = ((existing?.[0]?.version as number | undefined) ?? 0) + 1;

    const { data: inserted, error: insertError } = await supabase
      .from("clinical_reports")
      .insert({
        consultation_id,
        patient_id: consultation.patient_id,
        template_id,
        version: nextVersion,
        content: reportContent,
        format: "markdown",
        generated_by: userId,
      })
      .select()
      .single();
    if (insertError) {
      throw new Error("Falha ao salvar relatório: " + insertError.message);
    }

    return json({
      success: true,
      content: reportContent,
      version: nextVersion,
      report_id: inserted.id,
    });
  } catch (e: any) {
    console.error("generate-report error:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
