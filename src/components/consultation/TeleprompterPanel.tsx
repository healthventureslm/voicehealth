import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScriptFieldWithStatus } from "@/hooks/useScriptMatching";

interface TeleprompterPanelProps {
  scriptName: string;
  fields: ScriptFieldWithStatus[];
  isListening: boolean;
}

export function TeleprompterPanel({
  scriptName,
  fields,
  isListening,
}: TeleprompterPanelProps) {
  const total = fields.length;
  const coveredCount = fields.filter((f) => f.covered).length;
  const allCovered = total > 0 && coveredCount === total;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="heading-card text-base">Roteiro</CardTitle>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {coveredCount}/{total} cobertos
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{scriptName}</p>
        <div className="flex items-center gap-2 mt-2">
          {isListening ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
              <Mic className="w-3.5 h-3.5 animate-pulse" />
              Escutando
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <MicOff className="w-3.5 h-3.5" />
              Inicie a gravação para ver os pontos sendo riscados
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {fields.map((f) => (
          <div
            key={f.id}
            className={cn(
              "flex items-start gap-2 text-sm rounded-md px-2 py-1.5 transition-colors",
              f.covered ? "bg-success/5" : "bg-transparent",
            )}
          >
            {f.covered ? (
              <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <span
              className={cn(
                "flex-1 leading-snug",
                f.covered && "line-through text-muted-foreground",
              )}
            >
              {f.label}
            </span>
            {f.required && !f.covered && (
              <span
                className="text-destructive font-bold text-sm leading-none"
                title="Campo obrigatório"
                aria-label="Campo obrigatório"
              >
                *
              </span>
            )}
          </div>
        ))}
        {allCovered && (
          <p className="text-sm text-success font-medium pt-2 text-center">
            ✓ Todos os campos cobertos
          </p>
        )}
      </CardContent>
    </Card>
  );
}
