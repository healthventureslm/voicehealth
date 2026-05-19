// Aba "Design" — atribui ou edita o display_layout (árvore react-pdf)
// que gera o PDF fiel do template.
//
// Estados:
//   - "choice": escolha do modo (upload foto / copiar de template / JSON)
//   - "upload": IA gera a partir de imagem
//   - "clone": IA adapta layout de outro template
//   - "json": editor JSON
//   - "preview": PDFViewer com dados mock + opção de regenerar

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Copy, Code2, Eye, Sparkles, Loader2, AlertCircle, FileText, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminTemplates } from "@/hooks/queries";
import { toast } from "sonner";
import { PDFViewer } from "@react-pdf/renderer";
import { renderNode } from "@/templates/pdfLayout/walker";
import { buildPdfContext } from "@/templates/pdfLayout/context";
import type { LayoutNode } from "@/templates/pdfLayout/types";
import type { TemplateSchema } from "@/templates/types";

interface DesignTabProps {
  templateName: string;
  schema: TemplateSchema;
  hospitalId?: string;
  currentLayout: LayoutNode | null;
  onLayoutChange: (l: LayoutNode) => void;
}

type Mode = "preview" | "choice" | "upload" | "clone" | "json";

export function DesignTab({
  templateName,
  schema,
  hospitalId,
  currentLayout,
  onLayoutChange,
}: DesignTabProps) {
  const [mode, setMode] = useState<Mode>(currentLayout ? "preview" : "choice");

  function applyLayout(layout: LayoutNode) {
    onLayoutChange(layout);
    setMode("preview");
  }

  if (mode === "preview" && currentLayout) {
    return (
      <DesignPreview
        layout={currentLayout}
        schema={schema}
        templateName={templateName}
        onRegenerate={() => setMode("choice")}
        onEditJson={() => setMode("json")}
      />
    );
  }

  if (mode === "upload") {
    return (
      <DesignUpload
        schema={schema}
        onBack={() => setMode("choice")}
        onGenerated={applyLayout}
      />
    );
  }

  if (mode === "clone") {
    return (
      <DesignClone
        targetSchema={schema}
        hospitalId={hospitalId}
        onBack={() => setMode("choice")}
        onGenerated={applyLayout}
      />
    );
  }

  if (mode === "json") {
    return (
      <DesignJson
        initial={currentLayout}
        onBack={() => setMode(currentLayout ? "preview" : "choice")}
        onApply={applyLayout}
      />
    );
  }

  // mode === "choice"
  return <DesignChoice hospitalId={hospitalId} onPick={setMode} />;
}

// ─── Choice ───
function DesignChoice({
  hospitalId,
  onPick,
}: {
  hospitalId?: string;
  onPick: (m: Mode) => void;
}) {
  const { data: templates } = useAdminTemplates(hospitalId);
  const cloneable = useMemo(
    () => (templates ?? []).filter((t: any) => t.display_layout),
    [templates],
  );

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-3">
      <DesignChoiceCard
        icon={<Upload className="w-6 h-6" />}
        title="Gerar de foto/PDF"
        description="A IA recebe a imagem do documento real e replica o layout (cabeçalho, faixas, fontes)."
        onClick={() => onPick("upload")}
      />
      <DesignChoiceCard
        icon={<Copy className="w-6 h-6" />}
        title="Copiar de outro template"
        description={
          cloneable.length > 0
            ? `Reaproveita o shell visual de outro template do hospital (${cloneable.length} disponível${cloneable.length === 1 ? "" : "is"}). IA adapta os placeholders.`
            : "Nenhum outro template do hospital tem design salvo ainda."
        }
        onClick={() => onPick("clone")}
        disabled={cloneable.length === 0}
      />
      <DesignChoiceCard
        icon={<Code2 className="w-6 h-6" />}
        title="Editar JSON manualmente"
        description="Edição direta da árvore react-pdf — pra power user que quer controle fino."
        onClick={() => onPick("json")}
      />
    </div>
  );
}

