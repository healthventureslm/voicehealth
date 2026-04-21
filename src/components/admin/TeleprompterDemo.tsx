import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TeleprompterPanel } from "@/components/consultation/TeleprompterPanel";
import { useScriptMatching, type ScriptField } from "@/hooks/useScriptMatching";
import { Play, Pause, RotateCcw, Pencil, Wand2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TeleprompterDemoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scriptName: string;
  fields: ScriptField[];
}

const TYPING_SPEED_MS = 40; // ms per character

/**
 * Simulation dialog: progressively "types" a transcription while
 * the TeleprompterPanel reacts in real-time — letting admins preview
 * how the teleprompter behaves before publishing the script.
 */
export function TeleprompterDemo({ open, onOpenChange, scriptName, fields }: TeleprompterDemoProps) {
  const [fullText, setFullText] = useState("");
  const [currentText, setCurrentText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showEditor, setShowEditor] = useState(true);
  const posRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fieldsWithStatus = useScriptMatching(fields, currentText);

  // Generate a mock transcription from the script fields using AI
  const generateMockTranscription = useCallback(async () => {
    setIsGenerating(true);
    try {
      const fieldList = fields
        .map((f) => `- ${f.label}${f.required ? " (obrigatório)" : ""}`)
        .join("\n");

      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: {
          transcription: `Gere uma transcrição médica fictícia de exemplo (150-250 palavras) que cubra os seguintes campos de um roteiro clínico:\n\n${fieldList}\n\nA transcrição deve simular a fala natural de um médico durante uma consulta, incluindo termos técnicos e linguagem coloquial. NÃO adicione título ou formatação — apenas o texto corrido da fala.`,
          template: "Retorne APENAS o texto da transcrição fictícia, sem markdown, sem título, sem formatação.",
          customPrompt: "Você é um simulador de transcrição médica. Gere texto corrido simulando fala natural de um profissional de saúde.",
        },
      });

      if (error) throw error;
      const text = data?.report || data?.content || "";
      if (!text.trim()) throw new Error("Resposta vazia");
      setFullText(text.trim());
      toast.success("Transcrição de exemplo gerada!");
    } catch (err: any) {
      toast.error("Erro ao gerar exemplo: " + (err.message || "Tente novamente"));
    } finally {
      setIsGenerating(false);
    }
  }, [fields]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setCurrentText("");
      setFullText("");
      posRef.current = 0;
      setIsPlaying(false);
      setShowEditor(true);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open]);

  // Typing animation
  useEffect(() => {
    if (isPlaying && fullText) {
      intervalRef.current = setInterval(() => {
        posRef.current += 1;
        if (posRef.current >= fullText.length) {
          setCurrentText(fullText);
          setIsPlaying(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
          return;
        }
        // Advance to the end of the current word for smoother reading
        let end = posRef.current;
        while (end < fullText.length && fullText[end] !== " " && fullText[end] !== "," && fullText[end] !== ".") {
          end++;
        }
        posRef.current = end;
        setCurrentText(fullText.slice(0, posRef.current));
      }, TYPING_SPEED_MS * 3);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, fullText]);

  const handlePlay = () => {
    if (!fullText.trim()) {
      toast.error("Escreva ou gere uma transcrição primeiro");
      return;
    }
    setShowEditor(false);
    setIsPlaying(true);
  };

  const handlePause = () => setIsPlaying(false);

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentText("");
    posRef.current = 0;
    setShowEditor(true);
  };

  const coveredCount = fieldsWithStatus.filter((f) => f.covered).length;
  const progress = fields.length > 0 ? Math.round((coveredCount / fields.length) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🎬 Simulação do Teleprompter
            <Badge variant="outline" className="text-xs">Demo</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Left: transcription input / live text */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Transcrição Simulada</h4>
              <div className="flex items-center gap-1">
                {showEditor && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateMockTranscription}
                    disabled={isGenerating}
                    className="gap-1 text-xs"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3" />
                    )}
                    Gerar com IA
                  </Button>
                )}
              </div>
            </div>

            {showEditor ? (
              <Textarea
                value={fullText}
                onChange={(e) => setFullText(e.target.value)}
                placeholder="Cole ou digite uma transcrição fictícia para testar o roteiro, ou clique em 'Gerar com IA' para criar uma automaticamente..."
                className="min-h-[260px] text-sm"
              />
            ) : (
              <div className="rounded-md border bg-muted/20 p-3 min-h-[260px] max-h-[350px] overflow-y-auto">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {currentText}
                  {isPlaying && <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
                </p>
                {!isPlaying && currentText && (
                  <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
                    Simulação {posRef.current >= fullText.length ? "concluída" : "pausada"}
                  </p>
                )}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-2">
              {!isPlaying ? (
                <Button onClick={handlePlay} size="sm" className="gap-1" disabled={!fullText.trim()}>
                  <Play className="w-3 h-3" />
                  {currentText ? "Continuar" : "Iniciar Simulação"}
                </Button>
              ) : (
                <Button onClick={handlePause} size="sm" variant="secondary" className="gap-1">
                  <Pause className="w-3 h-3" /> Pausar
                </Button>
              )}
              {(currentText || !showEditor) && (
                <>
                  <Button onClick={handleReset} size="sm" variant="outline" className="gap-1">
                    <RotateCcw className="w-3 h-3" /> Reiniciar
                  </Button>
                  {!showEditor && !isPlaying && (
                    <Button onClick={() => setShowEditor(true)} size="sm" variant="ghost" className="gap-1">
                      <Pencil className="w-3 h-3" /> Editar
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Progress */}
            {currentText && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Cobertura do script</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right: live teleprompter */}
          <div>
            <TeleprompterPanel
              scriptName={scriptName}
              fields={fieldsWithStatus}
              isListening={isPlaying}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
