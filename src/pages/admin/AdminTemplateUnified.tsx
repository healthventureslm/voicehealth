// Página unificada de criar/editar template. Substitui as 3 telas
// fragmentadas (AdminTemplateBuilder, AdminTemplateDesign, dialog de
// GenerateScript) por um wizard com 3 tabs:
//
//   1. Estrutura — schema (campos tipados) — obrigatório
//   2. Design    — display_layout (PDF fiel) — opcional
//   3. Roteiro   — consultation_script (teleprompter) — opcional
//
// Estado central na page. Cada tab tem componentes próprios que renderizam
// dentro do mesmo container. Save é único e atômico: UPDATE/INSERT em
// report_templates + UPSERT em consultation_scripts.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Info, FileText, Palette, Sparkles, Save, AlertCircle, Loader2, ArrowRight, ArrowLeft, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { StructureTab, type WizardControl } from "@/components/admin/UnifiedBuilder/StructureTab";
import { DesignTab } from "@/components/admin/UnifiedBuilder/DesignTab";
import { ScriptTab } from "@/components/admin/UnifiedBuilder/ScriptTab";
import type { TemplateSchema } from "@/templates/types";
import type { LayoutNode } from "@/templates/pdfLayout/types";
import type { Enums } from "@/integrations/supabase/types";

const WARD_TYPES = [
  { value: "uti", label: "UTI" },
  { value: "enfermaria", label: "Enfermaria" },
  { value: "centro_cirurgico", label: "Centro cirúrgico" },
  { value: "pronto_socorro", label: "Pronto-socorro" },
  { value: "ambulatorio", label: "Ambulatório" },
] as const;

const ROLES = [
  { value: "nurse", label: "Enfermeiro" },
  { value: "doctor", label: "Médico" },
] as const;

export interface ScriptField {
  id: string;
  label: string;
  required: boolean;
  keywords: string[];
}

