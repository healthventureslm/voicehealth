import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/**
 * Conteúdo multimodal de uma mensagem — string simples ou array de partes
 * (texto + imagens via data URL base64). Bate com o formato esperado pela
 * edge function prompt-wizard (compatível com OpenAI/Gemini gateway).
 */
export type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export interface ChatMessage {
  role: "user" | "assistant";
  content: ChatContent;
}

interface StreamOptions {
  /** Mensagens enviadas pro modelo (já inclui histórico anterior). */
  messages: ChatMessage[];
  /** Contexto opcional injetado no system prompt. */
  context?: {
    type?: string;
    name?: string;
    description?: string;
  };
  /** Callback chamado a cada chunk de texto recebido. */
  onChunk: (text: string) => void;
  /** AbortSignal pra cancelar streaming no meio (opcional). */
  signal?: AbortSignal;
}

/**
 * Chama a edge function prompt-wizard e processa o SSE chunk a chunk.
 *
 * O endpoint devolve um stream OpenAI-compatible: linhas começando com
 * "data: " contendo JSON com `choices[0].delta.content`. Linha final é
 * "data: [DONE]".
 *
 * Returna o texto completo concatenado quando o stream termina.
 */
export async function streamPromptWizard({
  messages,
  context,
  onChunk,
  signal,
}: StreamOptions): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? SUPABASE_ANON_KEY;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/prompt-wizard`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ messages, context }),
    signal,
  });

  if (!res.ok) {
    let errMsg = `Erro ${res.status}`;
    try {
      const err = await res.json();
      if (err?.error) errMsg = err.error;
    } catch {
      // Body não é JSON — fica com o status
    }
    throw new Error(errMsg);
  }

  if (!res.body) {
    throw new Error("Sem corpo de resposta");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Processa linhas completas; deixa parcial no buffer
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        // Aceita formato OpenAI (choices[0].delta.content) OU Gemini
        // (candidates[0].content.parts[0].text) — a edge function pode cair
        // pra qualquer um dos providers no gateway.
        const openAiDelta: string | undefined = json?.choices?.[0]?.delta?.content;
        const geminiDelta: string | undefined =
          json?.candidates?.[0]?.content?.parts?.[0]?.text;
        const delta = openAiDelta ?? geminiDelta;
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch {
        // Chunk pode não ser JSON em alguns providers — ignora
      }
    }
  }

  return full;
}

/**
 * Converte um File em data URL base64 (com prefixo data:mime;base64,...).
 * Pronto pra ser usado como image_url no formato multimodal.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
