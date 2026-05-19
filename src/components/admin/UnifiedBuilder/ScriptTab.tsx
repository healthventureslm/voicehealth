// Aba "Roteiro" — define os pontos do teleprompter que o profissional
// vai falar durante a gravação. Cada ponto tem label + keywords pra
// detecção via match na transcrição em tempo real.
//
// Pode ser auto-gerado a partir do schema (IA olha campos required e
// agrupa em pontos clínicos macros) ou editado manualmente.

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TemplateSchema } from "@/templates/types";
import type { Enums } from "@/integrations/supabase/types";
import type { ScriptField } from "@/pages/admin/AdminTemplateUnified";

interface ScriptTabProps {
  templateName: string;
  templateSchema: TemplateSchema;
  wardTypes: Enums<"ward_type">[];
  fields: ScriptField[];
  description: string;
  onChange: (fields: ScriptField[], description?: string) => void;
}

export function ScriptTab({
  templateName,
  templateSchema,
  wardTypes,
  fields,
  description,
  onChange,
}: ScriptTabProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-script-from-template",
        {
          body: {
            template_name: templateName,
            template_schema: templateSchema,
            applicable_ward_types: wardTypes,
          },
        },
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "IA não retornou roteiro");

      const generatedFields: ScriptField[] = (data.fields as ScriptField[]).map((f) => ({
        ...f,
        keywords: Array.isArray(f.keywords) ? f.keywords : [],
      }));
      onChange(generatedFields, data.description ?? description);
      toast.success(`${generatedFields.length} pontos gerados`);
    } catch (e: any) {
      toast.error(`Falha ao gerar: ${e?.message ?? e}`);
    } finally {
      setIsGenerating(false);
    }
  }

  function updateField(i: number, patch: Partial<ScriptField>) {
    const next = [...fields];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }

  function moveField(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function removeField(i: number) {
    onChange(fields.filter((_, k) => k !== i));
  }

  function addField() {
    onChange([
      ...fields,
      { id: `campo_${fields.length + 1}`, label: "", required: false, keywords: [] },
    ]);
  }

  if (fields.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-6 space-y-4 text-center">
        <Sparkles className="w-10 h-10 mx-auto text-enf/50" />
        <div>
          <h3 className="font-semibold mb-1">Nenhum ponto de roteiro definido</h3>
          <p className="text-sm text-muted-foreground">
            A IA pode propor os pontos automaticamente baseado no schema do template.
            Vai considerar campos obrigatórios e agrupar em pontos clínicos lógicos.
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="gap-2 bg-enf hover:bg-enf-hover text-white"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? "IA processando..." : "Gerar com IA"}
          </Button>
          <Button variant="outline" onClick={addField} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar do zero
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            Pontos do roteiro ({fields.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            Cada ponto aparece no teleprompter. Keywords são usadas pra detectar
            quando o profissional fala sobre o ponto.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-enf" />}
            Regerar
          </Button>
          <Button variant="outline" size="sm" onClick={addField} className="gap-2">
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="script-desc" className="text-xs">Descrição do roteiro</Label>
        <Input
          id="script-desc"
          value={description}
          onChange={(e) => onChange(fields, e.target.value)}
          placeholder="Frase curta sobre o roteiro"
        />
      </div>

      <div className="space-y-2">
        {fields.map((f, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-0.5 mt-1">
                <button
                  type="button"
                  onClick={() => moveField(i, -1)}
                  disabled={i === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Mover pra cima"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveField(i, 1)}
                  disabled={i === fields.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Mover pra baixo"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
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
                aria-label="Remover"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
