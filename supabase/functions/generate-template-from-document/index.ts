import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiCompleteJson } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um especialista em criar prompts para IA gerar relatórios clínicos
estruturados a partir de transcrição de áudio. O usuário vai te enviar uma foto ou PDF
de um formulário, modelo, evolução ou documento clínico real usado em hospital.

Sua tarefa: analisar o documento e produzir um TEMPLATE DE RELATÓRIO no padrão da
Clínica São Vicente / Rede D'Or — markdown estruturado com seções "##", bullets
"- **Campo:** valor", e checkboxes "[ ]" / "[x]" onde apropriado.

Regras pra geração do prompt:
- Comece com 3-5 linhas explicando à IA o papel ("Você é um enfermeiro experiente da..."), o objetivo, e a entrada (transcrição de áudio).
- Inclua "Regras obrigatórias" com bullets claros: não inventar dados, usar "Não relatado" / "Não avaliado" para campos não citados, manter os títulos com "##", etc.
- Replique a estrutura de seções e campos do documento original o mais fielmente possível.
- Para listas marcáveis no documento original (caixas de seleção), use checkbox markdown "- [ ] item".
- Para campos com valores possíveis (ex: "Sim / Não / Não relatado"), liste as opções separadas por " / ".
- Mantenha abreviações médicas usuais (PA, FC, FR, SpO2, MMII, RHA, BH, PEEP, FiO2, VM, SVD, etc.).
- Use português brasileiro.

Retorne APENAS um JSON válido (sem markdown, sem code fences) com este formato exato:
{
  "name": "Nome curto do template (ex: 'Evolução de Enfermagem')",
  "description": "Frase curta explicando quando usar (ex: 'Evolução diária para enfermagem em UTI/enfermaria.')",
  "prompt": "O prompt completo conforme regras acima, em markdown",
  "applicable_ward_types": ["uti" | "enfermaria" | "centro_cirurgico" | "pronto_socorro" | "ambulatorio"],
  "applicable_roles": ["doctor" | "nurse"]
}

applicable_ward_types e applicable_roles devem ser arrays vazios se não der pra inferir
do documento. Não invente valores.`;

interface GenerateRequest {
  /** Base64 do arquivo (sem o prefixo data:...). */
  file_base64: string;
  /** MIME type — application/pdf, image/png, image/jpeg, etc. */
  mime_type: string;
  /** Hint opcional do usuário sobre o tipo de documento (vai pro user prompt). */
  hint?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as GenerateRequest;
    if (!body.file_base64 || !body.mime_type) {
      return new Response(
        JSON.stringify({ error: "file_base64 e mime_type são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Tamanho aproximado do payload (base64 ≈ 4/3 do binário) — limita a ~10MB de arquivo
    const approxBytes = (body.file_base64.length * 3) / 4;
    if (approxBytes > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Arquivo muito grande (limite ~10MB)" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dataUrl = `data:${body.mime_type};base64,${body.file_base64}`;
    const userText = body.hint?.trim()
      ? `Tipo de documento (dica do usuário): ${body.hint.trim()}\n\nGere o template de relatório a partir do arquivo anexo.`
      : "Gere o template de relatório a partir do arquivo anexo.";

    // Gemini aceita PDFs e imagens nativamente via inlineData (que o gateway
    // monta a partir de image_url com data URL).
    const { content } = await aiCompleteJson({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    // O modelo às vezes envolve o JSON em code fences mesmo instruído a não fazer
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse model output as JSON:", cleaned.slice(0, 500));
      return new Response(
        JSON.stringify({
          error: "A IA retornou conteúdo inválido. Tente novamente ou use 'Criar do zero'.",
          raw: cleaned.slice(0, 1000),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validação mínima do shape
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.name !== "string" || typeof obj.prompt !== "string") {
      return new Response(
        JSON.stringify({
          error: "Resposta da IA sem 'name' ou 'prompt'. Tente outro arquivo.",
          raw: obj,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = {
      name: String(obj.name).trim(),
      description: typeof obj.description === "string" ? obj.description.trim() : "",
      prompt: String(obj.prompt).trim(),
      applicable_ward_types: Array.isArray(obj.applicable_ward_types)
        ? (obj.applicable_ward_types as unknown[]).filter((x) => typeof x === "string")
        : [],
      applicable_roles: Array.isArray(obj.applicable_roles)
        ? (obj.applicable_roles as unknown[]).filter((x) => typeof x === "string")
        : [],
    };

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-template-from-document error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
