import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Pause, Play, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type RecordingState =
  | "idle"
  | "recording"
  | "paused"      // pausa rápida — sem preview, só resume
  | "reviewing"   // pausa pra revisar — preview + 3 ações (continuar/usar/descartar)
  | "stopped";    // mantido só pra retrocompatibilidade externa (não usado internamente)

interface AudioRecorderProps {
  onComplete: (blob: Blob, durationSeconds: number) => void;
  onStateChange?: (state: RecordingState) => void;
  disabled?: boolean;
}

type StopIntent = "none" | "confirm" | "discard";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function AudioRecorder({ onComplete, onStateChange, disabled }: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Notifica consumidor a cada mudança de estado
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0); // sincronizado com state.duration; usado em closures
  const previewUrlRef = useRef<string | null>(null); // idem, pra usar em onstop
  const intentRef = useRef<StopIntent>("none");

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  function setPreview(url: string | null) {
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }

  function buildPreviewFromChunks() {
    if (chunksRef.current.length === 0) return;
    const mimeType = chunksRef.current[0].type || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    setPreview(URL.createObjectURL(blob));
  }

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
      durationRef.current = 0;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        // Tracks só são liberadas em finalize/discard — não no review
        stream.getTracks().forEach((t) => t.stop());

        const intent = intentRef.current;
        intentRef.current = "none";

        if (intent === "confirm") {
          const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
          onComplete(blob, durationRef.current);
        } else if (intent === "discard") {
          if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
          setPreview(null);
          chunksRef.current = [];
          durationRef.current = 0;
          setDuration(0);
          setState("idle");
        }
        // intent "none" — nunca acontece com o fluxo novo (review usa pause, não stop)
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

  /**
   * "Parar" / "Finalizar" → vai pra estado de revisão sem encerrar o stream.
   * O usuário pode continuar gravando (resumeFromReview), usar (finalize) ou descartar.
   * Usa `requestData()` pra forçar flush dos chunks bufferados antes de montar o preview.
   */
  async function review() {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (mr.state === "recording") mr.pause();
    stopTimer();
    try {
      // Flush — garante que chunks recentes apareçam no preview
      mr.requestData();
      await new Promise<void>((r) => setTimeout(r, 80));
    } catch {
      // Em alguns browsers requestData lança se já estiver inactive — ignora
    }
    buildPreviewFromChunks();
    setState("reviewing");
  }

  function resumeFromReview() {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    setPreview(null);
    if (mr.state === "paused") mr.resume();
    setState("recording");
    startTimer();
  }

  function finalize() {
    const mr = mediaRecorderRef.current;
    if (!mr) {
      // Sem recorder ativo — usa preview já existente (não deve ocorrer)
      return;
    }
    intentRef.current = "confirm";
    if (mr.state !== "inactive") {
      mr.stop(); // dispara onstop, que chama onComplete com blob completo
    }
    stopTimer();
  }

  function discard() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      intentRef.current = "discard";
      mr.stop(); // onstop limpa tudo
    } else {
      // Recorder já parou ou nunca existiu — limpa direto
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      setPreview(null);
      chunksRef.current = [];
      durationRef.current = 0;
      setDuration(0);
      setState("idle");
    }
    stopTimer();
  }

  return (
    <div className="border rounded-lg p-6 space-y-4 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-3 h-3 rounded-full",
              state === "recording" ? "bg-destructive animate-pulse" : "bg-muted",
            )}
          />
          <span className="text-2xl font-mono tabular-nums">{formatDuration(duration)}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {state === "idle" && "Pronto pra gravar"}
          {state === "recording" && "Gravando…"}
          {state === "paused" && "Pausado"}
          {state === "reviewing" && "Revisando — você pode continuar gravando"}
        </span>
      </div>

      {previewUrl && state === "reviewing" && (
        <audio
          controls
          src={previewUrl}
          className="w-full"
          onLoadedMetadata={(e) => {
            // MediaRecorder em webm não escreve duration no header; o browser
            // só descobre o tamanho real após escanear o arquivo. Forçamos um
            // seek pra um ponto além do fim — isso dispara o scan.
            const a = e.currentTarget;
            if (!Number.isFinite(a.duration)) {
              a.currentTime = 1e9;
            }
          }}
          onDurationChange={(e) => {
            const a = e.currentTarget;
            if (Number.isFinite(a.duration) && a.currentTime > 0) {
              a.currentTime = 0;
            }
          }}
        />
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
            <Button onClick={review} variant="destructive" className="gap-2">
              <Square className="w-4 h-4" /> Parar
            </Button>
          </>
        )}
        {state === "paused" && (
          <>
            <Button onClick={resume} className="gap-2">
              <Play className="w-4 h-4" /> Continuar
            </Button>
            <Button onClick={review} variant="destructive" className="gap-2">
              <Square className="w-4 h-4" /> Parar
            </Button>
          </>
        )}
        {state === "reviewing" && (
          <>
            <Button onClick={resumeFromReview} variant="outline" className="gap-2">
              <Mic className="w-4 h-4" /> Continuar gravando
            </Button>
            <Button onClick={finalize} className="gap-2">
              <Check className="w-4 h-4" /> Usar esta gravação
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
