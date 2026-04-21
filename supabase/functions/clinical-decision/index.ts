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
    const { consultation_id, transcription } = await req.json();
    if (!consultation_id || !transcription) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch clinical protocols for context
    const { data: protocols } = await supabase
      .from("clinical_protocols")
      .select("title, category, content, keywords")
      .eq("is_active", true);

    const protocolContext = protocols?.map((p) =>
      `Protocolo: ${p.title}\nCategoria: ${p.category || "Geral"}\nPalavras-chave: ${p.keywords?.join(", ") || ""}\nConteúdo: ${p.content}`
    ).join("\n\n---\n\n") || "Nenhum protocolo cadastrado.";

    const systemPrompt = `Você é um assistente de decisão clínica especializado. Analise a transcrição médica abaixo e retorne alertas clínicos.

PROTOCOLOS DISPONÍVEIS:
${protocolContext}

REGRAS:
1. Identifique INTERAÇÕES MEDICAMENTOSAS entre medicamentos mencionados
2. Sugira DIAGNÓSTICOS DIFERENCIAIS baseados nos sintomas descritos
3. Busque PROTOCOLOS CLÍNICOS relevantes da base acima. Se não encontrar match exato, use seu conhecimento médico como fallback.
4. NUNCA deixe de responder. Sempre forneça pelo menos uma sugestão.
5. Classifique a severidade: "critical" para riscos graves, "warning" para atenção, "info" para sugestões

Retorne SOMENTE um JSON válido (sem markdown, sem code blocks) no formato:
{
  "alerts": [
    {
      "alert_type": "drug_interaction" | "differential_diagnosis" | "protocol_suggestion",
      "title": "string",
      "description": "string",
      "severity": "info" | "warning" | "critical"
    }
  ]
}`;

    const { content: aiContent } = await aiCompleteJson({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analise esta transcrição médica e retorne alertas clínicos:\n\n${transcription}` },
      ],
    });

    const jsonStr = aiContent.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON in AI response");
    const { alerts } = JSON.parse(jsonMatch[0]);

    // Delete old alerts for this consultation
    await supabase.from("clinical_alerts").delete().eq("consultation_id", consultation_id);

    // Insert new alerts
    if (alerts?.length > 0) {
      const { error } = await supabase.from("clinical_alerts").insert(
        alerts.map((a: any) => ({
          consultation_id,
          alert_type: a.alert_type,
          title: a.title,
          description: a.description,
          severity: a.severity,
        }))
      );
      if (error) console.error("Error inserting alerts:", error);
    }

    return new Response(JSON.stringify({ success: true, alerts_count: alerts?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("clinical-decision error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