function DesignChoiceCard({
  icon, title, description, onClick, disabled,
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

// ─── Upload ───
function DesignUpload({
  schema, onBack, onGenerated,
}: {
  schema: TemplateSchema;
  onBack: () => void;
  onGenerated: (l: LayoutNode) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [hint, setHint] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleProcess() {
    if (!file) return;
    setError(null);
    setIsProcessing(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
      const base64 = btoa(bin);
      const { data, error: fnErr } = await supabase.functions.invoke(
        "template-design-from-document",
        { body: { file_base64: base64, mime_type: file.type, schema, hint: hint.trim() || undefined } },
      );
      if (fnErr) throw fnErr;
      if (!data?.success || !data?.display_layout) {
        throw new Error(data?.error ?? "IA não retornou layout válido");
      }
      onGenerated(data.display_layout as LayoutNode);
      toast.success("Design gerado. Revise no preview.");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-4">
      <Card>
        <CardContent className="p-6">
          <label className="block text-center cursor-pointer">
            <input
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
          placeholder="ex: Manter cabeçalho institucional fiel"
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
        <Button variant="outline" onClick={onBack} disabled={isProcessing}>Voltar</Button>
        <Button
          onClick={handleProcess}
          disabled={!file || isProcessing}
          className="gap-2 bg-enf hover:bg-enf-hover text-white"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isProcessing ? "IA processando..." : "Gerar design"}
        </Button>
      </div>

      {isProcessing && (
        <p className="text-xs text-center text-muted-foreground italic">
          30-60 segundos pra replicar o layout fielmente.
        </p>
      )}
    </div>
  );
}

// ─── Clone ───
function DesignClone({
  targetSchema, hospitalId, onBack, onGenerated,
}: {
  targetSchema: TemplateSchema;
  hospitalId?: string;
  onBack: () => void;
  onGenerated: (l: LayoutNode) => void;
}) {
  const { data: templates } = useAdminTemplates(hospitalId);
  const sources = useMemo(
    () => (templates ?? []).filter((t: any) => t.display_layout),
    [templates],
  );
  const [sourceId, setSourceId] = useState("");
  const [hint, setHint] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClone() {
    const src = sources.find((s: any) => s.id === sourceId);
    if (!src) return;
    setError(null);
    setIsProcessing(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "template-design-clone",
        {
          body: {
            source_layout: (src as any).display_layout,
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
      toast.success("Design clonado. Revise no preview.");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="source-tpl">Template fonte</Label>
        <Select value={sourceId} onValueChange={setSourceId} disabled={isProcessing}>
          <SelectTrigger id="source-tpl">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {sources.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="clone-hint">Dica adicional (opcional)</Label>
        <Input
          id="clone-hint"
          placeholder="ex: Reduzir tamanho das seções"
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
        <Button variant="outline" onClick={onBack} disabled={isProcessing}>Voltar</Button>
        <Button
          onClick={handleClone}
          disabled={!sourceId || isProcessing}
          className="gap-2 bg-enf hover:bg-enf-hover text-white"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isProcessing ? "IA adaptando..." : "Clonar e adaptar"}
        </Button>
      </div>
    </div>
  );
}

// ─── JSON ───
function DesignJson({
  initial, onBack, onApply,
}: {
  initial: LayoutNode | null;
  onBack: () => void;
  onApply: (l: LayoutNode) => void;
}) {
  const [text, setText] = useState(() => initial ? JSON.stringify(initial, null, 2) : "");
  const [error, setError] = useState<string | null>(null);

  function tryApply() {
    try {
      const parsed = JSON.parse(text);
      if (parsed.type !== "Document") {
        setError("Layout deve começar com { type: 'Document' }");
        return;
      }
      onApply(parsed as LayoutNode);
    } catch (e: any) {
      setError(`JSON inválido: ${e?.message ?? e}`);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-3">
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
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={tryApply} className="gap-2 bg-enf hover:bg-enf-hover text-white">
          <Eye className="w-4 h-4" />
          Aplicar e ver preview
        </Button>
      </div>
    </div>
  );
}

// ─── Preview ───
function DesignPreview({
  layout, schema, templateName, onRegenerate, onEditJson,
}: {
  layout: LayoutNode;
  schema: TemplateSchema;
  templateName: string;
  onRegenerate: () => void;
  onEditJson: () => void;
}) {
  const { profile } = useAuth();
  const mockData = useMemo(() => buildMockData(schema), [schema]);
  const ctx = useMemo(
    () => buildPdfContext({
      filled_data: mockData,
      patient: {
        full_name: "Maria Aparecida da Silva",
        medical_record: "0123456",
        bed: "UTI-08",
        cpf: "123.456.789-00",
        birth_date: "1955-03-12",
        sex: "Feminino",
        plan: "Saúde Petrobras",
      },
      hospital: { name: "Clínica São Vicente / Rede D'Or" },
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
      console.error("[preview] erro:", e);
      return null;
    }
  }, [layout, ctx]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onRegenerate} className="gap-2">
          <RefreshCcw className="w-3.5 h-3.5" />
          Regerar
        </Button>
        <Button variant="outline" size="sm" onClick={onEditJson} className="gap-2">
          <Code2 className="w-3.5 h-3.5" />
          Editar JSON
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-hidden">
          {element ? (
            <PDFViewer style={{ width: "100%", height: "65vh", border: "none" }} showToolbar>
              {element as never}
            </PDFViewer>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Não foi possível renderizar.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Mock data por type (mesma lógica do AdminTemplateDesign anterior).
function buildMockData(schema: TemplateSchema): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const section of schema.sections ?? []) {
    const sectionData: Record<string, unknown> = { _narrative: "Observação exemplo." };
    for (const field of section.fields ?? []) {
      sectionData[field.id] = mockValueFor(field);
    }
    result[section.id] = sectionData;
  }
  return result;
}

function mockValueFor(field: Record<string, unknown>): unknown {
  const type = field.type as string;
  switch (type) {
    case "text": return "Texto exemplo";
    case "textarea": return "Lorem ipsum dolor sit amet.";
    case "number":
    case "number_with_unit": return 42;
    case "date": return "2026-05-15";
    case "datetime": return new Date().toISOString();
    case "boolean": return true;
    case "radio":
    case "select": {
      const opts = field.options as Array<{ value: unknown }> | undefined;
      return opts?.[0]?.value ?? "";
    }
    case "multi_checkbox": {
      const opts = field.options as Array<{ value: unknown }> | undefined;
      return opts?.slice(0, 2).map((o) => o.value) ?? [];
    }
    case "scale": return 5;
    case "scored_scale": {
      const items = field.items as Array<{ id: string; options?: Array<{ value: number }> }> | undefined;
      const obj: Record<string, number> = {};
      for (const item of items ?? []) obj[item.id] = item.options?.[0]?.value ?? 1;
      return obj;
    }
    case "tri_state_checklist": {
      const items = field.items as Array<{ id: string }> | undefined;
      const obj: Record<string, string> = {};
      for (const item of items ?? []) obj[item.id] = "SIM";
      return obj;
    }
    case "table": return [];
    case "time_window_multi": return [];
    default: return null;
  }
}
