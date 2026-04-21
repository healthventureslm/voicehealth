import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, SendHorizontal, MessageSquare, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RefinementChatProps {
  reportId: string;
  reportType: string;
  currentContent: string;
  onContentRefined: (newContent: string) => void;
}

export function RefinementChat({
  reportId,
  reportType,
  currentContent,
  onContentRefined,
}: RefinementChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const SUGGESTIONS = [
    "Adicione mais detalhes ao plano terapêutico",
    "Remova a seção de diagnósticos secundários",
    "Corrija os sinais vitais conforme o exame físico",
    "Reformate em tópicos numerados",
    "Adicione alerta de medicamento controlado",
    "Traduza termos técnicos para linguagem mais clara",
  ];

  const sendMessage = async (messageText: string) => {
    const text = messageText.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    const userMessage: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("refine-report", {
        body: {
          report_content: currentContent,
          user_message: text,
          report_type: reportType,
          report_id: reportId,
        },
      });

      if (fnError) throw fnError;
      if (!data?.refined_content) throw new Error("Resposta vazia do assistente");

      onContentRefined(data.refined_content);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Documento atualizado conforme sua instrução." },
      ]);
    } catch (err: any) {
      setError(err?.message || "Erro ao refinar o documento");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Não foi possível aplicar a alteração. Tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader
        className="py-3 px-4 cursor-pointer select-none"
        onClick={() => setIsOpen((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-medium">Refinar com IA</CardTitle>
            {messages.length > 0 && (
              <Badge variant="secondary" className="text-xs h-4 px-1.5">
                {Math.floor(messages.length / 2)} alteração{messages.length > 2 ? "ões" : ""}
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="px-4 pb-4 pt-0 space-y-3">
          <p className="text-xs text-muted-foreground">
            Diga ao assistente o que deseja ajustar no documento — ele aplicará a mudança preservando o restante.
          </p>

          {/* Message history (last 3 exchanges) */}
          {messages.length > 0 && (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {messages.slice(-6).map((msg, i) => (
                <div
                  key={i}
                  className={`text-xs px-3 py-2 rounded-lg max-w-[90%] ${
                    msg.role === "user"
                      ? "bg-primary/10 text-primary ml-auto text-right"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  disabled={loading}
                  className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 items-end">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex: adicione alerta de trombose, remova medicação X..."
              rows={2}
              className="resize-none text-sm flex-1"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
            />
            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="gradient-primary border-0 text-white h-10 w-10 flex-shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <SendHorizontal className="w-4 h-4" />
              )}
            </Button>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
