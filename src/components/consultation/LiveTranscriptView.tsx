import { useEffect, useRef } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveTranscriptViewProps {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
}

export function LiveTranscriptView({
  transcript,
  interimTranscript,
  isListening,
}: LiveTranscriptViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para o fim conforme o texto cresce
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript, interimTranscript]);

  const hasContent = transcript.length > 0 || interimTranscript.length > 0;

  return (
    <div className="border rounded-lg bg-muted/30 flex flex-col flex-1 min-h-[320px]">
      <div className="flex items-center gap-2 px-4 py-2 border-b text-xs text-muted-foreground shrink-0">
        <Mic
          className={cn(
            "w-3.5 h-3.5",
            isListening ? "text-destructive animate-pulse" : "",
          )}
        />
        <span>Transcrição em tempo real</span>
        {!isListening && hasContent && (
          <span className="ml-auto text-[10px] uppercase tracking-wide">Pausado</span>
        )}
      </div>
      <div
        ref={scrollRef}
        className="px-4 py-3 flex-1 overflow-y-auto text-sm leading-relaxed"
      >
        {hasContent ? (
          <p className="whitespace-pre-wrap">
            <span className="text-foreground">{transcript}</span>
            {interimTranscript && (
              <span className="text-muted-foreground italic">
                {transcript ? " " : ""}
                {interimTranscript}
              </span>
            )}
          </p>
        ) : (
          <p className="text-muted-foreground italic">
            {isListening
              ? "Escutando… comece a falar."
              : "O texto aparecerá aqui conforme você falar."}
          </p>
        )}
      </div>
    </div>
  );
}
