import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Layers } from "lucide-react";

export interface SessionTranscription {
  id: string;
  text: string;
  created_at: string;
  selected: boolean;
}

interface TranscriptionResultProps {
  sessionTranscriptions: SessionTranscription[];
  onToggleSelection: (id: string) => void;
  onConsolidatedReport: () => void;
}

export function TranscriptionResult({
  sessionTranscriptions,
  onToggleSelection,
  onConsolidatedReport,
}: TranscriptionResultProps) {
  const navigate = useNavigate();
  const selectedCount = sessionTranscriptions.filter((t) => t.selected).length;

  if (sessionTranscriptions.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {sessionTranscriptions.length} transcrição(ões) anteriores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {sessionTranscriptions.slice(0, 5).map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-2 p-2 rounded-md bg-muted/50 text-sm"
          >
            <Checkbox
              checked={t.selected}
              onCheckedChange={() => onToggleSelection(t.id)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                {new Date(t.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="line-clamp-2 text-xs">
                {(t as any).ai_summary || t.text.slice(0, 120)}
              </p>
            </div>
          </div>
        ))}
        {selectedCount >= 2 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 mt-2"
            onClick={onConsolidatedReport}
          >
            <Layers className="w-4 h-4" />
            Gerar Relatório Consolidado ({selectedCount} selecionadas)
          </Button>
        )}
        <Button
          variant="link"
          size="sm"
          className="w-full text-xs"
          onClick={() => navigate("/gravacoes")}
        >
          Ver todas as gravações →
        </Button>
      </CardContent>
    </Card>
  );
}
