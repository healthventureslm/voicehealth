/**
 * Multi-provider AI Gateway with circuit breaker and fallback.
 *
 * Priority order:
 *   1. Lovable gateway (ai.gateway.lovable.dev) — free, default
 *   2. Google AI (generativelanguage.googleapis.com) — direct Gemini
 *   3. OpenAI (api.openai.com) — fallback
 *
 * Circuit breaker: after 3 consecutive failures on a provider,
 * skip it for 60 seconds before retrying.
 */

interface ChatMessage {
  role: string;
  content: string | Array<{ type: string; [key: string]: unknown }>;
}

interface AiRequestOptions {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  /** If true, includes audio content — only Lovable and Gemini support this */
  hasAudio?: boolean;
}

interface AiResponse {
  ok: boolean;
  status: number;
  body: ReadableStream<Uint8Array> | null;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  provider: string;
}

interface CircuitState {
  failures: number;
  openUntil: number; // timestamp
}

// In-memory circuit breaker state (per isolate lifetime)
const circuits: Record<string, CircuitState> = {};

const FAILURE_THRESHOLD = 3;
const OPEN_DURATION_MS = 60_000; // 60 seconds

function isCircuitOpen(provider: string): boolean {
  const state = circuits[provider];
  if (!state) return false;
  if (state.failures >= FAILURE_THRESHOLD && Date.now() < state.openUntil) {
    return true;
  }
  // Half-open: allow retry after timeout
  if (state.failures >= FAILURE_THRESHOLD && Date.now() >= state.openUntil) {
    return false;
  }
  return false;
}

function recordFailure(provider: string): void {
  if (!circuits[provider]) {
    circuits[provider] = { failures: 0, openUntil: 0 };
  }
  circuits[provider].failures++;
  if (circuits[provider].failures >= FAILURE_THRESHOLD) {
    circuits[provider].openUntil = Date.now() + OPEN_DURATION_MS;
  }
}

function recordSuccess(provider: string): void {
  circuits[provider] = { failures: 0, openUntil: 0 };
}

// ── Model mapping per provider ──

const MODEL_MAP: Record<string, Record<string, string>> = {
  lovable: {
    "google/gemini-2.5-pro": "google/gemini-2.5-pro",
    "google/gemini-2.5-flash": "google/gemini-2.5-flash",
    "google/gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite",
  },
  google: {
    "google/gemini-2.5-pro": "gemini-2.5-pro-preview-05-06",
    "google/gemini-2.5-flash": "gemini-2.5-flash-preview-04-17",
    "google/gemini-2.5-flash-lite": "gemini-2.0-flash-lite",
  },
  openai: {
    "google/gemini-2.5-pro": "gpt-4o",
    "google/gemini-2.5-flash": "gpt-4o-mini",
    "google/gemini-2.5-flash-lite": "gpt-4o-mini",
  },
};

function getModelForProvider(provider: string, requestedModel: string): string {
  return MODEL_MAP[provider]?.[requestedModel] ?? requestedModel;
}

// ── Provider implementations ──

async function callLovable(opts: AiRequestOptions): Promise<Response> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not set");

  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getModelForProvider("lovable", opts.model || "google/gemini-2.5-pro"),
      messages: opts.messages,
      ...(opts.stream ? { stream: true } : {}),
    }),
  });
}

async function callGoogleDirect(opts: AiRequestOptions): Promise<Response> {
  const key = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!key) throw new Error("GOOGLE_AI_API_KEY not set");

  const model = getModelForProvider("google", opts.model || "google/gemini-2.5-pro");
  const endpoint = opts.stream
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  // Convert OpenAI-style messages to Gemini format
  const systemInstruction = opts.messages.find(m => m.role === "system");
  const contents = opts.messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: typeof m.content === "string"
        ? [{ text: m.content }]
        : m.content.map((c: Record<string, unknown>) => {
            if (c.type === "text") return { text: c.text as string };
            if (c.type === "input_audio") {
              return {
                inlineData: {
                  mimeType: `audio/${(c.input_audio as Record<string, string>)?.format || "webm"}`,
                  data: (c.input_audio as Record<string, string>)?.data,
                },
              };
            }
            if (c.type === "image_url") {
              const url = (c.image_url as Record<string, string>)?.url || "";
              if (url.startsWith("data:")) {
                const [meta, data] = url.split(",");
                const mime = meta.match(/data:([^;]+)/)?.[1] || "image/jpeg";
                return { inlineData: { mimeType: mime, data } };
              }
            }
            return { text: JSON.stringify(c) };
          }),
    }));

  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      ...(systemInstruction
        ? {
            systemInstruction: {
              parts: [{ text: typeof systemInstruction.content === "string" ? systemInstruction.content : JSON.stringify(systemInstruction.content) }],
            },
          }
        : {}),
    }),
  });
}

