// Tela de revisão do template extraído:
// - Topo: metadata editável (name, description, ward types, roles)
// - Centro: preview live do formulário usando StructuredReportView (read-only)
// - Refino do schema é exclusivo via "Refinar com IA" (SchemaChat)
// - Salva → INSERT/UPDATE em report_templates
//
// O schema cru (JSON) NÃO é editável pelo admin via UI — manipulação
// direta do shape do schema fica restrita ao backend / chamadas IA.

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Eye, Sparkles } from "lucide-react";
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
  /** Quando definido, é UPDATE em vez de INSERT. */
  editingTemplateId?: string;
  /** Template existente (em edit mode) — pra herdar metadata atual. */
  existingTemplate?: {
    name?: string;
    description?: string | null;
    applicable_ward_types?: string[];
    applicable_roles?: string[];
    version?: number;
  } | null;
}

export function TemplateReviewStep({
  initialSchema,
  onBack,
  editingTemplateId,
  existingTemplate,
}: TemplateReviewStepProps) {
  const navigate = useNavigate();
  const { hospitalIds } = useAuth();
  const isEdit = !!editingTemplateId;

  // Schema mantido como objeto (sem JSON cru). Atualizado pelo SchemaChat
  // quando o admin pede refinamentos com IA.
  const [schema, setSchema] = useState<TemplateSchema>(initialSchema);
  // Metadata extraída do schema atual + override por inputs.
  // Em edit mode, prefere metadata da row do banco (que é a fonte
  // canônica das colunas applicable_*). Senão herda do schema.
  const [name, setName] = useState(
    existingTemplate?.name ?? initialSchema.name,
  );
  const [description, setDescription] = useState(
    existingTemplate?.description ?? initialSchema.description ?? "",
  );
  const [wardTypes, setWardTypes] = useState<string[]>(
    existingTemplate?.applicable_ward_types ??
      initialSchema.metadata?.applicableWardTypes ??
      [],
  );
  const [roles, setRoles] = useState<string[]>(
    existingTemplate?.applicable_roles ??
      initialSchema.metadata?.applicableRoles ??
      ["nurse"],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);

  function toggleWard(v: string) {
    setWardTypes((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  }
  function toggleRole(v: string) {
    setRoles((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setIsSaving(true);
    try {
      // Schema final: o schema atual + metadata sincronizada com inputs
      const finalSchema = {
        ...schema,
        name: name.trim(),
        description: description.trim(),
        metadata: {
          ...(schema.metadata ?? {}),
          captureMode: "voice",
          applicableRoles: roles,
          applicableWardTypes: wardTypes,
        },
      };

      if (isEdit && editingTemplateId) {
        // UPDATE — incrementa version automaticamente pra audit trail
        const nextVersion = (existingTemplate?.version ?? 1) + 1;
        const { error } = await supabase
          .from("report_templates")
          .update({
            name: name.trim(),
            description: description.trim() || null,
            schema: finalSchema as never,
            applicable_ward_types: wardTypes as never,
            applicable_roles: roles as never,
            version: nextVersion,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingTemplateId);
        if (error) throw error;
        toast.success("Template atualizado");
      } else {
        // INSERT (novo template)
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
      }
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Preview do formulário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md p-3 bg-muted/10 max-h-[600px] overflow-y-auto">
            <StructuredReportView schema={schema} value={{}} readOnly />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Pra ajustar campos, labels ou opções, use "Refinar com IA" no topo.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSaving}>
          Voltar
        </Button>
        <Button
          onClick={handleSave}
          disabled={!name.trim() || isSaving}
          className="gap-2 bg-enf hover:bg-enf-hover text-white"
        >
          <Save className="w-4 h-4" />
          {isSaving
            ? "Salvando..."
            : isEdit
              ? "Salvar alterações"
              : "Salvar template"}
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
              schema={schema}
              onSchemaUpdate={(next) => {
                setSchema(next);
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
