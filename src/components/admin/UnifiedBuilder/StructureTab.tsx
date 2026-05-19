// Aba "Estrutura" da página unificada de template.
//
// Se não tem schema: mostra ChoiceCard pra escolher modo (importar doc / chat).
// Após gerar: mostra apenas o preview ao vivo (StructuredReportView readOnly).
// Refino do schema é exclusivo via "Refinar com IA" (Sheet lateral).
//
// Diferente das versões antigas, este componente assume o estado do upload
// (files/hint/processing/error) e expõe pro pai (AdminTemplateUnified) o
// controle do botão Continuar via `onWizardControlChange` — assim o wizard
// usa UM único conjunto de botões no rodapé pra todo o fluxo.

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Eye, Sparkles, FilePlus2, Loader2 } from "lucide-react";
import { BuilderModeChoice } from "@/components/admin/TemplateBuilder/BuilderModeChoice";
import { ImportDocumentStep } from "@/components/admin/TemplateBuilder/ImportDocumentStep";
import { ChatBuilderStep } from "@/components/admin/TemplateBuilder/ChatBuilderStep";
import { SchemaChat } from "@/components/admin/TemplateBuilder/SchemaChat";
import { StructuredReportView } from "@/components/templates/StructuredReportView";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TemplateSchema } from "@/templates/types";

type SubStep = "choice" | "import" | "chat" | "edit";

/**
 * Controle do botão Continuar/Voltar que a aba expõe pra rodapé do wizard.
 * Quando null, o rodapé usa o comportamento padrão (avançar/voltar passo).
 */
export interface WizardControl {
  continueLabel: string;
  /** True quando o botão Continuar deve estar desabilitado. */
  continueDisabled: boolean;
  /** Ação ao clicar em Continuar. Se ausente, o rodapé avança passo padrão. */
  onContinue?: () => void | Promise<void>;
  /** Override do Voltar — quando definido, é prioritário sobre o padrão. */
  onBack?: () => void;
  /** Loading global (esconde rodapé/conteúdo enquanto roda). */
  isLoading?: boolean;
  /** Texto a mostrar na tela de loading. */
  loadingLabel?: string;
}

interface StructureTabProps {
  schema: TemplateSchema | null;
  onSchemaChange: (s: TemplateSchema) => void;
  /** Notifica o pai sobre o estado de controle desta aba. */
  onWizardControlChange?: (control: WizardControl | null) => void;
}

async function fileToBase64(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function StructureTab({
  schema,
  onSchemaChange,
  onWizardControlChange,
}: StructureTabProps) {
  const [subStep, setSubStep] = useState<SubStep>(schema ? "edit" : "choice");
  const [refineOpen, setRefineOpen] = useState(false);

  // ─── Estado do upload (lifted do ImportDocumentStep) ───
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importHint, setImportHint] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Quando recebe schema novo (via import/chat/refine), propaga pro pai
  const applySchema = useCallback(
    (s: TemplateSchema) => {
      onSchemaChange(s);
      setSubStep("edit");
      // Limpa estado do import — schema novo já foi aplicado
      setImportFiles([]);
      setImportHint("");
      setImportError(null);
    },
    [onSchemaChange],
  );

  const handleExtract = useCallback(async () => {
    if (importFiles.length === 0) return;
    setImportError(null);
    setIsExtracting(true);
    try {
      const payloadFiles = await Promise.all(
        importFiles.map(async (f) => ({
          base64: await fileToBase64(f),
          mime_type: f.type,
        })),
      );
      const { data, error: fnErr } = await supabase.functions.invoke(
        "template-schema-from-document",
        {
          body: {
            files: payloadFiles,
            hint: importHint.trim() || undefined,
          },
        },
      );
      if (fnErr) throw fnErr;
      if (!data?.success || !data?.schema) {
        throw new Error(data?.error ?? "IA não retornou schema válido");
      }
      applySchema(data.schema as TemplateSchema);
      toast.success("Template extraído. Revise abaixo.");
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setImportError(msg);
      toast.error(`Falha na extração: ${msg}`);
    } finally {
      setIsExtracting(false);
    }
  }, [importFiles, importHint, applySchema]);

  // Refs pras callbacks não-estáveis — evita loop no useEffect que sincroniza
  // o WizardControl. Effect só roda quando o ESTADO real muda.
  const extractRef = useRef(handleExtract);
  const notifyRef = useRef(onWizardControlChange);
  useEffect(() => {
    extractRef.current = handleExtract;
    notifyRef.current = onWizardControlChange;
  });

  // ─── Sincroniza WizardControl com o pai ───
  useEffect(() => {
    const notify = notifyRef.current;
    if (!notify) return;

    if (isExtracting) {
      notify({
        continueLabel: "Analisando…",
        continueDisabled: true,
        isLoading: true,
        loadingLabel: "IA está analisando seus documentos. Pode levar 20–40 segundos…",
      });
      return;
    }

    if (subStep === "import") {
      notify({
        continueLabel: "Extrair template",
        continueDisabled: importFiles.length === 0,
        onContinue: () => extractRef.current(),
        onBack: () => setSubStep("choice"),
      });
      return;
    }

    if (subStep === "chat") {
      // ChatBuilderStep ainda tem seus próprios botões internos por enquanto.
      // Aqui só registramos um Voltar customizado.
      notify({
        continueLabel: "Continuar",
        continueDisabled: !schema, // só avança se já gerou schema via chat
        onBack: () => setSubStep("choice"),
      });
      return;
    }

    // choice ou edit — comportamento padrão do wizard
    notify(null);
  }, [subStep, isExtracting, importFiles.length, schema]);

  // Cleanup: ao desmontar, libera o controle
  useEffect(() => {
    return () => {
      notifyRef.current?.(null);
    };
  }, []);

  // ─── Renderização condicional por substep ───
  if (isExtracting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <Loader2 className="w-10 h-10 text-enf animate-spin" />
        <div>
          <p className="text-base font-medium">Analisando documentos</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            A IA está identificando seções, campos, checkboxes e escalas. Pode levar
            20–40 segundos, dependendo do tamanho dos arquivos.
          </p>
        </div>
      </div>
    );
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
        files={importFiles}
        onFilesChange={setImportFiles}
        hint={importHint}
        onHintChange={setImportHint}
        externalError={importError}
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
            Veja como o formulário vai ficar. Pra ajustar campos, labels ou opções,
            use "Refinar com IA".
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Preview do formulário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md p-3 bg-muted/10 max-h-[600px] overflow-y-auto">
            {schema ? (
              <StructuredReportView schema={schema} value={{}} readOnly />
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Nenhuma estrutura ainda. Volte e escolha um modo de criar.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Sheet open={refineOpen} onOpenChange={setRefineOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-enf" />
              Refinar estrutura com IA
            </SheetTitle>
            <SheetDescription>
              Peça ajustes ou anexe documento. Mudanças aplicadas ao schema
              atualizam o preview automaticamente.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 p-3">
            <SchemaChat
              schema={schema}
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
