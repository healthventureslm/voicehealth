// Tela de revisão do template extraído. v1 pragmática:
// - Topo: metadata editável (name, description, ward types, roles)
// - Esquerda: JSON textarea (admin ajusta fino)
// - Direita: preview live usando StructuredReportView (read-only)
// - Salva → INSERT em report_templates
//
// v2 vai trazer editor visual por field (sem JSON cru). Por enquanto
// JSON é suficiente — IA entrega ~90% pronto, admin só precisa renomear
// labels ocasionais.

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, AlertCircle, Eye, Code2, Sparkles } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { SchemaChat } from "./SchemaChat";
import { StructuredReportView } from "@/components/templates/StructuredReportView";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { TemplateSchema } from "@/templates/types";

const WARD_TYPES = [
  { value: "uti", label: "UTI" },
  { value: "enfermaria", label: "Enfermaria" },
  { value: "centro_cirurgico", label: "Centro cirúrgico" },
  { value: "pronto_socorro", label: "Pronto-socorro" },
  { value: "ambulatorio", label: "Ambulatório" },
];

const ROLES = [
  { value: "nurse", label: "Enfermeiro" },
  { value: "doctor", label: "Médico" },
];

interface TemplateReviewStepProps {
  initialSchema: TemplateSchema;
  onBack: () => void;
}

export function TemplateReviewStep({ initialSchema, onBack }: TemplateReviewStepProps) {
  const navigate = useNavigate();
  const { hospitalIds } = useAuth();

  // Estado: schema completo como string JSON pra edição livre
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(initialSchema, null, 2),
  );
  // Metadata extraída do schema atual + override por inputs
  const [name, setName] = useState(initialSchema.name);
  const [description, setDescription] = useState(initialSchema.description ?? "");
  const [wardTypes, setWardTypes] = useState<string[]>(
    initialSchema.metadata?.applicableWardTypes ?? [],
  );
  const [roles, setRoles] = useState<string[]>(
    initialSchema.metadata?.applicableRoles ?? ["nurse"],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);

  // Parse o JSON pra usar no preview. Se inválido, mostra erro mas não quebra.
  const parsed = useMemo(() => {
    try {
      return { schema: JSON.parse(jsonText) as TemplateSchema, error: null };
    } catch (e: any) {
      return { schema: null, error: e?.message ?? "JSON inválido" };
    }
  }, [jsonText]);

  function toggleWard(v: string) {
    setWardTypes((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  }
  function toggleRole(v: string) {
    setRoles((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  }

  async function handleSave() {
    if (!parsed.schema) {
      toast.error("JSON inválido — conserte antes de salvar");
      return;
    }
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setIsSaving(true);
    try {
      // Schema final: o JSON editado + metadata sincronizada
      const finalSchema = {
        ...parsed.schema,
        name: name.trim(),
        description: description.trim(),
        metadata: {
          ...(parsed.schema.metadata ?? {}),
          captureMode: "voice",
          applicableRoles: roles,
          applicableWardTypes: wardTypes,
        },
      };

      const { error } = await supabase.from("report_templates").insert({
        name: name.trim(),
        description: description.trim() || null,
        prompt: "",
        schema: finalSchema as never,
        hospital_id: hospitalIds[0] ?? null,
        applicable_ward_types: wardTypes as never,
        applicable_roles: roles as never,
        is_active: true,
        version: 1,
      });
      if (error) throw error;

      toast.success("Template criado");
      navigate("/admin/templates");
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e?.message ?? e}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">Revise e ajuste</h2>
          <p className="text-sm text-muted-foreground">
            A IA extraiu o template. Confira os campos, ajuste o que precisar e veja
            o resultado ao vivo na direita antes de salvar.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setRefineOpen(true)}
          className="gap-2 shrink-0"
        >
          <Sparkles className="w-4 h-4 text-enf" />
          Refinar com IA
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações do template</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Nome *</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc">Descrição</Label>
            <Input
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Setores aplicáveis</Label>
            <div className="grid grid-cols-2 gap-2">
              {WARD_TYPES.map((w) => (
                <label key={w.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={wardTypes.includes(w.value)}
                    onCheckedChange={() => toggleWard(w.value)}
                  />
                  {w.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Perfis profissionais</Label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={roles.includes(r.value)}
                    onCheckedChange={() => toggleRole(r.value)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              Schema (JSON)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="font-mono text-xs h-[500px] resize-none"
              spellCheck={false}
            />
            {parsed.error && (
              <div className="mt-2 flex gap-2 text-xs text-destructive items-center">
                <AlertCircle className="w-3.5 h-3.5" />
                {parsed.error}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Edite labels, opções de enums, ou adicione campos. Cada mudança válida
              atualiza o preview ao lado.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview do formulário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md p-3 bg-muted/10 h-[500px] overflow-y-auto">
              {parsed.schema ? (
                <StructuredReportView schema={parsed.schema} value={{}} readOnly />
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Preview indisponível — conserte o JSON pra ver o form.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSaving}>
          Voltar
        </Button>
        <Button
          onClick={handleSave}
          disabled={!parsed.schema || !name.trim() || isSaving}
          className="gap-2 bg-enf hover:bg-enf-hover text-white"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Salvando..." : "Salvar template"}
        </Button>
      </div>

      {/* Sheet lateral pra refinar o schema com IA — reaproveita SchemaChat
          com o schema atual. Quando IA atualiza, sincroniza no JSON editor. */}
      <Sheet open={refineOpen} onOpenChange={setRefineOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-enf" />
              Refinar com IA
            </SheetTitle>
            <SheetDescription>
              Peça ajustes ou anexe outro documento de referência. Mudanças aplicadas
              ao schema atualizam o preview automaticamente.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 p-3">
            <SchemaChat
              schema={parsed.schema}
              onSchemaUpdate={(next) => {
                setJsonText(JSON.stringify(next, null, 2));
                if (next.name) setName(next.name);
                if (next.description) setDescription(next.description);
                const meta = (next.metadata ?? {}) as Record<string, unknown>;
                if (Array.isArray(meta.applicableRoles)) {
                  setRoles(meta.applicableRoles as string[]);
                }
                if (Array.isArray(meta.applicableWardTypes)) {
                  setWardTypes(meta.applicableWardTypes as string[]);
                }
              }}
              greeting="Como posso ajustar este template?"
              placeholder="Ex: 'Adicione seção de sinais vitais' ou 'Tira a escala BRADEN'"
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
