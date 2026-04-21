import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiComplete, aiCompleteJson } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth check ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authError } = await authClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { consultation_id, audio_path, template_id, sector, audio_base64, content_type } = body;

    // ── Simple mode: base64 audio → text (used by Wizard) ──
    if (audio_base64) {
      const mimeType = content_type || "audio/webm";
      const response = await aiComplete({
        model: "google/gemini-2.5-pro",
        hasAudio: true,
        messages: [
          { role: "system", content: "Você é um transcritor preciso em português do Brasil. Transcreva EXATAMENTE o que foi dito no áudio. Retorne APENAS o texto transcrito, sem comentários." },
          {
            role: "user",
            content: [
              { type: "input_audio", input_audio: { data: audio_base64, format: mimeType.includes("mp4") ? "mp4" : "webm" } },
              { type: "text", text: "Transcreva este áudio em português do Brasil." },
            ],
          },
        ],
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Simple transcription error:", response.status, errorText);
        return new Response(JSON.stringify({ error: "Falha na transcrição", details: errorText }), {
          status: response.status === 429 ? 429 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await response.json() as Record<string, unknown>;
      const choices = result.choices as Array<{ message?: { content?: string } }> | undefined;
      const text = choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ transcription: text.trim(), text: text.trim() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Full mode: consultation pipeline ──
    if (!consultation_id || !audio_path) {
      return new Response(JSON.stringify({ error: "Missing consultation_id or audio_path" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Medical transcription system prompt
    const MEDICAL_SYSTEM_PROMPT = `Você é um transcritor médico especializado em português do Brasil (pt-BR).

REGRAS OBRIGATÓRIAS:
1. Transcreva EXATAMENTE o que foi dito — preserve todos os termos médicos, dosagens, valores e abreviações
2. Mantenha nomes de medicamentos exatamente como pronunciados (ex: "noradrenalina", "furosemida", "losartana")
3. Preserve valores numéricos precisos: pressão arterial (ex: "128/82"), FC, SpO2, temperatura, peso, altura
4. Use pontuação adequada para clareza clínica
5. Se houver múltiplos falantes identificáveis, use "Médico:", "Paciente:", "Enfermeiro:" para separar
6. Abreviações médicas comuns: mantenha como estão (PA, FC, FR, SpO2, MMII, AAS, EV, VO, SOS, ACM, PCR, AVC, ICC, DPOC, HAS, DM2, IAM, TEP)
7. Retorne APENAS o texto transcrito, sem comentários, sem prefixos, sem markdown`;

    const SECTOR_VOCAB: Record<string, string> = {
      uti: "Contexto UTI — termos esperados: SOFA, APACHE II, Glasgow, RASS, CAM-ICU, PEEP, FiO2, PaO2/FiO2, noradrenalina, vasopressina, meropeném, vancomicina, heparina, balanço hídrico, PAM, VM, TOT, CVC",
      emergencia: "Contexto Emergência — termos esperados: SAPS 3, GCS, FAST, politrauma, TCE, tPA, alteplase, amiodarona, adenosina, naloxona, flumazenil, NIHSS, ABCDE, reanimação, desfibrilação",
      enfermaria: "Contexto Enfermaria — termos esperados: CURB-65, Wells, Padua, TVP, TEP, albumina, BNP, troponina, d-dímero, escala de Braden, cateteres, curativos, evolução de enfermagem",
      ambulatorio: "Contexto Ambulatório — termos esperados: HAS, DM2, ICC, DPOC, hipotireoidismo, LDL, HDL, HbA1c, MAPA, Holter, ecocardiograma, densitometria, encaminhamento, retorno",
    };

    // Check Whisper fallback setting
    let useWhisper = false;
    const { data: whisperSetting } = await supabase
      .from("app_settings").select("value").eq("key", "use_whisper").maybeSingle();
    if (whisperSetting?.value === "true") useWhisper = true;

    // Step 1: Download audio
    const { data: audioData, error: downloadError } = await supabase.storage
      .from("audio-recordings").download(audio_path);
    if (downloadError || !audioData) {
      throw new Error("Failed to download audio: " + downloadError?.message);
    }

    let text = "";

    if (useWhisper) {
      // Whisper fallback
      const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
      const formData = new FormData();
      formData.append("file", audioData, "audio.webm");
      formData.append("model", "whisper-1");
      formData.append("language", "pt");
      const whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: formData,
      });
      if (!whisperResp.ok) {
        const errorText = await whisperResp.text();
        console.error("Whisper error:", whisperResp.status, errorText);
        if (errorText.includes("insufficient_quota") || whisperResp.status === 429) {
          await supabase.from("consultations").update({ status: "error" }).eq("id", consultation_id);
          return new Response(JSON.stringify({ error: "Quota excedida", fallback: true }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("Whisper error: " + errorText);
      }
      const wr = await whisperResp.json();
      text = wr.text;
    } else {
      // Gemini transcription via multi-provider gateway
      const arrayBuffer = await audioData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binaryString = "";
      const CHUNK_SIZE = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binaryString);
      const mimeType = audio_path.endsWith(".mp4") ? "audio/mp4" : "audio/webm";

      const transcribeResp = await aiComplete({
        model: "google/gemini-2.5-pro",
        hasAudio: true,
        messages: [
          { role: "system", content: MEDICAL_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "input_audio", input_audio: { data: base64Audio, format: mimeType === "audio/mp4" ? "mp4" : "webm" } },
              {
                type: "text",
                text: sector && SECTOR_VOCAB[sector]
                  ? `Transcreva este áudio de atendimento médico em português. ${SECTOR_VOCAB[sector]}`
                  : "Transcreva este áudio de atendimento médico em português do Brasil.",
              },
            ],
          },
        ],
      });

      if (!transcribeResp.ok) {
        const status = transcribeResp.status;
        const errorText = await transcribeResp.text();
        console.error("Transcription error:", status, errorText);
        if (status === 429 || status === 402) {
          return new Response(JSON.stringify({ error: `Transcription ${status}`, fallback: true }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("Transcription error: " + errorText);
      }

      const tResult = await transcribeResp.json() as Record<string, unknown>;
      const tChoices = tResult.choices as Array<{ message?: { content?: string } }> | undefined;
      const rawText = tChoices?.[0]?.message?.content || "";

      // Pass 2: Medical term correction (text-only, uses fallback gateway)
      if (rawText.trim()) {
        try {
          const { content: corrected } = await aiCompleteJson({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Você é um revisor médico especializado em português do Brasil. Corrija erros de transcrição automática em textos médicos." },
              {
                role: "user",
                content: `Corrija APENAS erros óbvios de transcrição neste texto médico:
1. Nomes de medicamentos incorretos (ex: "furozimida" → "furosemida")
2. Valores clínicos sem sentido (ex: "pressão 12 por 8" → "PA 120/80 mmHg")
3. Abreviações médicas mal transcritas (ex: "s o f a" → "SOFA")
4. Números fragmentados que são dosagens (ex: "50 mili gramas" → "50 mg")

NÃO altere o conteúdo clínico, NÃO adicione informações, NÃO reformate.
Se o texto já estiver correto, retorne-o sem alterações.

Texto:
${rawText}`,
              },
            ],
          });
          text = corrected;
        } catch (e) {
          console.warn("Two-pass correction failed, using raw:", e);
          text = rawText;
        }
      } else {
        text = rawText;
      }
    }

    if (!text.trim()) {
      throw new Error("Transcrição vazia — verifique a qualidade do áudio.");
    }

    // Step 3: Generate ai_summary (non-blocking)
    let aiSummary: string | null = null;
    try {
      const { content } = await aiCompleteJson({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Resuma em 1-2 frases curtas o conteúdo clínico desta transcrição médica. Seja objetivo e use termos médicos quando apropriado. Retorne APENAS o resumo." },
          { role: "user", content: text.slice(0, 2000) },
        ],
      });
      aiSummary = content.trim() || null;
    } catch (e) {
      console.warn("ai_summary failed (non-fatal):", e);
    }

    // Step 4: Update consultation
    const { error: updateError } = await supabase
      .from("consultations")
      .update({
        raw_transcription: text,
        edited_transcription: text,
        status: template_id ? "generating" : "transcribed",
        ...(aiSummary ? { ai_summary: aiSummary } : {}),
      })
      .eq("id", consultation_id);
    if (updateError) throw new Error("Failed to update: " + updateError.message);

    // Step 5: Generate report if template_id provided
    let reportContent: string | null = null;
    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from("report_templates").select("*").eq("id", template_id).single();
      if (templateError || !template) throw new Error("Template not found: " + templateError?.message);

      const prompt = template.prompt_template.replace(/\{\{transcription\}\}/g, text);

      try {
        const { content } = await aiCompleteJson({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: "Você é um assistente médico especializado em gerar relatórios clínicos estruturados. Gere relatórios profissionais, completos e bem formatados em português." },
            { role: "user", content: prompt },
          ],
        });
        reportContent = content;
      } catch (e) {
        console.error("Report generation failed:", e);
        return new Response(JSON.stringify({ success: true, transcription: text, report: null, error: "Falha ao gerar relatório" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("clinical_reports").insert({
        consultation_id,
        template_type: template.name,
        content: reportContent,
        generated_by: authUser.id,
      });
      await supabase.from("consultations").update({ status: "completed" }).eq("id", consultation_id);
    }

    return new Response(JSON.stringify({ success: true, transcription: text, report: reportContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("transcribe-audio error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