async function callOpenAI(opts: AiRequestOptions): Promise<Response> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY not set");

  // OpenAI doesn't support input_audio in the same format — strip audio parts
  const cleanMessages = opts.messages.map(m => {
    if (typeof m.content === "string") return m;
    return {
      ...m,
      content: m.content
        .filter((c: Record<string, unknown>) => c.type !== "input_audio")
        .map((c: Record<string, unknown>) => {
          if (c.type === "text") return c;
          if (c.type === "image_url") return c;
          return { type: "text", text: JSON.stringify(c) };
        }),
    };
  });

  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getModelForProvider("openai", opts.model || "google/gemini-2.5-pro"),
      messages: cleanMessages,
      ...(opts.stream ? { stream: true } : {}),
    }),
  });
}

// ── Main entry point ──

type Provider = { name: string; call: (opts: AiRequestOptions) => Promise<Response> };

export async function aiComplete(opts: AiRequestOptions): Promise<Response> {
  // Build provider chain — audio requests can't go to OpenAI
  const providers: Provider[] = [
    { name: "lovable", call: callLovable },
    { name: "google", call: callGoogleDirect },
  ];
  if (!opts.hasAudio) {
    providers.push({ name: "openai", call: callOpenAI });
  }

  let lastError: Error | null = null;
  let lastStatus = 500;

  for (const provider of providers) {
    if (isCircuitOpen(provider.name)) {
      console.warn(`[ai-gateway] Skipping ${provider.name} — circuit open`);
      continue;
    }

    try {
      const response = await provider.call(opts);

      if (response.ok) {
        recordSuccess(provider.name);
        console.log(`[ai-gateway] Success via ${provider.name}`);
        return response;
      }

      // Don't fallback on 429 (rate limit) — try next provider
      // Don't fallback on 402 (payment) — try next provider
      const status = response.status;
      lastStatus = status;

      if (status === 429 || status === 402) {
        console.warn(`[ai-gateway] ${provider.name} returned ${status}, trying next`);
        recordFailure(provider.name);
        continue;
      }

      // For 4xx client errors (except 429/402), don't fallback — it's our bug
      if (status >= 400 && status < 500) {
        const errorText = await response.text();
        console.error(`[ai-gateway] ${provider.name} client error ${status}:`, errorText);
        return response;
      }

      // 5xx server error — fallback
      console.warn(`[ai-gateway] ${provider.name} server error ${status}, trying next`);
      recordFailure(provider.name);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[ai-gateway] ${provider.name} exception:`, lastError.message);
      recordFailure(provider.name);
    }
  }

  // All providers failed
  throw new Error(
    `All AI providers failed. Last status: ${lastStatus}. Last error: ${lastError?.message || "unknown"}`
  );
}

/**
 * Convenience: call AI and return parsed JSON response (non-streaming).
 * Returns { content, provider } or throws.
 */
export async function aiCompleteJson(opts: Omit<AiRequestOptions, "stream">): Promise<{ content: string; provider: string }> {
  const response = await aiComplete({ ...opts, stream: false });
  const data = await response.json() as Record<string, unknown>;

  // Handle both OpenAI and Gemini response formats
  const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
  if (choices?.[0]?.message?.content) {
    return { content: choices[0].message.content, provider: "openai-format" };
  }

  // Gemini native format
  const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  if (candidates?.[0]?.content?.parts?.[0]?.text) {
    return { content: candidates[0].content.parts[0].text, provider: "gemini-format" };
  }

  throw new Error("Unexpected AI response format: " + JSON.stringify(data).slice(0, 200));
}
