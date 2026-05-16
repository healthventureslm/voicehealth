// Dialog que gera roteiro de teleprompter a partir de um template (estruturado
// ou legacy) via IA. Admin revisa campos propostos, edita label/required/
// keywords, e salva como consultation_script.

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2, Trash2, Plus, ArrowUp, ArrowDown, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreateScript } from "@/hooks/queries";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables, Enums } from "@/integrations/supabase/types";

interface ScriptField {
  id: string;
  label: string;
  required: boolean;
  keywords: string[];
}

interface GenerateScriptDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: Tables<"report_templates">;
}

export function GenerateScriptDialog({
  open,
  onOpenChange,
  template,
}: GenerateScriptDialogProps) {
  const { hospitalIds } = useAuth();
  const createScript = useCreateScript();

  const [stage, setStage] = useState<"idle" | "generating" | "review">("idle");
  const [scriptName, setScriptName] = useState(template.name);
  const [scriptDescription, setScriptDescription] = useState(
    `Roteiro pra ${template.name.toLowerCase()} — gerado a partir do template.`,
  );
  const [wardTypes, setWardTypes] = useState<Enums<"ward_type">[]>(
    template.applicable_ward_types ?? [],
  );
  const [fields, setFields] = useState<ScriptField[]>([]);

  async function handleGenerate() {
    setStage("generating");
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-script-from-template",
        {
          body: {
            template_name: template.name,
            template_prompt: template.prompt || undefined,
            template_schema: template.schema || undefined,
            applicable_ward_types: template.applicable_ward_types ?? [],
          },
        },
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "IA não retornou roteiro");

      setScriptName(data.name ?? template.name);
      if (data.description) setScriptDescription(data.description);
      if (Array.isArray(data.applicable_ward_types) && data.applicable_ward_types.length > 0) {
        setWardTypes(data.applicable_ward_types as Enums<"ward_type">[]);
      }
      setFields(
        (data.fields as ScriptField[]).map((f) => ({
          ...f,
          keywords: Array.isArray(f.keywords) ? f.keywords : [],
        })),
      );
      setStage("review");
    } catch (e: any) {
      toast.error(`Falha ao gerar: ${e?.message ?? e}`);
      setStage("idle");
    }
  }

  function updateField(i: number, patch: Partial<ScriptField>) {
    setFields((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  function moveField(i: number, dir: -1 | 1) {
    setFields((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function removeField(i: number) {
    setFields((prev) => prev.filter((_, k) => k !== i));
  }

  function addField() {
    setFields((prev) => [
      ...prev,
      { id: `campo_${prev.length + 1}`, label: "", required: false, keywords: [] },
    ]);
  }

  async function handleSave() {
    if (!scriptName.trim() || fields.length === 0) {
      toast.error("Nome e ao menos 1 ponto são obrigatórios");
      return;
    }
    try {
      await createScript.mutateAsync({
        hospital_id: hospitalIds[0] ?? null,
        name: scriptName.trim(),
        description: scriptDescription.trim() || null,
        fields: fields.filter((f) => f.id.trim() && f.label.trim()),
        applicable_ward_types: wardTypes,
        is_active: true,
      });
      toast.success("Roteiro criado");
      onOpenChange(false);
      // Reset pra próxima abertura
      setStage("idle");
      setFields([]);
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e?.message ?? e}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => {
      onOpenChange(o);
      if (!o) {
        setStage("idle");
        setFields([]);
      }
    }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-enf" />
            Gerar roteiro a partir do template
          </DialogTitle>
          <DialogDescription>
            A IA vai propor os pontos que o profissional deve falar no teleprompter
            pra completar este template. Você revisa antes de salvar.
          </DialogDescription>
        </DialogHeader>

        {stage === "idle" && (
          <div className="py-6 space-y-4">
            <div className="p-4 rounded-md bg-muted/30 text-sm">
              <p className="font-medium mb-1">Template: {template.name}</p>
              {template.description && (
                <p className="text-muted-foreground text-xs">{template.description}</p>
              )}
            </div>
            <Button
              onClick={handleGenerate}
              className="w-full gap-2 bg-enf hover:bg-enf-hover text-white"
            >
              <Sparkles className="w-4 h-4" />
              Gerar com IA
            </Button>
          </div>
        )}

        {stage === "generating" && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-enf" />
            <p className="text-sm text-muted-foreground">
              IA analisando o template e propondo pontos do roteiro...
            </p>
          </div>
        )}

        {stage === "review" && (
          <div className="space-y-4">
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="script-name">Nome do roteiro</Label>
                <Input
                  id="script-name"
                  value={scriptName}
                  onChange={(e) => setScriptName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Pra parear com o template no fluxo de gravação, mantenha o nome igual ao template.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="script-desc">Descrição</Label>
                <Input
                  id="script-desc"
                  value={scriptDescription}
                  onChange={(e) => setScriptDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Pontos do roteiro ({fields.length})
                </Label>
                <Button variant="outline" size="sm" onClick={addField} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {fields.map((f, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-0.5 mt-1">
                        <button
                          type="button"
                          onClick={() => moveField(i, -1)}
                          disabled={i === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(i, 1)}
                          disabled={i === fields.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Label do ponto (ex: 'Avaliação neurológica')"
                          value={f.label}
                          onChange={(e) => updateField(i, { label: e.target.value })}
                          className="font-medium"
                        />
                        <Input
                          placeholder="Keywords separadas por vírgula (ex: alerta, glasgow, pupila, motora)"
                          value={f.keywords.join(", ")}
                          onChange={(e) =>
                            updateField(i, {
                              keywords: e.target.value
                                .split(",")
                                .map((k) => k.trim().toLowerCase())
                                .filter(Boolean),
                            })
                          }
                          className="text-xs"
                        />
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox
                            checked={f.required}
                            onCheckedChange={(v) => updateField(i, { required: v === true })}
                          />
                          Obrigatório (bloqueia finalizar a gravação se não falado)
                        </label>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeField(i)}
                        className="text-destructive hover:text-destructive shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={fields.length === 0 || !scriptName.trim() || createScript.isPending}
                className="gap-2 bg-enf hover:bg-enf-hover text-white"
              >
                <Save className="w-4 h-4" />
                {createScript.isPending ? "Salvando..." : "Salvar roteiro"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
