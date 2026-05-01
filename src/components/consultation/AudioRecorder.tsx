import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Pause, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  onComplete: (blob: Blob, durationSeconds: number) => void;
  disabled?: boolean;
}

type RecordingState = "idle" | "recording" | "paused" | "stopped";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function AudioRecorder({ onComplete, disabled }: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobRef = useRef<Blob | null>(null);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        blobRef.current = blob;
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start(250);
      mediaRecorderRef.current = mr;
      setDuration(0);
      setState("recording");
      startTimer();
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível acessar o microfone.");
    }
  }

  function pause() {
    mediaRecorderRef.current?.pause();
    stopTimer();
    setState("paused");
  }
  function resume() {
    mediaRecorderRef.current?.resume();
    startTimer();
    setState("recording");
  }
  function stop() {
    mediaRecorderRef.current?.stop();
    stopTimer();
    setState("stopped");
  }
  function discard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    chunksRef.current = [];
    setDuration(0);
    setState("idle");
  }
  function confirm() {
    if (blobRef.current) onComplete(blobRef.current, duration);
  }

  return (
    <div className="border rounded-lg p-6 space-y-4 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-3 h-3 rounded-full",
              state === "recording" ? "bg-red-500 animate-pulse" : "bg-muted",
            )}
          />
          <span className="text-2xl font-mono tabular-nums">{formatDuration(duration)}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {state === "idle" && "Pronto pra gravar"}
          {state === "recording" && "Gravando…"}
          {state === "paused" && "Pausado"}
          {state === "stopped" && "Gravação finalizada"}
        </span>
      </div>

      {previewUrl && state === "stopped" && (
        <audio controls src={previewUrl} className="w-full" />
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {state === "idle" && (
          <Button onClick={start} disabled={disabled} className="gap-2">
            <Mic className="w-4 h-4" /> Iniciar gravação
          </Button>
        )}
        {state === "recording" && (
          <>
            <Button onClick={pause} variant="outline" className="gap-2">
              <Pause className="w-4 h-4" /> Pausar
            </Button>
            <Button onClick={stop} variant="destructive" className="gap-2">
              <Square className="w-4 h-4" /> Parar
            </Button>
          </>
        )}
        {state === "paused" && (
          <>
            <Button onClick={resume} className="gap-2">
              <Play className="w-4 h-4" /> Continuar
            </Button>
            <Button onClick={stop} variant="destructive" className="gap-2">
              <Square className="w-4 h-4" /> Finalizar
            </Button>
          </>
        )}
        {state === "stopped" && (
          <>
            <Button onClick={confirm} className="gap-2">
              Usar esta gravação
            </Button>
            <Button onClick={discard} variant="ghost" className="gap-2">
              <Trash2 className="w-4 h-4" /> Descartar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
