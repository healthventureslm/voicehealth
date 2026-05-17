// Página de atribuir/editar design fiel do PDF de um template.
//
// Fluxo (state machine):
//   choice → (upload | clone | json) → preview → salva → /admin/templates
//
// O design é o display_layout JSONB no template — uma árvore react-pdf que
// substitui o exportador markdown+jsPDF default. Pode ser gerado a partir
// de uma foto do documento real OU clonado de outro template do hospital
// adaptando placeholders pros field ids do schema atual.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Copy, Code2, Save, AlertCircle, Loader2, Sparkles, FileText, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminTemplates } from "@/hooks/queries";
import { toast } from "sonner";
import { PDFViewer } from "@react-pdf/renderer";
import { renderNode } from "@/templates/pdfLayout/walker";
import { buildPdfContext } from "@/templates/pdfLayout/context";
import type { LayoutNode } from "@/templates/pdfLayout/types";

type Step = "choice" | "upload" | "clone" | "json" | "preview";

export default function AdminTemplateDesign() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hospitalIds } = useAuth();
  const hospitalId = hospitalIds[0];

  const [step, setStep] = useState<Step>("choice");
  const [draftLayout, setDraftLayout] = useState<LayoutNode | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: template, isLoading } = useQuery({
    queryKey: ["template_design", id],
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

  // Se template já tem layout, pula direto pro preview pra revisar/regenerar.
  useEffect(() => {
    if (template?.display_layout) {
      setDraftLayout(template.display_layout as LayoutNode);
    }
  }, [template?.display_layout]);

  const { data: otherTemplates } = useAdminTemplates(hospitalId);
  const templatesWithDesign = useMemo(
    () => (otherTemplates ?? []).filter((t) => t.id !== id && (t as any).display_layout),
    [otherTemplates, id],
  );

  async function handleSave() {
    if (!draftLayout || !id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("report_templates")
        .update({ display_layout: draftLayout as never, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success("Design salvo");
      navigate("/admin/templates");
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e?.message ?? e}`);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <PageContainer width="narrow">Carregando...</PageContainer>
      </AppLayout>
    );
  }

  if (!template) {
    return (
      <AppLayout>
        <PageContainer width="narrow">
          <p>Template não encontrado.</p>
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
          title={`Design do PDF — ${template.name}`}
          subtitle={
            template.display_layout
              ? "Este template já tem um design. Você pode revisar ou regenerar."
              : "Defina como o PDF deste template vai aparecer. A IA pode gerar a partir de uma foto, clonar de outro template, ou você edita o JSON direto."
          }
        />

        {step === "choice" && (
          <BuilderChoice
            hasExisting={!!template.display_layout}
            hasOthers={templatesWithDesign.length > 0}
            onPick={(mode) => setStep(mode)}
          />
        )}

        {step === "upload" && (
          <UploadStep
            schema={template.schema as Record<string, unknown>}
            onBack={() => setStep("choice")}
            onGenerated={(layout) => {
              setDraftLayout(layout);
              setStep("preview");
            }}
          />
        )}

        {step === "clone" && (
          <CloneStep
            targetSchema={template.schema as Record<string, unknown>}
            sources={templatesWithDesign}
            onBack={() => setStep("choice")}
            onGenerated={(layout) => {
              setDraftLayout(layout);
              setStep("preview");
            }}
          />
        )}

        {step === "json" && (
          <JsonStep
            initial={draftLayout}
            onBack={() => setStep("choice")}
            onApply={(layout) => {
              setDraftLayout(layout);
              setStep("preview");
            }}
          />
        )}

        {step === "preview" && draftLayout && (
          <PreviewStep
            layout={draftLayout}
            template={template}
            onBack={() => setStep("choice")}
            onEditJson={() => setStep("json")}
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}
      </PageContainer>
    </AppLayout>
  );
}

// ─── Choice ───
function BuilderChoice({
  hasExisting,
  hasOthers,
  onPick,
}: {
  hasExisting: boolean;
  hasOthers: boolean;
  onPick: (m: "upload" | "clone" | "json" | "preview") => void;
}) {
  return (
    <div className="max-w-3xl mx-auto py-6 space-y-3">
      {hasExisting && (
        <Card
          onClick={() => onPick("preview")}
          className="cursor-pointer hover:border-enf transition-colors"
        >
          <CardContent className="py-4 flex items-center gap-3">
            <Eye className="w-5 h-5 text-enf" />
            <div className="flex-1">
              <p className="font-medium text-sm">Ver design atual</p>
              <p className="text-xs text-muted-foreground">
                Já tem design salvo. Veja o preview ou regenere.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <ChoiceCard
        icon={<Upload className="w-7 h-7" />}
        title="Gerar de foto/PDF"
        description="Sobe a foto ou PDF do documento real — a IA replica o layout (cabeçalho, faixas, fontes, cores)."
        onClick={() => onPick("upload")}
      />

      <ChoiceCard
        icon={<Copy className="w-7 h-7" />}
        title="Copiar de outro template"
        description={
          hasOthers
            ? "Aproveita o design de outro template do hospital. A IA mantém o shell visual e adapta os placeholders pros campos deste."
            : "Nenhum outro template do hospital tem design salvo ainda."
        }
        onClick={() => onPick("clone")}
        disabled={!hasOthers}
      />

      <ChoiceCard
        icon={<Code2 className="w-7 h-7" />}
        title="Editar JSON manualmente"
        description="Power user: edita a árvore react-pdf direto."
        onClick={() => onPick("json")}
      />
    </div>
  );
}

function ChoiceCard({
  icon,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`w-full text-left p-4 rounded-lg border-2 transition-all flex gap-3 items-start ${
        disabled
          ? "opacity-50 cursor-not-allowed border-border bg-muted/10"
          : "border-border hover:border-enf hover:shadow-sm bg-card cursor-pointer"
      }`}
    >
      <div className={`p-2 rounded-md ${disabled ? "bg-muted text-muted-foreground" : "bg-enf/10 text-enf"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm mb-0.5">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

// ─── Upload: foto/PDF → IA gera layout ───
function UploadStep({
  schema,
  onBack,
  onGenerated,
}: {
  schema: Record<string, unknown>;
  onBack: () => void;
  onGenerated: (l: LayoutNode) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [hint, setHint] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(f: File | null) {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("Arquivo muito grande (limite 10 MB)");
      return;
    }
    setFile(f);
  }

  async function handleGenerate() {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
      const base64 = btoa(bin);

      const { data, error: fnErr } = await supabase.functions.invoke(
        "template-design-from-document",
        {
          body: {
            file_base64: base64,
            mime_type: file.type,
            schema,
            hint: hint.trim() || undefined,
          },
        },
      );
      if (fnErr) throw fnErr;
      if (!data?.success || !data?.display_layout) {
        throw new Error(data?.error ?? "IA não retornou layout válido");
      }
      onGenerated(data.display_layout as LayoutNode);
      toast.success("Design extraído. Revise no preview.");
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Gerar design de foto/PDF</h2>
        <p className="text-sm text-muted-foreground">
          Suba a imagem ou PDF do documento real. A IA vai replicar o layout visual
          mantendo os dados de paciente/hospital como placeholders.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <label className="block text-center cursor-pointer">
            <input
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              disabled={isProcessing}
            />
            {file ? (
              <div className="space-y-2">
                <FileText className="w-8 h-8 mx-auto text-enf" />
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB — clique pra trocar
                </p>
              </div>
            ) : (
              <div className="text-muted-foreground space-y-2">
                <Upload className="w-8 h-8 mx-auto" />
                <p className="font-medium text-sm text-foreground">Clique pra escolher arquivo</p>
                <p className="text-xs">PDF, PNG, JPEG ou WebP — até 10 MB</p>
              </div>
            )}
          </label>
        </CardContent>
      </Card>

      <div className="space-y-1.5">
        <Label htmlFor="design-hint">Dica adicional (opcional)</Label>
        <Input
          id="design-hint"
          placeholder="ex: Manter cabeçalho institucional fiel ao original"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          disabled={isProcessing}
        />
      </div>

      {error && (
        <div className="flex gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/5 text-sm">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isProcessing}>
          Voltar
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={!file || isProcessing}
          className="gap-2 bg-enf hover:bg-enf-hover text-white"
        >
          {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
          {isProcessing ? "IA processando..." : "Gerar design"}
          {!isProcessing && <Sparkles className="w-4 h-4" />}
        </Button>
      </div>

      {isProcessing && (
        <p className="text-xs text-center text-muted-foreground italic">
          Pode levar 30-60 segundos pra replicar o layout fielmente.
        </p>
      )}
    </div>
  );
}

// ─── Clone: pega design de outro template + IA adapta ───
function CloneStep({
  targetSchema,
  sources,
  onBack,
  onGenerated,
}: {
  targetSchema: Record<string, unknown>;
  sources: Array<{ id: string; name: string; display_layout?: unknown }>;
  onBack: () => void;
  onGenerated: (l: LayoutNode) => void;
}) {
  const [sourceId, setSourceId] = useState<string>("");
  const [hint, setHint] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClone() {
    const src = sources.find((s) => s.id === sourceId);
    if (!src || !src.display_layout) return;
    setIsProcessing(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "template-design-clone",
        {
          body: {
            source_layout: src.display_layout,
            target_schema: targetSchema,
            hint: hint.trim() || undefined,
          },
        },
      );
      if (fnErr) throw fnErr;
      if (!data?.success || !data?.display_layout) {
        throw new Error(data?.error ?? "IA não retornou layout válido");
      }
      onGenerated(data.display_layout as LayoutNode);
      toast.success("Design clonado e adaptado. Revise no preview.");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Copiar de outro template</h2>
        <p className="text-sm text-muted-foreground">
          Escolha um template que já tem design definido. A IA vai manter o shell
          visual (cabeçalho, faixas, fontes) e adaptar os placeholders pros campos
          do template atual.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="source-tpl">Template fonte</Label>
        <Select value={sourceId} onValueChange={setSourceId} disabled={isProcessing}>
          <SelectTrigger id="source-tpl">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="clone-hint">Dica adicional (opcional)</Label>
        <Input
          id="clone-hint"
          placeholder="ex: Reduzir o tamanho das seções"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          disabled={isProcessing}
        />
      </div>

      {error && (
        <div className="flex gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/5 text-sm">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isProcessing}>
          Voltar
        </Button>
        <Button
          onClick={handleClone}
          disabled={!sourceId || isProcessing}
          className="gap-2 bg-enf hover:bg-enf-hover text-white"
        >
          {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
          {isProcessing ? "IA adaptando..." : "Clonar e adaptar"}
          {!isProcessing && <Sparkles className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

// ─── JSON edit (power user) ───
function JsonStep({
  initial,
  onBack,
  onApply,
}: {
  initial: LayoutNode | null;
  onBack: () => void;
  onApply: (l: LayoutNode) => void;
}) {
  const [text, setText] = useState(() => (initial ? JSON.stringify(initial, null, 2) : ""));
  const [error, setError] = useState<string | null>(null);

  function tryApply() {
    try {
      const parsed = JSON.parse(text);
      if (parsed.type !== "Document") {
        setError("Layout deve começar com nó { type: 'Document' }");
        return;
      }
      onApply(parsed as LayoutNode);
    } catch (e: any) {
      setError(`JSON inválido: ${e?.message ?? e}`);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Editar JSON do layout</h2>
        <p className="text-sm text-muted-foreground">
          Edição manual da árvore react-pdf. Validado antes do preview.
        </p>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="font-mono text-xs h-[500px] resize-none"
        spellCheck={false}
        placeholder={'{ "type": "Document", "children": [...] }'}
      />

      {error && (
        <div className="flex gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/5 text-sm">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button onClick={tryApply} className="gap-2 bg-enf hover:bg-enf-hover text-white">
          <Eye className="w-4 h-4" />
          Aplicar e ver preview
        </Button>
      </div>
    </div>
  );
}

// ─── Preview: PDFViewer com dados mock ───
function PreviewStep({
  layout,
  template,
  onBack,
  onEditJson,
  onSave,
  isSaving,
}: {
  layout: LayoutNode;
  template: { schema: unknown; name: string };
  onBack: () => void;
  onEditJson: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const { profile } = useAuth();

  // Dados mock pra testar o layout sem precisar de gravação real.
  const mockData = useMemo(() => buildMockData(template.schema), [template.schema]);

  const ctx = useMemo(
    () =>
      buildPdfContext({
        filled_data: mockData,
        patient: {
          full_name: "Maria Aparecida da Silva",
          social_name: null,
          medical_record: "0123456",
          registration: "789012",
          matricula: "421-2024-789",
          bed: "UTI-08",
          cpf: "123.456.789-00",
          birth_date: "1955-03-12",
          sex: "Feminino",
          plan: "Saúde Petrobras / Especial",
        },
        hospital: { name: "Clínica São Vicente / Rede D'Or", logo_url: null },
        ward: { name: "UTI Geral" },
        consultation: { created_at: new Date().toISOString() },
        professional: {
          full_name: profile?.full_name ?? "Enfermeiro Teste",
          registration: "COREN: 000000 - RJ",
        },
      }),
    [mockData, profile?.full_name],
  );

  const element = useMemo(() => {
    try {
      return renderNode(layout, ctx);
    } catch (e) {
      console.error("[preview] erro renderizando:", e);
      return null;
    }
  }, [layout, ctx]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">Preview do PDF</h2>
          <p className="text-sm text-muted-foreground">
            Renderização real com dados de exemplo. Se faltou ajustar algo, abra
            o JSON e edite. Senão, salve.
          </p>
        </div>
        <Button variant="outline" onClick={onEditJson} className="gap-2 shrink-0">
          <Code2 className="w-4 h-4" />
          Editar JSON
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-hidden">
          {element ? (
            <PDFViewer style={{ width: "100%", height: "70vh", border: "none" }} showToolbar>
              {element as never}
            </PDFViewer>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Não foi possível renderizar. Verifique o JSON.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSaving}>
          Voltar
        </Button>
        <Button
          onClick={onSave}
          disabled={isSaving || !element}
          className="gap-2 bg-enf hover:bg-enf-hover text-white"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Salvando..." : "Salvar design"}
        </Button>
      </div>
    </div>
  );
}

// Constrói dados mock plausíveis pra preview baseado no schema do template.
// Cada section fica com 1 valor por field — strings: "Lorem", numbers: 42,
// enums: primeira option, etc.
function buildMockData(schema: unknown): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  if (!schema || typeof schema !== "object") return result;
  const sections = Array.isArray((schema as Record<string, unknown>).sections)
    ? ((schema as Record<string, unknown>).sections as Record<string, unknown>[])
    : [];
  for (const section of sections) {
    const sectionId = String(section.id ?? "");
    if (!sectionId) continue;
    const fields = Array.isArray(section.fields)
      ? (section.fields as Record<string, unknown>[])
      : [];
    const sectionData: Record<string, unknown> = { _narrative: "Observação exemplo da seção." };
    for (const field of fields) {
      const fid = String(field.id ?? "");
      const type = field.type as string;
      sectionData[fid] = mockValueFor(type, field);
    }
    result[sectionId] = sectionData;
  }
  return result;
}

function mockValueFor(type: string, field: Record<string, unknown>): unknown {
  switch (type) {
    case "text":
      return "Texto exemplo";
    case "textarea":
      return "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
    case "number":
    case "number_with_unit":
      return 42;
    case "date":
      return "2026-05-15";
    case "datetime":
      return new Date().toISOString();
    case "boolean":
      return true;
    case "radio":
    case "select": {
      const opts = field.options as Array<{ value: unknown }> | undefined;
      return opts?.[0]?.value ?? "";
    }
    case "multi_checkbox": {
      const opts = field.options as Array<{ value: unknown }> | undefined;
      return opts?.slice(0, 2).map((o) => o.value) ?? [];
    }
    case "scale":
      return 5;
    case "scored_scale": {
      const items = field.items as Array<{ id: string; options?: Array<{ value: number }> }> | undefined;
      const obj: Record<string, number> = {};
      for (const item of items ?? []) {
        obj[item.id] = item.options?.[0]?.value ?? 1;
      }
      return obj;
    }
    case "table":
      return [];
    case "tri_state_checklist": {
      const items = field.items as Array<{ id: string }> | undefined;
      const obj: Record<string, string> = {};
      for (const item of items ?? []) obj[item.id] = "SIM";
      return obj;
    }
    case "time_window_multi":
      return [];
    default:
      return null;
  }
}
