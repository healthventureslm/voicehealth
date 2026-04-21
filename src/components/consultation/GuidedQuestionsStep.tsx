import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, HelpCircle, ChevronRight, SkipForward } from "lucide-react";

export interface MissingField {
  field: string;
  question: string;
  intent_type: string;
}

interface GuidedQuestionsStepProps {
  missingFields: MissingField[];
  onComplete: (answers: Record<string, string>) => void;
  onSkip: () => void;
}

const INTENT_LABEL: Record<string, string> = {
  prescription: "Prescrição",
  medical_evolution: "Evolução Médica",
  icu_evolution: "Evolução UTI",
  nursing_evolution: "Evolução Enfermagem",
  discharge: "Nota de Alta",
  surgical_note: "Nota Operatória",
  interconsult: "Interconsulta",
  hospitalization: "Internação",
  handoff_isbar: "Passagem de Plantão",
  exam_request: "Pedido de Exame",
};

export function GuidedQuestionsStep({
  missingFields,
  onComplete,
  onSkip,
}: GuidedQuestionsStepProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState("");

  const current = missingFields[currentIndex];
  const isLast = currentIndex === missingFields.length - 1;
  const progressPercent = Math.round((currentIndex / missingFields.length) * 100);

  const handleAnswer = () => {
    const key = `${current.intent_type}:${current.field}`;
    const updated = { ...answers, [key]: currentAnswer.trim() };
    setAnswers(updated);
    setCurrentAnswer("");

    if (isLast) {
      onComplete(updated);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleSkipQuestion = () => {
    setCurrentAnswer("");
    if (isLast) {
      onComplete(answers);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  if (!current) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-warning" />
          <h3 className="font-semibold text-base">Informações complementares</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground gap-1">
          <SkipForward className="w-4 h-4" /> Pular tudo
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Algumas informações relevantes não foram encontradas na transcrição. Responda para melhorar a qualidade do documento gerado.
      </p>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-right">
        {currentIndex + 1} de {missingFields.length}
      </p>

      {/* Current question */}
      <Card className="border-warning/30 bg-warning/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-warning/50 text-warning">
              {INTENT_LABEL[current.intent_type] || current.intent_type}
            </Badge>
          </div>
          <CardTitle className="text-base font-medium mt-1">{current.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            placeholder="Digite sua resposta..."
            rows={2}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (currentAnswer.trim()) handleAnswer();
              }
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkipQuestion}
              className="text-muted-foreground"
            >
              Pular
            </Button>
            <Button
              size="sm"
              onClick={handleAnswer}
              disabled={!currentAnswer.trim()}
              className="gap-1 gradient-primary border-0 text-white"
            >
              {isLast ? (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Concluir
                </>
              ) : (
                <>
                  Próximo <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Answered questions preview */}
      {Object.keys(answers).length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Respondidas</p>
          {Object.entries(answers).map(([key, value]) => {
            const [intentType, field] = key.split(":");
            return (
              <div key={key} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-muted-foreground">{INTENT_LABEL[intentType] || intentType} — {field}: </span>
                  <span className="truncate">{value}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
