// Edge function: generate-report
//
// Dual-mode geração de relatório clínico:
//
//  • Modo ESTRUTURADO (novo, Fase 2): se report_templates.schema estiver
//    populado, a IA recebe um responseSchema (subset OpenAPI do Gemini) e
//    devolve um JSON validado. Salvamos em clinical_reports.filled_data e
//    derivamos um markdown legível em `content` (compatível com a UI atual
//    de visualização e o exportador PDF).
//
//  • Modo MARKDOWN (legado): se schema for NULL, usa o prompt_template
//    antigo com placeholder {{transcription}} e devolve markdown livre.
//
// Recebe: { consultation_id, template_id, transcription }
// Retorna: { success, content, filled_data?, version, report_id }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiCompleteJson } from "../_shared/ai-gateway.ts";
import {
  templateToResponseSchema,
  describeSchemaForPrompt,
  type TemplateSchema,
} from "../_shared/template-to-response-schema.ts";
import { structuredToMarkdown } from "../_shared/structured-to-markdown.ts";
import { buildStructuredSystemPrompt } from "../_shared/structured-prompt.ts";

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

    // Busca template (já trazendo schema pra decidir o modo)
    const { data: template, error: templateError } = await supabase
      .from("report_templates")
      .select("id, name, prompt, schema")
      .eq("id", template_id)
      .single();
    if (templateError || !template) {
      return json({ error: "Template não encontrado" }, 404);
    }

    // patient_id da consulta (clinical_reports.patient_id é NOT NULL)
    const { data: consultation, error: cErr } = await supabase
      .from("consultations")
      .select("patient_id")
      .eq("id", consultation_id)
      .single();
    if (cErr || !consultation) {
      return json({ error: "Consulta não encontrada" }, 404);
    }

    let reportContent: string;
    let filledData: Record<string, unknown> | null = null;
    let reportFormat = "markdown";

    if (template.schema) {
      // ── Modo ESTRUTURADO ──
      const tmpl = template.schema as TemplateSchema;
      const responseSchema = templateToResponseSchema(tmpl);
      const schemaSummary = describeSchemaForPrompt(tmpl);
      const schemaJson = JSON.stringify(responseSchema);
      console.log(
        `[generate-report] template=${tmpl.name} sections=${tmpl.sections.length} ` +
          `schema_bytes=${schemaJson.length} transcription_chars=${transcription.length}`,
      );

      const { content: rawJson } = await aiCompleteJson({
        model: "google/gemini-2.5-flash",
        responseSchema,
        messages: [
          {
            role: "system",
            content: buildStructuredSystemPrompt(
              schemaSummary,
              "da transcrição os",
            ),
          },
          { role: "user", content: `Transcrição da gravação:\n${transcription}` },
        ],
      });

      try {
        filledData = JSON.parse(rawJson) as Record<string, unknown>;
      } catch (parseErr) {
        console.error("[generate-report] JSON inválido da IA:", rawJson.slice(0, 500));
        throw new Error("IA retornou JSON malformado: " + (parseErr as Error).message);
      }

      reportContent = structuredToMarkdown(tmpl, filledData);
      reportFormat = "structured";
    } else {
      // ── Modo MARKDOWN (legado) ──
      const promptHasPlaceholder = /\{\{transcription\}\}/.test(template.prompt);
      const userPrompt = promptHasPlaceholder
        ? template.prompt.replace(/\{\{transcription\}\}/g, transcription)
        : `${template.prompt}\n\nTranscrição:\n${transcription}`;

      const { content } = await aiCompleteJson({
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
      reportContent = content;
    }

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
        format: reportFormat,
        filled_data: filledData,
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
      filled_data: filledData,
      version: nextVersion,
      report_id: inserted.id,
    });
  } catch (e: any) {
    console.error("generate-report error:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
