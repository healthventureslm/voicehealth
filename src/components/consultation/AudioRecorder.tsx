import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";

interface AudioRecorderProps {
  isRecording: boolean;
  duration: number;
  audioBlob: Blob | null;
  onStart: () => void;
  onStop: () => void;
  onRecordingComplete: (mode: "audio") => void;
  onTranscribeOnly: (mode: "audio") => void;
  onReset: () => void;
}

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

export function AudioRecorder({
  isRecording,
  duration,
  audioBlob,
  onStart,
  onStop,
  onRecordingComplete,
  onTranscribeOnly,
  onReset,
}: AudioRecorderProps) {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="text-4xl font-mono font-bold text-foreground tabular-nums">
        {formatTime(duration)}
      </div>
      {!audioBlob ? (
        <Button
          onClick={isRecording ? onStop : onStart}
          className={`w-20 h-20 rounded-full ${isRecording ? "bg-destructive hover:bg-destructive/90" : "gradient-primary hover:opacity-90"} border-0`}
          size="icon"
        >
          {isRecording ? (
            <Square className="w-8 h-8 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </Button>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-success font-medium">
            ✓ Áudio gravado ({formatTime(duration)})
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Button
              onClick={() => onRecordingComplete("audio")}
              className="gap-2 w-full"
            >
              Transcrever + Gerar Relatório
            </Button>
            <Button
              variant="outline"
              onClick={() => onTranscribeOnly("audio")}
              className="gap-2 w-full"
            >
              Apenas Transcrever
            </Button>
            <Button variant="ghost" onClick={onReset} className="w-full">
              Regravar
            </Button>
          </div>
        </div>
      )}
      <p className="text-sm text-muted-foreground text-center">
        {isRecording
          ? "Gravando... Clique para parar."
          : audioBlob
            ? ""
            : "Clique para iniciar a gravação"}
      </p>
    </div>
  );
}
