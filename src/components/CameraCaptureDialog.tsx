// Dialog reusável que pede permissão da câmera, mostra preview e captura
// um frame como File (PNG). Tenta usar a câmera traseira em dispositivos
// móveis (melhor pra documentos).

import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2, AlertCircle } from "lucide-react";

interface CameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  /** Prefixo do nome do arquivo gerado. Default: "documento". */
  filenamePrefix?: string;
}

export function CameraCaptureDialog({
  open,
  onOpenChange,
  onCapture,
  filenamePrefix = "documento",
}: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setIsStarting(true);

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Câmera não disponível neste navegador.");
        setIsStarting(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (e: any) {
        const name = e?.name ?? "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setError("Permissão da câmera negada. Habilite no navegador e tente de novo.");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setError("Nenhuma câmera encontrada neste dispositivo.");
        } else {
          setError(e?.message ?? "Não foi possível acessar a câmera.");
        }
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  function handleSnap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const file = new File([blob], `${filenamePrefix}-${ts}.png`, {
          type: "image/png",
        });
        onCapture(file);
      },
      "image/png",
      0.92,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Tirar foto do documento
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="flex gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/5 text-sm">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative bg-black rounded-md overflow-hidden aspect-video">
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                playsInline
                muted
              />
              {isStarting && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Iniciando câmera…
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Enquadre o documento todo dentro da tela. Boa iluminação melhora a extração.
            </p>
          </div>
        )}

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2">
            <X className="w-4 h-4" />
            Cancelar
          </Button>
          <Button
            onClick={handleSnap}
            disabled={!!error || isStarting}
            className="gap-2 bg-enf hover:bg-enf-hover text-white"
          >
            <Camera className="w-4 h-4" />
            Capturar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
