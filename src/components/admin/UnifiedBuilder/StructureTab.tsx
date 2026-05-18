// Aba "Estrutura" da página unificada de template.
//
// Se não tem schema: mostra ChoiceCard pra escolher modo (importar doc / chat).
// Após gerar: mostra JSON editor + preview ao vivo (StructuredReportView readOnly).
// "Refinar com IA" inline (Sheet lateral).

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Code2, Eye, Sparkles, AlertCircle, FilePlus2 } from "lucide-react";
import { BuilderModeChoice } from "@/components/admin/TemplateBuilder/BuilderModeChoice";
import { ImportDocumentStep } from "@/components/admin/TemplateBuilder/ImportDocumentStep";
import { ChatBuilderStep } from "@/components/admin/TemplateBuilder/ChatBuilderStep";
import { SchemaChat } from "@/components/admin/TemplateBuilder/SchemaChat";
import { StructuredReportView } from "@/components/templates/StructuredReportView";
import type { TemplateSchema } from "@/templates/types";

interface StructureTabProps {
  schema: TemplateSchema | null;
  onSchemaChange: (s: TemplateSchema) => void;
}

type SubStep = "choice" | "import" | "chat" | "edit";

export function StructureTab({ schema, onSchemaChange }: StructureTabProps) {
  const [subStep, setSubStep] = useState<SubStep>(schema ? "edit" : "choice");
  const [jsonText, setJsonText] = useState(() =>
    schema ? JSON.stringify(schema, null, 2) : "",
  );
  const [refineOpen, setRefineOpen] = useState(false);

  // Parse o JSON pra alimentar preview. Se inválido, mantém ultimo válido + flag erro.
  const parsed = useMemo(() => {
    try {
      return { schema: JSON.parse(jsonText) as TemplateSchema, error: null as string | null };
    } catch (e: any) {
      return { schema, error: e?.message ?? "JSON inválido" };
    }
  }, [jsonText, schema]);

  // Quando edit recebe schema novo (via import/chat/refine), atualiza JSON text
  function applySchema(s: TemplateSchema) {
    setJsonText(JSON.stringify(s, null, 2));
    onSchemaChange(s);
    setSubStep("edit");
  }

  // Quando JSON text muda manualmente e é válido, propaga pro pai
  function handleJsonChange(text: string) {
    setJsonText(text);
    try {
      const s = JSON.parse(text);
      if (s && typeof s === "object" && Array.isArray((s as any).sections)) {
        onSchemaChange(s as TemplateSchema);
      }
    } catch { /* silencioso — só atualiza quando válido */ }
  }

  if (subStep === "choice") {
    return (
      <div className="space-y-2">
        {schema && (
          <Card
            onClick={() => setSubStep("edit")}
            className="cursor-pointer hover:border-enf"
          >
            <CardContent className="py-3 flex items-center gap-3">
              <Eye className="w-5 h-5 text-enf" />
              <div className="flex-1">
                <p className="text-sm font-medium">Editar estrutura atual</p>
                <p className="text-xs text-muted-foreground">
                  {schema.sections?.length ?? 0} seções já configuradas
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        <BuilderModeChoice onPick={(mode) => setSubStep(mode)} />
      </div>
    );
  }

  if (subStep === "import") {
    return (
      <ImportDocumentStep
        onBack={() => setSubStep("choice")}
        onExtracted={applySchema}
      />
    );
  }

  if (subStep === "chat") {
    return (
      <ChatBuilderStep
        onBack={() => setSubStep("choice")}
        onProceed={applySchema}
      />
    );
  }

  // subStep === "edit"
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Estrutura do formulário</h3>
          <p className="text-xs text-muted-foreground">
            JSON à esquerda, preview do formulário à direita. Edite manualmente ou refine com IA.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSubStep("choice")}
            className="gap-2"
          >
            <FilePlus2 className="w-4 h-4" />
            Recomeçar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefineOpen(true)}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4 text-enf" />
            Refinar com IA
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              Schema (JSON)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="font-mono text-xs h-[450px] resize-none"
              spellCheck={false}
            />
            {parsed.error && (
              <div className="mt-2 flex gap-2 text-xs text-destructive items-center">
                <AlertCircle className="w-3.5 h-3.5" />
                {parsed.error}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview do formulário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md p-3 bg-muted/10 h-[450px] overflow-y-auto">
              {parsed.schema ? (
                <StructuredReportView schema={parsed.schema} value={{}} readOnly />
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Conserte o JSON pra ver o preview.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Sheet open={refineOpen} onOpenChange={setRefineOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-enf" />
              Refinar estrutura com IA
            </SheetTitle>
            <SheetDescription>
              Peça ajustes ou anexe documento. Mudanças sincronizam no JSON.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 p-3">
            <SchemaChat
              schema={parsed.schema}
              onSchemaUpdate={(next) => applySchema(next)}
              greeting="Como posso ajustar esta estrutura?"
              placeholder="Ex: 'Adicione uma seção de sinais vitais'"
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
