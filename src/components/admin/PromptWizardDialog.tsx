import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Send, ImagePlus, Copy, Check, RefreshCw, X, Loader2, Bot, User, Mic, Square,
  History, Plus, Trash2, MessageSquare, Upload, Brain, Users, ArrowRight, ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ScriptField {
  id: string;
  label: string;
  required: boolean;
  keywords: string[];
}

type MessageContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

interface ChatMessage {
  role: "user" | "assistant";
  content: MessageContent;
}

interface WizardSession {
  id: string;
  context_type: string;
  context_name: string | null;
  messages: ChatMessage[];
  status: string;
  question_number: number;
  generated_prompt: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPromptGenerated: (prompt: string, scriptFields?: ScriptField[]) => void;
  contextType: "specialty" | "template" | "protocol";
  contextName?: string;
  contextDescription?: string;
}

const WIZARD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prompt-wizard`;
const TRANSCRIBE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`;
const PARSE_SCRIPT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-script-fields`;

function parseQuestionNumber(text: string): number | null {
  const match = text.match(/\[QUESTION\s+(\d+)\/(\d+)\]/);
  return match ? parseInt(match[1], 10) : null;
}

function parseQuestionTotal(text: string): number {
  const matches = [...text.matchAll(/\[QUESTION\s+\d+\/(\d+)\]/g)];
  if (matches.length > 0) return parseInt(matches[matches.length - 1][1], 10);
  return 10;
}

function extractFinalPrompt(text: string): string | null {
  const idx = text.indexOf("[FINAL_PROMPT]");
  if (idx === -1) return null;
  return text.slice(idx + "[FINAL_PROMPT]".length).trim();
}

export function PromptWizardDialog({
  open, onOpenChange, onPromptGenerated, contextType, contextName, contextDescription,
}: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [questionNum, setQuestionNum] = useState(0);
  const [questionTotal, setQuestionTotal] = useState(10);
  const [finalPrompt, setFinalPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<WizardSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scriptFields, setScriptFields] = useState<ScriptField[]>([]);
  const [parsingScript, setParsingScript] = useState(false);
  const scriptParsedRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  // Save session to DB (debounced)
  const saveSession = useCallback((msgs: ChatMessage[], qNum: number, prompt: string | null, sessionId: string | null) => {
    if (!user?.id) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      // Count images per message for context preservation
      let imgCount = 0;
      const cleanMessages = msgs.map(m => {
        if (typeof m.content === "string") return m;
        return {
          ...m,
          content: m.content.map(c => {
            if (c.type === "image_url") {
              imgCount++;
              return { type: "text" as const, text: `[imagem ${imgCount} enviada — análise detalhada na resposta do assistente abaixo]` };
            }
            return c;
          }),
        };
      });

      const payload = {
        user_id: user.id,
        context_type: contextType,
        context_name: contextName || null,
        context_description: contextDescription || null,
        messages: JSON.parse(JSON.stringify(cleanMessages)),
        status: prompt ? "completed" : "in_progress",
        question_number: qNum,
        generated_prompt: prompt,
      };

      if (sessionId) {
        await (supabase.from("prompt_wizard_sessions").update(payload) as any).eq("id", sessionId);
      } else {
        const { data } = await (supabase.from("prompt_wizard_sessions").insert(payload) as any).select("id").single();
        if (data) setCurrentSessionId(data.id);
      }
    }, 1500);
  }, [user?.id, contextType, contextName, contextDescription]);

  // Load saved sessions
  const loadSessions = useCallback(async () => {
    if (!user?.id) return;
    setLoadingSessions(true);
    const { data } = await supabase
      .from("prompt_wizard_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("context_type", contextType)
      .order("updated_at", { ascending: false })
      .limit(20);
    setSessions((data as unknown as WizardSession[]) || []);
    setLoadingSessions(false);
  }, [user?.id, contextType]);

  // Resume a session
  const resumeSession = (session: WizardSession) => {
    const msgs = session.messages as ChatMessage[];
    setMessages(msgs);
    setQuestionNum(session.question_number);
    setFinalPrompt(session.generated_prompt);
    setCurrentSessionId(session.id);
    setShowHistory(false);
    setShowOnboarding(false);
    startedRef.current = true;
    scrollToBottom();
  };

  // Delete a session
  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("prompt_wizard_sessions").delete().eq("id", id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) setCurrentSessionId(null);
    toast.success("Sessão removida");
  };

  // Start new session
  const startNewSession = () => {
    setMessages([]);
    setQuestionNum(0);
    setFinalPrompt(null);
    setCurrentSessionId(null);
    startedRef.current = false;
    setShowHistory(false);
  };

  const startChat = () => {
    setShowOnboarding(false);
    if (messages.length === 0 && !startedRef.current) {
      startedRef.current = true;
      const initialUserMsg: ChatMessage = {
        role: "user",
        content: `Quero criar um prompt para ${contextType === "specialty" ? "uma especialidade médica" : contextType === "template" ? "um template de relatório" : "um protocolo clínico"}.${contextName ? ` Nome: ${contextName}.` : ""}${contextDescription ? ` Descrição: ${contextDescription}.` : ""}`,
      };
      setMessages([initialUserMsg]);
      streamResponse([initialUserMsg]);
    }
  };

  // Start wizard on open (skip onboarding if resuming)
  useEffect(() => {
    if (open && messages.length === 0 && !startedRef.current && !showHistory && !showOnboarding) {
      startChat();
    }
  }, [open, showHistory, showOnboarding]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      stopRecording();
      setMessages([]);
      setInput("");
      setIsStreaming(false);
      setQuestionNum(0);
      setQuestionTotal(10);
      setFinalPrompt(null);
      setScriptFields([]);
      setParsingScript(false);
      scriptParsedRef.current = false;
      setCopied(false);
      setImages([]);
      setIsRecording(false);
      setIsTranscribing(false);
      setRecordingTime(0);
      setShowHistory(false);
      setCurrentSessionId(null);
      setShowOnboarding(true);
      startedRef.current = false;
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Load sessions when history is shown
  useEffect(() => {
    if (showHistory) loadSessions();
  }, [showHistory, loadSessions]);

  // Auto-parse script fields when final prompt is generated
  useEffect(() => {
    if (!finalPrompt || scriptParsedRef.current || parsingScript) return;
    scriptParsedRef.current = true;
    setParsingScript(true);
    (async () => {
      try {
        const resp = await fetch(PARSE_SCRIPT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ description: finalPrompt, sector: contextName || "" }),
        });
        if (!resp.ok) throw new Error("Erro ao extrair campos");
        const data = await resp.json();
        if (data.fields?.length) {
          setScriptFields(data.fields);
        }
      } catch (e) {
        console.error("Auto-parse script error:", e);
      }
      setParsingScript(false);
    })();
  }, [finalPrompt]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : undefined;
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setRecordingTime(0);

        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        if (blob.size < 1000) {
          toast.error("Gravação muito curta");
          return;
        }
        await transcribeAudio(blob);
      };

      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const resp = await fetch(TRANSCRIBE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ audio_base64: base64, content_type: blob.type || "audio/webm" }),
      });

      if (!resp.ok) throw new Error("Falha na transcrição");
      const data = await resp.json();
      const text = data.transcription || data.text || "";
      if (text.trim()) {
        setInput((prev) => (prev ? prev + " " + text.trim() : text.trim()));
        toast.success("Áudio transcrito!");
      } else {
        toast.error("Não foi possível transcrever o áudio");
      }
    } catch {
      toast.error("Erro ao transcrever áudio");
    }
    setIsTranscribing(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const streamResponse = async (msgs: ChatMessage[]) => {
    setIsStreaming(true);
    let assistantText = "";

    try {
      const resp = await fetch(WIZARD_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
          context: { type: contextType, name: contextName, description: contextDescription },
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        toast.error(err.error || `Erro ${resp.status}`);
        setIsStreaming(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let latestQn = questionNum;
      let latestFp = finalPrompt;

      const upsertAssistant = (text: string) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: text } : m));
          }
          return [...prev, { role: "assistant", content: text }];
        });
        scrollToBottom();
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              upsertAssistant(assistantText);
              const qn = parseQuestionNumber(assistantText);
              if (qn) { setQuestionNum(qn); latestQn = qn; }
              const qt = parseQuestionTotal(assistantText);
              if (qt) setQuestionTotal(qt);
              const fp = extractFinalPrompt(assistantText);
              if (fp) { setFinalPrompt(fp); latestFp = fp; }
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // flush remaining
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw || raw.startsWith(":") || raw.trim() === "" || !raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              upsertAssistant(assistantText);
            }
          } catch {}
        }
      }

      // Final checks
      const qn = parseQuestionNumber(assistantText);
      if (qn) { setQuestionNum(qn); latestQn = qn; }
      const qt = parseQuestionTotal(assistantText);
      if (qt) setQuestionTotal(qt);
      const fp = extractFinalPrompt(assistantText);
      if (fp) { setFinalPrompt(fp); latestFp = fp; }

      // Auto-save after stream completes
      setMessages(prev => {
        saveSession(prev, latestQn, latestFp, currentSessionId);
        return prev;
      });
    } catch (e) {
      console.error("Stream error:", e);
      toast.error("Erro na comunicação com IA");
    }
    setIsStreaming(false);
  };

  const handleSend = () => {
    if (!input.trim() && images.length === 0) return;
    const content: MessageContent =
      images.length > 0
        ? [
            ...(input.trim() ? [{ type: "text" as const, text: input.trim() }] : []),
            ...images.map((img) => ({ type: "image_url" as const, image_url: { url: img } })),
          ]
        : input.trim();
    const userMsg: ChatMessage = { role: "user", content };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setImages([]);
    scrollToBottom();
    streamResponse(newMsgs);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
    if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} é muito grande (máx 10MB)`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleRefine = () => {
    setFinalPrompt(null);
    setScriptFields([]);
    scriptParsedRef.current = false;
    setInput("Quero refinar o prompt. ");
  };

  const handleAccept = () => {
    if (finalPrompt) {
      if (currentSessionId) {
        (supabase
          .from("prompt_wizard_sessions")
          .update({ status: "completed", generated_prompt: finalPrompt }) as any)
          .eq("id", currentSessionId)
          .then();
      }
      onPromptGenerated(finalPrompt, scriptFields.length > 0 ? scriptFields : undefined);
      onOpenChange(false);
      toast.success("Prompt e script aplicados com sucesso!");
    }
  };

  const handleCopy = () => {
    if (finalPrompt) {
      navigator.clipboard.writeText(finalPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const contextLabel =
    contextType === "specialty" ? "Especialidade" : contextType === "template" ? "Template" : "Protocolo";

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-semibold">Wizard de Prompt</span>
            <Badge variant="secondary" className="text-xs">{contextLabel}</Badge>
          </div>
          <div className="flex items-center gap-3">
            {questionNum > 0 && !finalPrompt && !showHistory && (
              <div className="flex items-center gap-2 w-40">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{questionNum}/{questionTotal}</span>
                <Progress value={(questionNum / questionTotal) * 100} className="h-2" />
              </div>
            )}
            {finalPrompt && !showHistory && <Badge className="bg-success text-success-foreground">Prompt Pronto</Badge>}
            <Button
              variant={showHistory ? "default" : "outline"}
              size="sm"
              className="gap-1"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="w-3 h-3" />
              <span className="hidden sm:inline">Histórico</span>
            </Button>
          </div>
        </div>

        {/* Onboarding screen */}
        {showOnboarding && !showHistory ? (
          <div className="flex-1 overflow-auto px-6 py-8 flex flex-col items-center justify-center">
            <div className="max-w-md w-full space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Como funciona o Wizard de Prompts</h2>
                <p className="text-sm text-muted-foreground">
                  O assistente vai guiar você para criar prompts otimizados que geram documentos clínicos a partir de gravações de áudio.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">1. Responda perguntas</p>
                    <p className="text-xs text-muted-foreground">O assistente analisa imagens e faz perguntas para entender o documento.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">2. 📸 Envie fotos de modelos</p>
                    <p className="text-xs text-muted-foreground">Fotografe fichas, laudos ou formulários existentes. A IA lê a imagem e gera o prompt automaticamente!</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Brain className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">3. IA analisa e interpreta</p>
                    <p className="text-xs text-muted-foreground">A IA identifica campos, seções, tabelas e estrutura do documento para criar o prompt perfeito.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">4. Atribua a profissionais</p>
                    <p className="text-xs text-muted-foreground">Cada documento gerado será vinculado a um ou mais tipos de profissional (médico, enfermeiro, etc.). Quando o profissional gravar, ele escolhe quais relatórios gerar.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => startChat()}>
                  Pular
                </Button>
                <Button className="flex-1 gap-2" onClick={() => startChat()}>
                  Começar <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : showHistory ? (
          <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Sessões Anteriores</h3>
              <Button variant="outline" size="sm" className="gap-1" onClick={startNewSession}>
                <Plus className="w-3 h-3" /> Nova Sessão
              </Button>
            </div>
            {loadingSessions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Nenhuma sessão salva ainda
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => resumeSession(s)}
                    className={`w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors ${
                      currentSessionId === s.id ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={s.status === "completed" ? "default" : "secondary"} className="text-xs">
                          {s.status === "completed" ? "Concluído" : `Pergunta ${s.question_number}/10`}
                        </Badge>
                        {s.context_name && (
                          <span className="text-sm font-medium truncate max-w-[200px]">{s.context_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatDate(s.updated_at)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => deleteSession(s.id, e)}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {s.generated_prompt && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {s.generated_prompt.slice(0, 100)}...
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Chat area */}
            <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef as any}>
              <div className="space-y-4 pb-2">
                {messages.slice(1).map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {typeof msg.content === "string" ? (
                        msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1">
                            <ReactMarkdown>{msg.content.replace(/\[QUESTION \d+\/\d+\]\s*/g, "").replace(/\[FINAL_PROMPT\]\s*/g, "")}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )
                      ) : (
                        <div className="space-y-2">
                          {msg.content.map((c, j) =>
                            c.type === "text" ? (
                              <p key={j} className="whitespace-pre-wrap">{c.text}</p>
                            ) : (
                              <img key={j} src={c.image_url.url} alt="upload" className="max-w-[200px] rounded" />
                            )
                          )}
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
                {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Final prompt actions */}
            {finalPrompt && (
              <div className="px-4 py-3 border-t bg-success/10 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-success">
                  <Check className="w-4 h-4" /> Prompt gerado com sucesso!
                </div>

                {/* Script fields preview */}
                {parsingScript && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Extraindo campos do teleprompter...
                  </div>
                )}
                {scriptFields.length > 0 && (
                  <div className="rounded-md border bg-background p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <ListChecks className="w-3.5 h-3.5 text-primary" />
                      Script do Teleprompter ({scriptFields.length} campos)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {scriptFields.map((f) => (
                        <div key={f.id} className="flex items-center gap-1.5 text-xs">
                          <Checkbox checked disabled className="h-3 w-3" />
                          <span className={f.required ? "font-medium" : "text-muted-foreground"}>
                            {f.label}
                          </span>
                          {f.required && <Badge variant="secondary" className="text-[10px] px-1 py-0">obrigatório</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleAccept} className="gap-1 flex-1" disabled={parsingScript}>
                    <Check className="w-4 h-4" /> Usar prompt {scriptFields.length > 0 ? "+ script" : ""}
                  </Button>
                  <Button variant="outline" onClick={handleRefine} className="gap-1">
                    <RefreshCw className="w-4 h-4" /> Refinar
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Input area */}
            {!finalPrompt && (
              <div className="px-4 py-3 border-t space-y-2">
                {images.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {images.map((img, i) => (
                      <div key={i} className="relative">
                        <img src={img} alt="" className="w-16 h-16 object-cover rounded border" />
                        <button
                          onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {isRecording && (
                  <div className="flex items-center gap-2 text-sm text-destructive animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    Gravando... {formatTime(recordingTime)}
                  </div>
                )}
                {isTranscribing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Transcrevendo áudio...
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => fileRef.current?.click()}
                    disabled={isStreaming || isRecording || isTranscribing}
                  >
                    <ImagePlus className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={isRecording ? "destructive" : "outline"}
                    size="icon"
                    className="shrink-0"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isStreaming || isTranscribing}
                  >
                    {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Digite, grave áudio ou envie imagens..."
                    className="min-h-[44px] max-h-[120px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={isStreaming || isRecording || isTranscribing}
                  />
                  <Button
                    size="icon"
                    className="shrink-0"
                    onClick={handleSend}
                    disabled={isStreaming || isRecording || isTranscribing || (!input.trim() && images.length === 0)}
                  >
                    {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
