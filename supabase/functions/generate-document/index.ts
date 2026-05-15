// Edge function: generate-document
// Gera um documento estruturado (clinical_report) a partir de N notas
// (consultations sem template_id) de um paciente, usando 1 template.
//
// Dual-mode (Fase 2+):
//   - Se template.schema preenchido → IA devolve JSON validado em
//     filled_data + content markdown derivado.
//   - Caso contrário → fluxo markdown legado.
//
// Diferença vs generate-report:
//   - Não tem consultation_id; o report fica vinculado direto ao patient_id.
//   - Concatena transcrições das N notas num "dossiê" com timestamps.
//
// Recebe: { patient_id, template_id, source_consultation_ids: string[] }
// Retorna: { success, content, filled_data?, report_id }

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

// IA sem responseSchema às vezes envolve em ```json ... ```. Descasca.
function stripJsonFence(s: string): string {
  const trimmed = s.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  return fenced ? fenced[1].trim() : trimmed;
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

    // Template (com schema pra decidir o modo)
    const { data: template, error: templateError } = await supabase
      .from("report_templates")
      .select("id, name, prompt, schema")
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
        `[generate-document] template=${tmpl.name} sections=${tmpl.sections.length} ` +
          `schema_bytes=${schemaJson.length} dossier_chars=${dossier.length}`,
      );

      const messages = [
        {
          role: "system",
          content:
            buildStructuredSystemPrompt(
              schemaSummary,
              "das notas do paciente (em ordem cronológica) os",
            ) +
            "\n\n═══ REGRA EXTRA: CONFLITOS ENTRE NOTAS ═══\n\n" +
            "Quando informações conflitam entre notas, prefira a MAIS RECENTE. " +
            "Se a nota anterior dizia uma coisa e a nota seguinte mudou, use o " +
            "valor da nota seguinte e mencione a evolução na _narrative " +
            "(ex: \"BRADEN evoluiu de 14 (12/05) para 12 (13/05)\").",
        },
        { role: "user", content: `Notas do paciente (em ordem cronológica):\n${dossier}` },
      ];

      // Tenta com responseSchema (enforcement estrito). Se Gemini rejeitar
      // (schema grande/complexo demais → INVALID_ARGUMENT), faz fallback
      // pra JSON livre guiado só por prompt. Output ainda é JSON parseável;
      // só perde o enforcement de enum exato (mitigado por prompt v2).
      let rawJson: string;
      try {
        const result = await aiCompleteJson({
          model: "google/gemini-2.5-pro",
          responseSchema,
          messages,
        });
        rawJson = result.content;
      } catch (schemaErr: any) {
        const msg = String(schemaErr?.message ?? schemaErr);
        if (msg.includes("INVALID_ARGUMENT") || msg.includes("400")) {
          console.warn(
            "[generate-document] responseSchema rejeitado pelo Gemini, " +
              "tentando fallback sem schema. erro:",
            msg.slice(0, 200),
          );
          const result = await aiCompleteJson({
            model: "google/gemini-2.5-pro",
            // Sem responseSchema. responseMimeType continuaria ajudando se
            // o gateway o setasse — hoje só ativo junto com schema. O system
            // prompt v2 instrui IA a devolver JSON puro.
            messages,
          });
          rawJson = result.content;
          // IA pode envolver em ```json...``` quando não há schema; descasca.
          rawJson = stripJsonFence(rawJson);
        } else {
          throw schemaErr;
        }
      }

      try {
        filledData = JSON.parse(rawJson) as Record<string, unknown>;
      } catch (parseErr) {
        console.error("[generate-document] JSON inválido da IA:", rawJson.slice(0, 500));
        throw new Error("IA retornou JSON malformado: " + (parseErr as Error).message);
      }

      reportContent = structuredToMarkdown(tmpl, filledData);
      reportFormat = "structured";
    } else {
      // ── Modo MARKDOWN (legado) ──
      const promptHasPlaceholder = /\{\{transcription\}\}/.test(template.prompt);
      const userPrompt = promptHasPlaceholder
        ? template.prompt.replace(/\{\{transcription\}\}/g, dossier)
        : `${template.prompt}\n\nNotas do paciente (em ordem cronológica):\n${dossier}`;

      const { content } = await aiCompleteJson({
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
      reportContent = content;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("clinical_reports")
      .insert({
        consultation_id: null,
        patient_id,
        template_id,
        source_consultation_ids,
        version: 1,
        content: reportContent,
        format: reportFormat,
        filled_data: filledData,
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
      filled_data: filledData,
      report_id: inserted.id,
    });
  } catch (e: any) {
    console.error("generate-document error:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
