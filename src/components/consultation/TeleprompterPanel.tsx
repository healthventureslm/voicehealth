import { CheckCircle2, Circle, AlertTriangle, Brain, Sparkles, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef, useState } from "react";
import type { ScriptFieldWithStatus } from "@/hooks/useScriptMatching";

interface TeleprompterPanelProps {
  scriptName: string;
  fields: ScriptFieldWithStatus[];
  isListening: boolean;
}

/** Play a short warning beep using Web Audio API */
function playWarningBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Silently fail if AudioContext is not available
  }
}

/** Play a pleasant success chime */
function playSuccessChime() {
  try {
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.5);
    });
  } catch { /* ignore */ }
}

export function getPendingRequiredFields(fields: ScriptFieldWithStatus[]): ScriptFieldWithStatus[] {
  return fields.filter((f) => f.required && !f.covered);
}

export function checkPendingFields(
  fields: ScriptFieldWithStatus[],
  onAlert: (pendingLabels: string[]) => void
): boolean {
  const pending = getPendingRequiredFields(fields);
  if (pending.length === 0) return true;
  playWarningBeep();
  onAlert(pending.map((f) => f.label));
  return false;
}

/** Confetti particle component — renders from a single origin and flies outward */
function ConfettiPop({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    const colors = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#ec4899", "#06b6d4"];
    const particles = Array.from({ length: 24 }, () => ({
      x: W / 2,
      y: H / 2,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8 - 2,
      r: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      decay: Math.random() * 0.02 + 0.015,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
    }));

    let frame: number;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      particles.forEach((p) => {
        if (p.life <= 0) return;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.life -= p.decay;
        p.rotation += p.rotationSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        ctx.restore();
      });
      if (alive) {
        frame = requestAnimationFrame(draw);
      } else {
        onDone();
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

/** Green pulse ring animation */
function PulseRing() {
  return (
    <span className="absolute inset-0 rounded-md animate-[greenPulse_0.8s_ease-out_forwards] pointer-events-none z-0" />
  );
}

export function TeleprompterPanel({ scriptName, fields, isListening }: TeleprompterPanelProps) {
  const coveredCount = fields.filter((f) => f.covered).length;
  const aiCount = fields.filter((f) => f.source === "ai").length;
  const totalCount = fields.length;
  const allCovered = coveredCount === totalCount && totalCount > 0;
  const pendingRequired = getPendingRequiredFields(fields);
  const hasPendingRequired = pendingRequired.length > 0;

  // Track newly covered fields for animations
  const prevCoveredRef = useRef<Set<string>>(new Set());
  const [newlyCovered, setNewlyCovered] = useState<Set<string>>(new Set());
  const [showConfetti, setShowConfetti] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const prevAllCoveredRef = useRef(false);

  useEffect(() => {
    const currentCovered = new Set(fields.filter((f) => f.covered).map((f) => f.id));
    const justCovered = new Set<string>();
    let hasNewAi = false;

    currentCovered.forEach((id) => {
      if (!prevCoveredRef.current.has(id)) {
        justCovered.add(id);
        const field = fields.find((f) => f.id === id);
        if (field?.source === "ai") hasNewAi = true;
      }
    });

    if (justCovered.size > 0) {
      setNewlyCovered(justCovered);
      // Show confetti for AI-confirmed fields
      if (hasNewAi) {
        const aiField = fields.find((f) => justCovered.has(f.id) && f.source === "ai");
        if (aiField) setShowConfetti(aiField.id);
      }
      // Clear animation after delay
      setTimeout(() => setNewlyCovered(new Set()), 1200);
    }

    // Celebration when all covered for the first time
    if (allCovered && !prevAllCoveredRef.current && totalCount > 0) {
      setShowCelebration(true);
      playSuccessChime();
      setTimeout(() => setShowCelebration(false), 3000);
    }

    prevCoveredRef.current = currentCovered;
    prevAllCoveredRef.current = allCovered;
  }, [fields, allCovered, totalCount]);

  return (
    <div className="flex flex-col h-full rounded-lg border bg-muted/10 p-4 space-y-3 min-h-[280px] relative overflow-hidden">
      {/* Full-panel celebration confetti */}
      {showCelebration && (
        <ConfettiPop onDone={() => setShowCelebration(false)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 relative z-20">
        <h3 className="font-semibold text-sm flex items-center gap-1.5">
          📋 Roteiro
        </h3>
        <div className="flex items-center gap-1.5">
          {aiCount > 0 && (
            <Badge variant="outline" className="text-[10px] gap-0.5 px-1.5 border-primary/30 text-primary">
              <Brain className="w-2.5 h-2.5" /> IA
            </Badge>
          )}
          <Badge
            variant={allCovered ? "default" : "outline"}
            className={`text-xs shrink-0 transition-all duration-500 ${allCovered ? "bg-green-500 text-white animate-[bounceScale_0.5s_ease-out]" : ""}`}
          >
            {coveredCount}/{totalCount}
          </Badge>
        </div>
      </div>

      <p className="text-xs text-muted-foreground truncate relative z-20">{scriptName}</p>

      {/* Live indicator */}
      {isListening && (
        <div className="flex items-center gap-1.5 text-xs text-primary relative z-20">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Escutando em tempo real...
        </div>
      )}

      {/* Pending required warning */}
      {hasPendingRequired && !isListening && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-2.5 animate-fade-in relative z-20">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
          <div className="text-xs text-destructive">
            <span className="font-medium">{pendingRequired.length} campo(s) obrigatório(s) pendente(s)</span>
            <ul className="mt-1 list-disc list-inside">
              {pendingRequired.map((f) => (
                <li key={f.id}>{f.label}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Fields checklist */}
      <ScrollArea className="flex-1 relative z-20">
        <div className="space-y-1.5 pr-1">
          {fields.map((field) => {
            const isNew = newlyCovered.has(field.id);
            const isAiNew = isNew && field.source === "ai";

            return (
              <div
                key={field.id}
                className={`relative flex items-start gap-2 p-2 rounded-md transition-all duration-500 ${
                  field.covered
                    ? field.source === "ai"
                      ? "bg-primary/10 ring-1 ring-primary/20"
                      : "bg-green-500/10"
                    : "bg-background border border-border/50"
                } ${isNew ? "scale-[1.02]" : ""}`}
                style={isNew ? { transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" } : undefined}
              >
                {/* Green pulse ring for newly covered fields */}
                {isNew && !isAiNew && <PulseRing />}

                {/* Mini confetti for AI-confirmed fields */}
                {isAiNew && showConfetti === field.id && (
                  <ConfettiPop onDone={() => setShowConfetti(null)} />
                )}

                {field.covered ? (
                  field.source === "ai" ? (
                    <Sparkles className={`w-4 h-4 mt-0.5 shrink-0 text-primary relative z-10 ${isAiNew ? "animate-[sparkSpin_0.8s_ease-out]" : ""}`} />
                  ) : (
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 text-green-500 relative z-10 ${isNew ? "animate-[popIn_0.4s_cubic-bezier(0.34,1.56,0.64,1)]" : ""}`} />
                  )
                ) : (
                  <Circle className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground relative z-10" />
                )}
                <span
                  className={`text-sm flex-1 leading-snug transition-all duration-300 relative z-10 ${
                    field.covered
                      ? field.source === "ai"
                        ? "text-primary font-medium"
                        : "line-through text-muted-foreground"
                      : "text-foreground"
                  }`}
                >
                  {field.label}
                </span>
                <div className="flex items-center gap-1 shrink-0 relative z-10">
                  {field.covered && field.source === "ai" && (
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 border-primary/30 text-primary gap-0.5 ${isAiNew ? "animate-[popIn_0.4s_cubic-bezier(0.34,1.56,0.64,1)]" : ""}`}>
                      <Brain className="w-2 h-2" /> IA
                    </Badge>
                  )}
                  {field.required && !field.covered && (
                    <Badge variant="destructive" className="text-[10px] px-1 py-0">
                      *
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      {!isListening && !allCovered && (
        <p className="text-xs text-muted-foreground text-center relative z-20">
          Inicie a gravação para ativar o roteiro
        </p>
      )}
      {allCovered && (
        <div className="flex items-center justify-center gap-2 text-xs text-green-600 dark:text-green-400 font-semibold animate-fade-in relative z-20">
          <PartyPopper className="w-4 h-4 animate-[popIn_0.5s_cubic-bezier(0.34,1.56,0.64,1)]" />
          Todos os campos cobertos! 🎉
        </div>
      )}
    </div>
  );
}
