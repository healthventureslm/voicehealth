// Passo "Conversar com IA": SchemaChat + preview ao vivo side-by-side.
// Quando admin tá satisfeito, clica "Continuar" → vai pra TemplateReviewStep
// pra editar metadata e salvar.

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, ArrowRight } from "lucide-react";
import { SchemaChat } from "./SchemaChat";
import { StructuredReportView } from "@/components/templates/StructuredReportView";
import type { TemplateSchema } from "@/templates/types";

interface ChatBuilderStepProps {
  onProceed: (schema: TemplateSchema) => void;
  onBack: () => void;
}

export function ChatBuilderStep({ onProceed, onBack }: ChatBuilderStepProps) {
  const [schema, setSchema] = useState<TemplateSchema | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">Conversar com a IA</h2>
        <p className="text-sm text-muted-foreground">
          Descreva o template em texto ou anexe um documento. A IA vai montando
          o formulário aqui à direita. Você pode pedir ajustes a qualquer momento.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-[600px]">
          <SchemaChat
            schema={schema}
            onSchemaUpdate={setSchema}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview ao vivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md p-3 bg-muted/10 h-[500px] overflow-y-auto">
              {schema ? (
                <StructuredReportView schema={schema} value={{}} readOnly />
              ) : (
                <div className="text-center text-sm text-muted-foreground py-12 italic">
                  O preview aparece aqui conforme a IA monta o template.
                  <br />
                  Comece pela conversa ao lado.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button
          onClick={() => schema && onProceed(schema)}
          disabled={!schema}
          className="gap-2 bg-enf hover:bg-enf-hover text-white"
        >
          Revisar e salvar
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
