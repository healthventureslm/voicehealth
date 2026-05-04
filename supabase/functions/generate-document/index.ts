// Edge function: generate-document
// Gera um documento estruturado (clinical_report) a partir de N notas
// (consultations sem template_id) de um paciente, usando 1 template.
//
// Recebe: { patient_id, template_id, source_consultation_ids: string[] }
// Retorna: { success, content, report_id }
//
// Diferença vs generate-report:
//  - Não tem consultation_id; o report fica vinculado direto ao patient_id.
//  - Concatena transcrições das notas (com data) num "dossiê" e manda pro LLM.

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
    const { patient_id, template_id, source_consultation_ids } = body as {
      patient_id?: string;
      template_id?: string;
      source_consultation_ids?: string[];
    };

    if (
      !patient_id ||
      !template_id ||
      !Array.isArray(source_consultation_ids) ||
      source_consultation_ids.length === 0
    ) {
      return json(
        { error: "Missing fields: patient_id, template_id, source_consultation_ids[]" },
        400,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Quem está pedindo?
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

    // Template
    const { data: template, error: templateError } = await supabase
      .from("report_templates")
      .select("id, name, prompt")
      .eq("id", template_id)
      .single();
    if (templateError || !template) {
      return json({ error: "Template não encontrado" }, 404);
    }

    // Notas (consultations) com transcrição, ordenadas cronologicamente
    const { data: notes, error: notesError } = await supabase
      .from("consultations")
      .select("id, created_at, edited_transcription, raw_transcription")
      .in("id", source_consultation_ids)
      .eq("patient_id", patient_id)
      .order("created_at", { ascending: true });
    if (notesError) {
      return json({ error: "Falha ao buscar notas: " + notesError.message }, 500);
    }
    if (!notes || notes.length === 0) {
      return json({ error: "Nenhuma nota válida encontrada" }, 404);
    }

    // Monta o dossiê (transcrições com timestamp humano)
    const fmtDate = (s: string) =>
      new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const dossier = notes
      .map((n, i) => {
        const text = (n.edited_transcription ?? n.raw_transcription ?? "").trim();
        if (!text) return null;
        return `--- Nota ${i + 1} (${fmtDate(n.created_at)}) ---\n${text}`;
      })
      .filter(Boolean)
      .join("\n\n");

    if (!dossier) {
      return json({ error: "Notas selecionadas não têm transcrição" }, 400);
    }

    const promptHasPlaceholder = /\{\{transcription\}\}/.test(template.prompt);
    const userPrompt = promptHasPlaceholder
      ? template.prompt.replace(/\{\{transcription\}\}/g, dossier)
      : `${template.prompt}\n\nNotas do paciente (em ordem cronológica):\n${dossier}`;

    const { content: reportContent } = await aiCompleteJson({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Você é um assistente clínico em português do Brasil. Gere documentos profissionais, estruturados, em markdown, baseados nas notas do paciente. Quando informações conflitam entre notas, prefira a mais recente. Não invente dados que não estejam nas notas.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const { data: inserted, error: insertError } = await supabase
      .from("clinical_reports")
      .insert({
        consultation_id: null,
        patient_id,
        template_id,
        source_consultation_ids,
        version: 1,
        content: reportContent,
        format: "markdown",
        generated_by: userId,
      })
      .select()
      .single();
    if (insertError) {
      throw new Error("Falha ao salvar documento: " + insertError.message);
    }

    return json({
      success: true,
      content: reportContent,
      report_id: inserted.id,
    });
  } catch (e: any) {
    console.error("generate-document error:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