export default function AdminTemplateUnified() {
  const { id } = useParams<{ id?: string }>();
  const [params] = useSearchParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { hospitalIds } = useAuth();
  const hospitalId = hospitalIds[0];

  // ─── Estado central ───
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [wardTypes, setWardTypes] = useState<Enums<"ward_type">[]>([]);
  const [roles, setRoles] = useState<Enums<"app_role">[]>(["nurse"]);
  const [schema, setSchema] = useState<TemplateSchema | null>(null);
  const [displayLayout, setDisplayLayout] = useState<LayoutNode | null>(null);
  const [scriptFields, setScriptFields] = useState<ScriptField[]>([]);
  const [scriptDescription, setScriptDescription] = useState("");

  // Tracking de mudanças pra saber o que UPSERT no save
  const [structureDirty, setStructureDirty] = useState(false);
  const [designDirty, setDesignDirty] = useState(false);
  const [scriptDirty, setScriptDirty] = useState(false);

  // Wizard de 4 passos. Em edit mode, todos têm dados — usuário pode pular
  // pra qualquer passo cujo pré-requisito esteja satisfeito.
  type StepId = "info" | "structure" | "script" | "design";
  const [stepId, setStepId] = useState<StepId>(
    (params.get("step") as StepId) || "info",
  );
  const [isSaving, setIsSaving] = useState(false);

  // Controle do botão Continuar/Voltar que vem da aba ativa (ex: StructureTab
  // assume controle no subStep "import" pra extrair documento).
  // Quando null, o rodapé usa o comportamento padrão (avançar/voltar passo).
  const [stepCtrl, setStepCtrl] = useState<WizardControl | null>(null);

  // Reseta o controle ao trocar de passo do wizard — cada passo é responsável
  // por (re)registrar o seu, se precisar
  useEffect(() => {
    setStepCtrl(null);
  }, [stepId]);

  // ─── Carrega template existente em edit mode ───
  const { data: existing, isLoading } = useQuery({
    queryKey: ["unified_template", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_templates")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description ?? "");
      setWardTypes(existing.applicable_ward_types ?? []);
      setRoles(existing.applicable_roles ?? ["nurse"]);
      if (existing.schema) setSchema(existing.schema as TemplateSchema);
      if (existing.display_layout) setDisplayLayout(existing.display_layout as LayoutNode);
    }
  }, [existing]);

  // Carrega script existente pareado pelo nome (consultation_scripts.name = template.name)
  useQuery({
    queryKey: ["unified_script", name, hospitalId],
    enabled: !!name && !!hospitalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultation_scripts")
        .select("*")
        .eq("name", name)
        .or(`hospital_id.is.null,hospital_id.eq.${hospitalId}`)
        .order("hospital_id", { nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const fields = Array.isArray(data.fields)
          ? (data.fields as unknown[]).map((f) => {
              const r = f as Record<string, unknown>;
              return {
                id: String(r.id ?? ""),
                label: String(r.label ?? ""),
                required: Boolean(r.required),
                keywords: Array.isArray(r.keywords) ? r.keywords.map(String) : [],
              };
            }).filter((f) => f.id && f.label)
          : [];
        setScriptFields(fields);
        setScriptDescription(data.description ?? "");
      }
      return data;
    },
  });

  const canSave = !!name.trim() && !!schema;
  const hasSchema = !!schema;

  // ─── Save atômico ───
  async function handleSave() {
    if (!canSave) {
      toast.error("Nome e estrutura (Tab 1) são obrigatórios");
      return;
    }
    setIsSaving(true);
    try {
      // Sincroniza metadata no schema antes de salvar
      const finalSchema: TemplateSchema = {
        ...schema!,
        name: name.trim(),
        description: description.trim(),
        metadata: {
          ...(schema!.metadata ?? {}),
          captureMode: "voice",
          applicableRoles: roles,
          applicableWardTypes: wardTypes,
        },
      };

      let templateId = id;

      if (isEdit && id) {
        const nextVersion = (existing?.version ?? 1) + 1;
        const { error } = await supabase
          .from("report_templates")
          .update({
            name: name.trim(),
            description: description.trim() || null,
            schema: finalSchema as never,
            display_layout: displayLayout as never,
            applicable_ward_types: wardTypes as never,
            applicable_roles: roles as never,
            version: nextVersion,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("report_templates")
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            prompt: "",
            schema: finalSchema as never,
            display_layout: displayLayout as never,
            hospital_id: hospitalId ?? null,
            applicable_ward_types: wardTypes as never,
            applicable_roles: roles as never,
            is_active: true,
            version: 1,
          })
          .select("id")
          .single();
        if (error) throw error;
        templateId = inserted.id;
      }

      // UPSERT script (pareado pelo nome). Só salva se admin gerou/editou.
      if (scriptDirty && scriptFields.length > 0) {
        const cleanFields = scriptFields
          .filter((f) => f.id.trim() && f.label.trim())
          .map((f) => ({
            id: f.id,
            label: f.label,
            required: f.required,
            keywords: f.keywords,
          }));
        // Tenta achar script existente com mesmo nome no hospital
        const { data: existingScript } = await supabase
          .from("consultation_scripts")
          .select("id")
          .eq("name", name.trim())
          .eq("hospital_id", hospitalId)
          .maybeSingle();

        if (existingScript) {
          const { error: scriptErr } = await supabase
            .from("consultation_scripts")
            .update({
              description: scriptDescription.trim() || null,
              fields: cleanFields as never,
              applicable_ward_types: wardTypes as never,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingScript.id);
          if (scriptErr) throw scriptErr;
        } else {
          const { error: scriptErr } = await supabase
            .from("consultation_scripts")
            .insert({
              name: name.trim(),
              description: scriptDescription.trim() || null,
              fields: cleanFields as never,
              hospital_id: hospitalId ?? null,
              applicable_ward_types: wardTypes as never,
              is_active: true,
            });
          if (scriptErr) throw scriptErr;
        }
      }

      toast.success(isEdit ? "Template atualizado" : "Template criado");
      navigate("/admin/templates");
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e?.message ?? e}`);
    } finally {
      setIsSaving(false);
    }
  }

  function toggleWard(v: Enums<"ward_type">) {
    setWardTypes((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  }
  function toggleRole(v: Enums<"app_role">) {
    setRoles((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  }

  if (isLoading) {
    return (
      <AppLayout>
        <PageContainer>
          <p className="py-12 text-center text-muted-foreground">Carregando...</p>
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          back
          backTo="/admin/templates"
          title={isEdit ? "Editar template" : "Novo template"}
          subtitle="Siga os passos abaixo. Cada etapa é validada antes da próxima."
        />

        {/* Stepper */}
        <Stepper
          steps={[
            { id: "info", label: "Informações básicas", icon: <Info className="w-4 h-4" />, complete: !!name.trim() },
            { id: "structure", label: "Estrutura", icon: <FileText className="w-4 h-4" />, complete: hasSchema, required: true },
            { id: "script", label: "Roteiro", icon: <Sparkles className="w-4 h-4" />, complete: scriptFields.length > 0, optional: true },
            { id: "design", label: "Design", icon: <Palette className="w-4 h-4" />, complete: !!displayLayout, optional: true },
          ]}
          currentId={stepId}
          onStepClick={(target) => {
            // Permite navegação livre só se o pré-requisito está satisfeito
            if (target === "info") return setStepId("info");
            if (target === "structure" && name.trim()) return setStepId("structure");
            if ((target === "script" || target === "design") && hasSchema) return setStepId(target);
            toast.error("Preencha as etapas anteriores antes de avançar.");
          }}
        />

        {/* Step content */}
        <Card>
          <CardContent className="py-5 space-y-4">
            {stepId === "info" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Informações básicas</h2>
                  <p className="text-sm text-muted-foreground">
                    Como o template vai aparecer pros profissionais e onde se aplica.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-name">Nome *</Label>
                    <Input
                      id="tpl-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="ex: Histórico de Enfermagem"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-desc">Descrição</Label>
                    <Input
                      id="tpl-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Frase curta sobre quando usar"
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Setores aplicáveis</Label>
                    <div className="grid grid-cols-2 gap-1.5">
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
                    <Label className="text-xs">Perfis profissionais</Label>
                    <div className="grid grid-cols-2 gap-1.5">
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
                </div>
              </div>
            )}

            {stepId === "structure" && (
              <StructureTab
                schema={schema}
                onSchemaChange={(s) => {
                  setSchema(s);
                  setStructureDirty(true);
                  if (!name && s.name) setName(s.name);
                  if (!description && s.description) setDescription(s.description);
                  if (wardTypes.length === 0 && s.metadata?.applicableWardTypes) {
                    setWardTypes(s.metadata.applicableWardTypes as Enums<"ward_type">[]);
                  }
                }}
                onWizardControlChange={setStepCtrl}
              />
            )}

            {stepId === "script" && hasSchema && schema && (
              <ScriptTab
                templateName={name}
                templateSchema={schema}
                wardTypes={wardTypes}
                fields={scriptFields}
                description={scriptDescription}
                onChange={(fields, desc) => {
                  setScriptFields(fields);
                  if (desc !== undefined) setScriptDescription(desc);
                  setScriptDirty(true);
                }}
              />
            )}

            {stepId === "design" && hasSchema && schema && (
              <DesignTab
                templateName={name}
                schema={schema}
                hospitalId={hospitalId ?? undefined}
                currentLayout={displayLayout}
                onLayoutChange={(l) => {
                  setDisplayLayout(l);
                  setDesignDirty(true);
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Footer com navegação e save. Pode ser dirigido pelo `stepCtrl` que
            a aba ativa registra (ex: estrutura/import → Continuar = extrair). */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/admin/templates")}
              disabled={isSaving || stepCtrl?.isLoading}
            >
              Cancelar
            </Button>
            {(stepId !== "info" || stepCtrl?.onBack) && (
              <Button
                variant="outline"
                onClick={() => {
                  // Se a aba ativa registrou um Voltar custom (ex: voltar do
                  // import pra choice), prioriza. Senão volta o passo.
                  if (stepCtrl?.onBack) {
                    stepCtrl.onBack();
                    return;
                  }
                  const order: StepId[] = ["info", "structure", "script", "design"];
                  const idx = order.indexOf(stepId);
                  if (idx > 0) setStepId(order[idx - 1]);
                }}
                disabled={isSaving || stepCtrl?.isLoading}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
            )}
          </div>

          <div className="flex gap-2 items-center">
            {!canSave && stepId === "design" && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Estrutura é obrigatória pra salvar.
              </span>
            )}

            {stepId === "design" ? (
              <Button
                onClick={handleSave}
                disabled={!canSave || isSaving}
                className="gap-2 bg-enf hover:bg-enf-hover text-white"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? "Salvando..." : "Salvar template"}
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  // 1) Se a aba registrou um Continuar custom (ex: extrair
                  // template), executa ele. A aba decide quando avançar de
                  // passo via setSchema / applySchema.
                  if (stepCtrl?.onContinue) {
                    await stepCtrl.onContinue();
                    return;
                  }
                  // 2) Senão: validação default por passo antes de avançar
                  if (stepId === "info" && !name.trim()) {
                    toast.error("Preencha o nome do template antes de continuar.");
                    return;
                  }
                  if (stepId === "structure" && !hasSchema) {
                    toast.error("Configure a estrutura antes de continuar.");
                    return;
                  }
                  const order: StepId[] = ["info", "structure", "script", "design"];
                  const idx = order.indexOf(stepId);
                  if (idx >= 0 && idx < order.length - 1) {
                    setStepId(order[idx + 1]);
                  }
                }}
                disabled={stepCtrl?.continueDisabled || stepCtrl?.isLoading}
                className="gap-2 bg-enf hover:bg-enf-hover text-white"
              >
                {stepCtrl?.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {stepCtrl?.continueLabel ?? "Continuar"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}

// ─── Stepper ───
interface Step {
  id: string;
  label: string;
  icon: React.ReactNode;
  complete: boolean;
  required?: boolean;
  optional?: boolean;
}

function Stepper({
  steps,
  currentId,
  onStepClick,
}: {
  steps: Step[];
  currentId: string;
  onStepClick: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 w-full">
      {steps.map((s, idx) => {
        const isCurrent = s.id === currentId;
        const isComplete = s.complete && !isCurrent;
        return (
          <div key={s.id} className="flex items-center flex-1 min-w-0">
            <button
              type="button"
              onClick={() => onStepClick(s.id)}
              className={cn(
                "flex items-center gap-2 px-2 py-2 rounded-md min-w-0 transition-colors text-left",
                isCurrent && "bg-enf-soft",
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0",
                  isCurrent
                    ? "bg-enf text-white"
                    : isComplete
                      ? "bg-enf/20 text-enf-deep"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {isComplete ? <Check className="w-4 h-4" /> : idx + 1}
              </span>
              <span className="flex flex-col leading-tight min-w-0">
                <span
                  className={cn(
                    "text-sm font-medium truncate",
                    isCurrent ? "text-enf-deep" : "text-foreground",
                  )}
                >
                  {s.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {s.required ? "Obrigatório" : s.optional ? "Opcional" : ""}
                </span>
              </span>
            </button>
            {idx < steps.length - 1 && (
              <div className="h-px flex-1 bg-border mx-1" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}
