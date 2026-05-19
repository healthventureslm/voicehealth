// Chat conversacional que evolui o TemplateSchema. Reusado em:
//   - Chat mode (criar do zero, schema inicial null)
//   - Refine inline (Review Step), com schema atual
//
// Suporta texto + anexo (PDF/imagem) em qualquer turno. Cada resposta
// da IA pode atualizar o schema; o componente chama onSchemaUpdate
// pro pai refletir no preview ao vivo.

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, X, Loader2, Bot, User, FileText, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CameraCaptureDialog } from "@/components/CameraCaptureDialog";
import type { TemplateSchema } from "@/templates/types";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: Array<{ name: string; size: number }>;
};

const OK_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_PER_FILE = 10 * 1024 * 1024; // 10 MB

interface SchemaChatProps {
  schema: TemplateSchema | null;
  onSchemaUpdate: (next: TemplateSchema) => void;
  /** Mensagem inicial opcional do assistente. */
  greeting?: string;
  /** Placeholder customizado do input. */
  placeholder?: string;
}

export function SchemaChat({
  schema,
  onSchemaUpdate,
  greeting = "Oi! Me conta o que você quer criar ou mande um documento de referência.",
  placeholder = "Ex: \"Quero um template de admissão com seção de antecedentes, dispositivos e barreiras\"",
}: SchemaChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: greeting },
  ]);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  function pickFile() {
    fileInputRef.current?.click();
  }

  function addFiles(incoming: File[]) {
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of incoming) {
      if (f.size > MAX_PER_FILE) {
        rejected.push(`${f.name} (>10MB)`);
        continue;
      }
      if (!OK_TYPES.includes(f.type)) {
        rejected.push(`${f.name} (tipo não suportado)`);
        continue;
      }
      accepted.push(f);
    }
    if (rejected.length > 0) {
      toast.error(`Alguns arquivos ignorados: ${rejected.join(", ")}`);
    }
    if (accepted.length > 0) {
      setPendingFiles((prev) => [...prev, ...accepted]);
    }
  }

  function removePendingFile(idx: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function fileToBase64(f: File): Promise<string> {
    const buf = await f.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed && pendingFiles.length === 0) return;
    if (isLoading) return;

    // Adiciona a mensagem do usuário ao histórico local
    const userMsg: ChatMessage = {
      role: "user",
      content: trimmed || (pendingFiles.length > 1
        ? `[${pendingFiles.length} documentos enviados]`
        : "[documento enviado]"),
      attachments: pendingFiles.length > 0
        ? pendingFiles.map((f) => ({ name: f.name, size: f.size }))
        : undefined,
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");

    setIsLoading(true);
    try {
      const filesPayload = pendingFiles.length > 0
        ? await Promise.all(
            pendingFiles.map(async (f) => ({
              base64: await fileToBase64(f),
              mime_type: f.type,
            })),
          )
        : undefined;

      // Limpa anexos antes da request (response vai apenas o texto na lista)
      setPendingFiles([]);

      // History pra IA: todas as mensagens EXCETO o greeting inicial
      const history = nextMessages
        .filter((_, i) => i > 0)
        .slice(0, -1)
        .map((m) => ({ role: m.role, content: m.content }));

      const { data, error: fnErr } = await supabase.functions.invoke(
        "template-schema-chat",
        {
          body: {
            schema,
            history,
            message: trimmed || (filesPayload && filesPayload.length > 1
              ? "Analise os documentos anexos."
              : "Analise o documento anexo."),
            files: filesPayload,
          },
        },
      );

      if (fnErr) throw fnErr;
      if (!data?.success) {
        throw new Error(data?.error ?? "Sem resposta da IA");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.assistant_reply || "(sem resposta)" },
      ]);

      if (data.changed && data.schema) {
        onSchemaUpdate(data.schema as TemplateSchema);
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Erro: ${msg}` },
      ]);
      toast.error(`Falha na conversa: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground italic px-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            IA pensando...
          </div>
        )}
      </div>

      <div className="border-t p-3 space-y-2">
        {pendingFiles.length > 0 && (
          <div className="space-y-1.5">
            {pendingFiles.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-enf shrink-0" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</span>
                <button
                  onClick={() => removePendingFile(i)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remover ${f.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            multiple
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
            disabled={isLoading}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={pickFile}
            disabled={isLoading}
            title="Anexar PDF ou imagem"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setCameraOpen(true)}
            disabled={isLoading}
            title="Tirar foto agora"
          >
            <Camera className="w-4 h-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={placeholder}
            rows={2}
            disabled={isLoading}
            className="resize-none min-h-[50px]"
          />
          <Button
            type="button"
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && pendingFiles.length === 0)}
            className="gap-1.5 bg-enf hover:bg-enf-hover text-white"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground px-1">
          Enter envia · Shift+Enter quebra linha · Anexe documentos ou tire foto a qualquer momento
        </p>
      </div>

      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(captured) => {
          addFiles([captured]);
          setCameraOpen(false);
        }}
      />
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-enf/15 text-enf flex items-center justify-center shrink-0">
          <Bot className="w-3.5 h-3.5" />
        </div>
      )}
      <div
        className={cn(
          "rounded-lg px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap break-words",
          isUser ? "bg-enf text-white" : "bg-muted",
        )}
      >
        {msg.content}
        {msg.attachments && msg.attachments.length > 0 && (
          <div
            className={cn(
              "mt-1.5 space-y-0.5",
              isUser ? "text-white/80" : "text-muted-foreground",
            )}
          >
            {msg.attachments.map((a, i) => (
              <div key={i} className="text-xs flex items-center gap-1 italic">
                <FileText className="w-3 h-3" />
                {a.name} ({(a.size / 1024).toFixed(0)} KB)
              </div>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
          <User className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
}
