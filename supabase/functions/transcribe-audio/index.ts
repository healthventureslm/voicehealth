// Edge function: transcribe-audio
// Adaptada para o schema v2:
//   - removida tabela `app_settings` (Whisper-fallback agora via env var)
//   - removida coluna `clinical_reports.template_type` (não existe no schema novo)
//   - removida coluna `consultations.ai_summary` (não existe no schema novo)
//   - relatório clínico agora gerado em chamada separada via `generate-report`
//
// Recebe: { consultation_id, audio_path }
//   ou:    { audio_base64, content_type } (modo simples — usado pelo Wizard)
// Retorna: { transcription: string }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiComplete, aiCompleteJson } from "../_shared/ai-gateway.ts";
// nota: usamos aiCompleteJson nos caminhos de retorno texto pra normalizar
// automaticamente respostas do OpenAI (choices[]) E do Google (candidates[]).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MEDICAL_SYSTEM_PROMPT = `Você é um transcritor médico especializado em português do Brasil (pt-BR).

REGRAS OBRIGATÓRIAS:
1. Transcreva EXATAMENTE o que foi dito — preserve termos médicos, dosagens, valores e abreviações
2. Mantenha nomes de medicamentos como pronunciados (ex: "noradrenalina", "furosemida", "losartana")
3. Preserve valores numéricos: PA (ex: "128/82"), FC, SpO2, temperatura, peso, altura
4. Use pontuação adequada para clareza clínica
5. NUNCA adicione rótulos de falante ("Médico:", "Paciente:", "Enfermeiro:" etc). Mesmo que haja múltiplas vozes, transcreva como texto corrido, sem identificar quem falou.
6. Mantenha abreviações: PA, FC, FR, SpO2, MMII, AAS, EV, VO, SOS, ACM, PCR, AVC, ICC, DPOC, HAS, DM2, IAM, TEP
7. Retorne APENAS o texto transcrito, sem comentários, sem prefixos, sem markdown, sem rótulos`;

const WARD_TYPE_VOCAB: Record<string, string> = {
  uti: "Contexto UTI: SOFA, APACHE II, Glasgow, RASS, CAM-ICU, PEEP, FiO2, PaO2/FiO2, noradrenalina, vasopressina, meropeném, vancomicina, balanço hídrico, PAM, VM, TOT, CVC.",
  pronto_socorro:
    "Contexto Pronto-Socorro: SAPS 3, GCS, FAST, politrauma, TCE, tPA, alteplase, amiodarona, NIHSS, ABCDE, reanimação, desfibrilação.",
  enfermaria:
    "Contexto Enfermaria: CURB-65, Wells, Padua, TVP, TEP, BNP, troponina, d-dímero, escala de Braden, cateteres, curativos, evolução de enfermagem.",
  ambulatorio:
    "Contexto Ambulatório: HAS, DM2, ICC, DPOC, hipotireoidismo, LDL, HDL, HbA1c, MAPA, Holter, ecocardiograma, encaminhamento.",
  centro_cirurgico:
    "Contexto Centro Cirúrgico: ASA, NPO, indução, intubação, anestesia geral/raqui, hemoderivados, sangramento, drenos, recovery.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const publishableKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) return json({ error: "Sessão inválida" }, 401);

    const body = await req.json();
    const { consultation_id, audio_path, audio_base64, content_type } = body;

    // ── Modo simples (usado pelo PromptWizard etc): base64 → texto ──
    if (audio_base64) {
      const mimeType = content_type || "audio/webm";
      try {
        const { content } = await aiCompleteJson({
          model: "google/gemini-2.5-pro",
          hasAudio: true,
          messages: [
            {
              role: "system",
              content:
                "Você é um transcritor preciso em português do Brasil. Transcreva EXATAMENTE o que foi dito. Retorne APENAS o texto.",
            },
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: {
                    data: audio_base64,
                    format: mimeType.includes("mp4") ? "mp4" : "webm",
                  },
                },
                { type: "text", text: "Transcreva este áudio em português do Brasil." },
              ],
            },
          ],
        });
        return json({ transcription: (content || "").trim() });
      } catch (e: any) {
        return json({ error: "Falha na transcrição", details: e?.message }, 500);
      }
    }

    // ── Modo completo: pipeline da consulta ──
    if (!consultation_id || !audio_path) {
      return json({ error: "Missing consultation_id or audio_path" }, 400);
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Busca consulta + ward_type pra ajudar contexto
    const { data: consultationRow } = await supabase
      .from("consultations")
      .select("id, ward_id, ward:wards(ward_type)")
      .eq("id", consultation_id)
      .maybeSingle();
    const wardType = (consultationRow as any)?.ward?.ward_type as string | undefined;

    // Whisper fallback agora via env var em vez de app_settings
    const useWhisper = (Deno.env.get("USE_WHISPER_FALLBACK") || "").toLowerCase() === "true";

    // Download do áudio
    const { data: audioData, error: downloadError } = await supabase.storage
      .from("audio-recordings")
      .download(audio_path);
    if (downloadError || !audioData) {
      throw new Error("Falha ao baixar áudio: " + downloadError?.message);
    }

    let text = "";

    if (useWhisper) {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) {
        return json({ error: "OPENAI_API_KEY não configurada na function" }, 500);
      }

      const audioSize = audioData.size;
      const audioFilename = audio_path.endsWith(".mp4") ? "audio.mp4" : "audio.webm";
      console.log(`[whisper] uploading ${audioFilename} (${audioSize} bytes)`);

      const formData = new FormData();
      formData.append("file", audioData, audioFilename);
      formData.append("model", "whisper-1");
      formData.append("language", "pt");
      formData.append("response_format", "json");

      const wResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: formData,
      });

      console.log(`[whisper] status ${wResp.status}`);

      if (!wResp.ok) {
        const errText = await wResp.text();
        console.error(`[whisper] failed: ${errText}`);
        return json(
          { error: "Whisper falhou", status: wResp.status, details: errText },
          wResp.status === 429 ? 429 : 502,
        );
      }

      const wr = await wResp.json();
      console.log(`[whisper] response keys: ${Object.keys(wr).join(",")}; text length: ${(wr.text || "").length}`);
      text = wr.text || "";

      if (!text.trim()) {
        return json(
          { error: "Whisper retornou transcrição vazia. Verifique o áudio (volume, duração, qualidade)." },
          422,
        );
      }
    } else {
      // Gemini transcription
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

      const wardVocab = wardType && WARD_TYPE_VOCAB[wardType] ? WARD_TYPE_VOCAB[wardType] : "";

      let rawText = "";
      try {
        const { content } = await aiCompleteJson({
          model: "google/gemini-2.5-pro",
          hasAudio: true,
          messages: [
            { role: "system", content: MEDICAL_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: {
                    data: base64Audio,
                    format: mimeType === "audio/mp4" ? "mp4" : "webm",
                  },
                },
                {
                  type: "text",
                  text: wardVocab
                    ? `Transcreva este áudio de atendimento em português. ${wardVocab}`
                    : "Transcreva este áudio de atendimento em português do Brasil.",
                },
              ],
            },
          ],
        });
        rawText = content || "";
        console.log(`[transcribe-audio] raw text length: ${rawText.length}`);
      } catch (e: any) {
        const msg = e?.message || String(e);
        console.error(`[transcribe-audio] gateway error:`, msg);
        return json({ error: "Falha na transcrição via Gemini", details: msg }, 502);
      }

      // Pass 2: correção de termos médicos
      if (rawText.trim()) {
        try {
          const { content: corrected } = await aiCompleteJson({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "Você é um revisor médico em português do Brasil. Corrija APENAS erros óbvios de transcrição (medicamentos, valores, abreviações). Não altere o conteúdo clínico. Se já estiver correto, retorne sem alterações.",
              },
              {
                role: "user",
                content: `Texto a revisar:\n\n${rawText}`,
              },
            ],
          });
          text = corrected || rawText;
        } catch (e) {
          console.warn("Correction pass falhou, usando bruto:", e);
          text = rawText;
        }
      } else {
        text = rawText;
      }
    }

    if (!text.trim()) {
      console.warn("[transcribe-audio] texto vazio após transcrição");
      return json(
        {
          error: "Transcrição vazia — verifique a qualidade do áudio (volume, duração, ruído).",
          fallback: true,
        },
        422,
      );
    }

    // O cliente é responsável por salvar raw_transcription / edited_transcription /
    // chamar generate-report. Mantemos a edge function focada apenas em transcrever.
    return json({ transcription: text.trim() });
  } catch (e: any) {
    console.error("transcribe-audio error:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
