// Chat conversacional que constrói/refina TemplateSchema iterativamente.
//
// Usado em 2 modos do builder:
//   - Chat puro (criar do zero, schema inicial = null)
//   - Refinar (vem com schema já populado, admin pede ajustes)
//
// File attachment é opcional em qualquer turno — usuário pode subir
// documento no meio da conversa pra reforçar contexto.
//
// Recebe: { schema, history, message, file? }
// Retorna: { assistant_reply, schema, changed }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

const SYSTEM_PROMPT = `Você é um assistente que ajuda admins clínicos a montar templates estruturados de relatório, conversando em PT-BR.

Cada turno você recebe:
- O schema atual do template (pode ser null se ainda não tem nada)
- O histórico da conversa
- A nova mensagem do usuário (texto + opcionalmente um documento)

Sua resposta DEVE ser um JSON com:
{
  "reply": "Texto curto explicando o que você fez/sugere (1-3 frases, conversacional)",
  "schema": { ... TemplateSchema completo e atualizado ... },
  "changed": true | false
}

Regras:
- changed=true quando você alterou o schema. changed=false se só respondeu sem mudar nada.
- reply curto e direto, conversa de WhatsApp clínico.
- schema deve ser SEMPRE o template inteiro atualizado (não delta).
- Se ainda não tem nada (schema=null) e usuário pediu pra começar, monte o esqueleto inicial.
- Se usuário enviou documento anexado, extraia/atualize o schema baseado nele.

═══ ESTRUTURA DO TEMPLATE ═══

{
  "id": "slug",
  "name": "Nome curto",
  "description": "Frase explicativa",
  "version": 1,
  "layout": "free" | "sbar",
  "metadata": {
    "captureMode": "voice",
    "applicableRoles": ["nurse"|"doctor"],
    "applicableWardTypes": ["uti"|"enfermaria"|"centro_cirurgico"|"pronto_socorro"|"ambulatorio"]
  },
  "sections": [{
    "id": "snake_case",
    "title": "Título",
    "narrative": { "enabled": true, "hint": "..." },
    "fields": [Field, ...]
  }]
}

═══ FIELD TYPES (todos) ═══

text, textarea, number, number_with_unit (com "unit"), date, datetime, boolean,
radio/select (com "options":[{value,label}]), multi_checkbox (idem options),
scale ("min","max","step"), scored_scale ("items":[{id,label,options}], "classification":[{min,max,label,color}]),
table ("columns": Field[]), tri_state_checklist ("items":[{id,label}]),
time_window_multi ("windows":[{id,label}]), computed ("formula":{kind:"expression",expr:"..."}).

Campo pode ter: required, visibleWhen ({field, equals|in|contains}), extractAs.

═══ DIRETRIZES ═══

- Multi-checkbox pra grids tipo HPP/dispositivos.
- scored_scale pra escalas pontuadas (BRADEN, MORSE, GLASGOW, RASS).
- narrative habilitada em TODA seção (escape hatch).
- Padrão Rede D'Or / Clínica São Vicente.
- PT-BR brasileiro.

Retorne APENAS o JSON, sem code fences.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  schema: unknown; // TemplateSchema | null
  history: ChatMessage[];
  message: string;
  file?: { base64: string; mime_type: string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as ChatRequest;

    if (!body.message?.trim() && !body.file) {
      return json({ error: "message ou file obrigatório" }, 400);
    }

    // Monta as mensagens pro Gemini: system + contexto do schema atual +
    // histórico convertido + nova mensagem (com file opcional).
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          "Contexto: schema ATUAL do template (pode estar vazio).\n\n```json\n" +
          JSON.stringify(body.schema ?? null, null, 2) +
          "\n```\n\nVamos conversar pra evoluir.",
      },
      { role: "assistant", content: "Beleza, pode mandar o que quer ajustar ou criar." },
    ];

    for (const h of body.history ?? []) {
      messages.push({
        role: h.role === "assistant" ? "assistant" : "user",
        content: h.content,
      });
    }

    // Mensagem nova: pode ter texto + anexo
    if (body.file) {
      const dataUrl = `data:${body.file.mime_type};base64,${body.file.base64}`;
      messages.push({
        role: "user",
        content: [
          { type: "text", text: body.message || "Use o documento anexo." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      });
    } else {
      messages.push({ role: "user", content: body.message });
    }

    const { content } = await aiCompleteJson({
      model: "google/gemini-2.5-pro",
      messages,
    });

    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // IA não conseguiu devolver JSON estruturado — devolve o texto como reply
      // sem mudança no schema. Acontece em mensagens triviais ("oi", "ok").
      return json({
        success: true,
        assistant_reply: cleaned.slice(0, 500),
        schema: body.schema ?? null,
        changed: false,
      });
    }

    return json({
      success: true,
      assistant_reply: typeof parsed.reply === "string" ? parsed.reply : "",
      schema: parsed.schema ?? body.schema ?? null,
      changed: parsed.changed === true,
    });
  } catch (e: any) {
    console.error("template-schema-chat error:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
