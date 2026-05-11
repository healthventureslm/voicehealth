import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot, Loader2, Send, Image as ImageIcon, X, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  streamPromptWizard,
  fileToDataUrl,
  type ChatMessage,
} from "@/lib/streamChat";

interface Props {
  /** Contexto opcional injetado no system prompt (tipo de doc, etc.). */
  context?: {
    type?: string;
    name?: string;
    description?: string;
  };
  /** Chamado quando o assistente devolve [FINAL_PROMPT] — passa só o prompt. */
  onFinalPrompt: (promptText: string) => void;
  /** Texto pra exibir como prompt seed (não é enviado — só dispara o stream). */
  kickoff?: string;
}

const ACCEPTED_IMAGE_MIMES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

interface PendingFile {
  file: File;
  preview: string;
}

interface ParsedAssistant {
  /** Texto exibido (sem markers QUESTION/FINAL_PROMPT). */
  display: string;
  /** Total de perguntas declarado pelo modelo (default 10). */
  total: number;
  /** Número da pergunta atual, se houver. */
  current: number | null;
  /** Conteúdo do prompt final (se já completado). */
  finalPrompt: string | null;
}

/**
 * Limpa marcadores [QUESTION X/Y] e [FINAL_PROMPT] do texto do assistente
 * e extrai metadata pra progress + transição automática pro form.
 */
function parseAssistant(raw: string): ParsedAssistant {
  let total = 10;
  let current: number | null = null;

  const questionMatch = raw.match(/\[QUESTION\s+(\d+)\s*\/\s*(\d+)\]/i);
  if (questionMatch) {
    current = Number(questionMatch[1]);
    total = Number(questionMatch[2]);
  }

  const finalIdx = raw.search(/\[FINAL_PROMPT\]/i);
  let finalPrompt: string | null = null;
  let display = raw;

  if (finalIdx >= 0) {
    finalPrompt = raw
      .slice(finalIdx)
      .replace(/\[FINAL_PROMPT\]/i, "")
      .trim();
    display = raw.slice(0, finalIdx).trim();
  }

  display = display.replace(/\[QUESTION\s+\d+\s*\/\s*\d+\]/gi, "").trim();

  return { display, total, current, finalPrompt };
}

