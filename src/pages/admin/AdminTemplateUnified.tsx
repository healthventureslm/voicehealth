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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Palette, Sparkles, Save, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { StructureTab } from "@/components/admin/UnifiedBuilder/StructureTab";
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

  const [activeTab, setActiveTab] = useState<"structure" | "design" | "script">(
    (params.get("tab") as "structure" | "design" | "script") || "structure",
  );
  const [isSaving, setIsSaving] = useState(false);

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
          subtitle="Configure estrutura, design do PDF e roteiro do teleprompter — tudo no mesmo lugar."
        />

        {/* Metadata global do template, persistente entre tabs */}
        <Card>
          <CardContent className="py-4 space-y-4">
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
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabTrigger
              value="structure"
              icon={<FileText className="w-4 h-4" />}
              label="Estrutura"
              indicator={hasSchema ? "definido" : "obrigatório"}
              indicatorVariant={hasSchema ? "default" : "destructive"}
            />
            <TabTrigger
              value="design"
              icon={<Palette className="w-4 h-4" />}
              label="Design"
              disabled={!hasSchema}
              disabledReason="Configure a estrutura primeiro"
              indicator={displayLayout ? "definido" : "opcional"}
              indicatorVariant={displayLayout ? "default" : "outline"}
            />
            <TabTrigger
              value="script"
              icon={<Sparkles className="w-4 h-4" />}
              label="Roteiro"
              disabled={!hasSchema}
              disabledReason="Configure a estrutura primeiro"
              indicator={scriptFields.length > 0 ? `${scriptFields.length} pontos` : "opcional"}
              indicatorVariant={scriptFields.length > 0 ? "default" : "outline"}
            />
          </TabsList>

          <TabsContent value="structure" className="mt-4">
            <StructureTab
              schema={schema}
              onSchemaChange={(s) => {
                setSchema(s);
                setStructureDirty(true);
                // Sincroniza nome/desc do schema se vazios
                if (!name && s.name) setName(s.name);
                if (!description && s.description) setDescription(s.description);
                if (wardTypes.length === 0 && s.metadata?.applicableWardTypes) {
                  setWardTypes(s.metadata.applicableWardTypes as Enums<"ward_type">[]);
                }
              }}
            />
          </TabsContent>

          <TabsContent value="design" className="mt-4">
            {hasSchema && schema ? (
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
            ) : (
              <DisabledTabMessage reason="Configure a estrutura primeiro pra atribuir um design ao PDF." />
            )}
          </TabsContent>

          <TabsContent value="script" className="mt-4">
            {hasSchema && schema ? (
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
            ) : (
              <DisabledTabMessage reason="Configure a estrutura primeiro pra gerar o roteiro." />
            )}
          </TabsContent>
        </Tabs>

        {/* Footer com save único */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            {!canSave && (
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Preencha o nome e configure a estrutura pra salvar.
              </div>
            )}
            {canSave && (structureDirty || designDirty || scriptDirty) && (
              <span>Alterações pendentes em {[
                structureDirty && "Estrutura",
                designDirty && "Design",
                scriptDirty && "Roteiro",
              ].filter(Boolean).join(", ")}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/admin/templates")} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSave || isSaving}
              className="gap-2 bg-enf hover:bg-enf-hover text-white"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? "Salvando..." : "Salvar tudo"}
            </Button>
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}

function TabTrigger({
  value,
  icon,
  label,
  disabled,
  disabledReason,
  indicator,
  indicatorVariant,
}: {
  value: string;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  indicator?: string;
  indicatorVariant?: "default" | "destructive" | "outline";
}) {
  return (
    <TabsTrigger
      value={value}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className="gap-2 flex-col sm:flex-row sm:py-2"
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      {indicator && (
        <Badge variant={indicatorVariant ?? "outline"} className="text-[10px] h-4 px-1.5">
          {indicator}
        </Badge>
      )}
    </TabsTrigger>
  );
}

function DisabledTabMessage({ reason }: { reason: string }) {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-40" />
      {reason}
    </div>
  );
}