export function PromptWizardChat({ context, onFinalPrompt, kickoff }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [progress, setProgress] = useState<{ current: number | null; total: number }>({
    current: null,
    total: 10,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const finalEmittedRef = useRef(false);

  // Auto-scroll
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  // Kickoff automático na montagem — dispara a primeira pergunta do bot
  useEffect(() => {
    if (kickoff && messages.length === 0) {
      void sendMessage(kickoff, [], { initial: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limpa previews + aborta stream ao desmontar
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      pendingFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickFiles() {
    fileInputRef.current?.click();
  }

  function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    const valid: PendingFile[] = [];
    for (const f of files) {
      if (!ACCEPTED_IMAGE_MIMES.includes(f.type)) {
        toast.error(`${f.name}: formato não suportado (PNG, JPG ou WebP).`);
        continue;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        toast.error(`${f.name}: arquivo grande demais (limite 10MB).`);
        continue;
      }
      valid.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setPendingFiles((p) => [...p, ...valid]);
  }

  function removePending(idx: number) {
    setPendingFiles((p) => {
      const removed = p[idx];
      if (removed) URL.revokeObjectURL(removed.preview);
      return p.filter((_, i) => i !== idx);
    });
  }

  async function buildUserMessage(text: string, files: PendingFile[]): Promise<ChatMessage> {
    if (files.length === 0) {
      return { role: "user", content: text };
    }
    const parts: ChatMessage["content"] = [];
    if (text.trim()) parts.push({ type: "text", text: text.trim() });
    for (const f of files) {
      const dataUrl = await fileToDataUrl(f.file);
      parts.push({ type: "image_url", image_url: { url: dataUrl } });
    }
    return { role: "user", content: parts };
  }

  async function sendMessage(
    text: string,
    files: PendingFile[],
    opts?: { initial?: boolean },
  ) {
    if (streaming) return;
    if (!text.trim() && files.length === 0 && !opts?.initial) return;

    const userMsg = await buildUserMessage(text, files);
    const baseHistory: ChatMessage[] = opts?.initial ? [] : [...messages, userMsg];
    const sendable: ChatMessage[] = opts?.initial ? [userMsg] : baseHistory;

    // Atualiza UI ANTES do stream começar
    if (!opts?.initial) {
      setMessages((m) => [...m, userMsg]);
      setInput("");
      pendingFiles.forEach((f) => URL.revokeObjectURL(f.preview));
      setPendingFiles([]);
    } else {
      setMessages([userMsg]);
    }

    // Mensagem do assistente vai sendo construída via streaming
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    setStreaming(true);
    const abort = new AbortController();
    abortRef.current = abort;

    let assistantText = "";

    try {
      await streamPromptWizard({
        messages: sendable,
        context,
        signal: abort.signal,
        onChunk: (delta) => {
          assistantText += delta;
          // Atualiza só o último (o do assistente em streaming)
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = { ...last, content: assistantText };
            }
            return copy;
          });
        },
      });

      // Parse final
      const parsed = parseAssistant(assistantText);
      setProgress({ current: parsed.current, total: parsed.total });

      // Substitui o conteúdo final pelo display limpo
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          copy[copy.length - 1] = { ...last, content: parsed.display || "✓" };
        }
        return copy;
      });

      // Se o modelo entregou o prompt final, emite uma vez
      if (parsed.finalPrompt && !finalEmittedRef.current) {
        finalEmittedRef.current = true;
        // Pequeno delay pra UX — usuário vê a mensagem "pronto" antes de pular
        setTimeout(() => onFinalPrompt(parsed.finalPrompt!), 600);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        // Usuário cancelou — não é erro real
      } else {
        toast.error(`Erro no chat: ${e?.message ?? String(e)}`);
        setMessages((m) => m.slice(0, -1)); // remove o assistente vazio
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input, pendingFiles);
  }

  const total = progress.total;
  const current = progress.current ?? 0;
  const progressPct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="flex flex-col" style={{ height: "min(70vh, 600px)" }}>
      {/* Header com progresso */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-enf" />
          <span className="font-semibold">Conversar com IA</span>
        </div>
        {progress.current && (
          <div className="flex items-center gap-2 flex-1 max-w-[200px]">
            <span className="text-xs font-medium tabular-nums" style={{ color: "var(--text-soft)" }}>
              {progress.current}/{progress.total}
            </span>
            <div className="flex-1 h-1.5 bg-[var(--bg-card-hov)] rounded-full overflow-hidden">
              <div
                className="h-full bg-enf transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mensagens */}
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--bg-card-hov)]"
      >
        {messages.length === 0 && (
          <div
            className="text-sm text-center py-8"
            style={{ color: "var(--text-muted)" }}
          >
            Iniciando…
          </div>
        )}
        {messages.map((m, idx) => (
          <MessageBubble key={idx} message={m} streaming={streaming && idx === messages.length - 1} />
        ))}
      </div>

      {/* Input */}
      <form onSubmit={onSubmit} className="border-t p-3 space-y-2">
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((f, idx) => (
              <div
                key={idx}
                className="relative w-16 h-16 rounded-md border overflow-hidden bg-background"
              >
                <img
                  src={f.preview}
                  alt={f.file.name}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePending(idx)}
                  className="absolute top-0 right-0 bg-foreground/70 text-background rounded-bl-md p-0.5 hover:bg-foreground"
                  aria-label="Remover imagem"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={onFilesPicked}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={pickFiles}
            disabled={streaming}
            aria-label="Anexar imagem"
            className="flex-shrink-0"
          >
            <ImageIcon className="w-4 h-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua resposta ou envie imagens…"
            rows={1}
            disabled={streaming}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input, pendingFiles);
              }
            }}
            className="resize-none min-h-[40px] max-h-32"
          />
          <Button
            type="submit"
            size="icon"
            disabled={streaming || (!input.trim() && pendingFiles.length === 0)}
            className="bg-enf hover:bg-enf-hover text-white flex-shrink-0"
            aria-label="Enviar"
          >
            {streaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Enter envia · Shift+Enter quebra linha · pode anexar fotos de documentos modelo
        </p>
      </form>
    </div>
  );
}

function MessageBubble({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming: boolean;
}) {
  const isAssistant = message.role === "assistant";
  const textParts: string[] = [];
  const imageParts: string[] = [];

  if (typeof message.content === "string") {
    textParts.push(message.content);
  } else {
    for (const part of message.content) {
      if (part.type === "text") textParts.push(part.text);
      else if (part.type === "image_url") imageParts.push(part.image_url.url);
    }
  }

  const text = textParts.join("\n");
  const displayText = isAssistant ? parseAssistant(text).display : text;

  return (
    <div className={cn("flex gap-2", isAssistant ? "justify-start" : "justify-end")}>
      {isAssistant && (
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--enf-soft)", color: "var(--enf-deep)" }}
        >
          <Bot className="w-4 h-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed",
          isAssistant
            ? "bg-background border"
            : "bg-enf text-white",
        )}
      >
        {imageParts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {imageParts.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`anexo ${i + 1}`}
                className="w-20 h-20 object-cover rounded-md border border-white/30"
              />
            ))}
          </div>
        )}
        {displayText && (
          <p className="whitespace-pre-wrap">
            {displayText}
            {streaming && isAssistant && (
              <span className="inline-block w-1.5 h-3 ml-0.5 bg-enf-deep animate-pulse align-middle" />
            )}
          </p>
        )}
        {!displayText && streaming && isAssistant && (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-muted)" }} />
        )}
      </div>
    </div>
  );
}
