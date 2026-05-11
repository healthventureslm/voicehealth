import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAdminTemplates, useCreateScript, useUpdateScript,
  type AdminScript,
} from "@/hooks/queries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles, Loader2, ArrowLeft, Pencil, AlertCircle, Plus, Trash2,
  FileText, Search,
} from "lucide-react";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";
import type { ScriptField } from "@/hooks/useScriptMatching";
import { cn } from "@/lib/utils";

const WARD_TYPES: Array<{ value: Enums<"ward_type">; label: string }> = [
  { value: "uti",              label: "UTI" },
  { value: "enfermaria",       label: "Enfermaria" },
  { value: "centro_cirurgico", label: "Centro Cirúrgico" },
  { value: "pronto_socorro",   label: "Pronto-Socorro" },
  { value: "ambulatorio",      label: "Ambulatório" },
];

interface FormState {
  name: string;
  description: string;
  fields: ScriptField[];
  applicable_ward_types: Enums<"ward_type">[];
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  fields: [],
  applicable_ward_types: [],
  is_active: true,
};

type Step = "choice" | "pick-template" | "form";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se passado, abre direto no form em modo edição. */
  editing?: AdminScript | null;
}

function toggleArr<T extends string>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function ScriptWizardDialog({ open, onOpenChange, editing }: Props) {
  const { hospitalIds, user } = useAuth();
  const hospitalId = hospitalIds[0];
  const { data: templates } = useAdminTemplates(hospitalId);
  const createScript = useCreateScript();
  const updateScript = useUpdateScript();

  const [step, setStep] = useState<Step>(editing ? "form" : "choice");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Etapa pick-template
  const [search, setSearch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Reset interno
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? "",
        fields: editing.fields,
        applicable_ward_types: editing.applicable_ward_types,
        is_active: editing.is_active,
      });
      setStep("form");
    } else {
      setForm(EMPTY_FORM);
      setStep("choice");
    }
    setSearch("");
    setSelectedTemplateId(null);
    setGenerateError(null);
    setGenerating(false);
  }, [open, editing]);

  const filteredTemplates = (templates ?? [])
    .filter((t) => t.is_active)
    .filter((t) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
      );
    });

  async function generateFromTemplate() {
    const tpl = (templates ?? []).find((t) => t.id === selectedTemplateId);
    if (!tpl) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-script-from-template",
        {
          body: {
            template_name: tpl.name,
            template_prompt: tpl.prompt,
            applicable_ward_types: tpl.applicable_ward_types ?? [],
          },
        },
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Falha desconhecida");

      const validWards = WARD_TYPES.map((w) => w.value);
      const fields: ScriptField[] = Array.isArray(data.fields)
        ? data.fields
            .filter((f: any) => f && typeof f === "object")
            .map((f: any) => ({
              id: String(f.id ?? "").trim() || slugify(f.label ?? ""),
              label: String(f.label ?? "").trim(),
              required: Boolean(f.required),
              keywords: Array.isArray(f.keywords)
                ? f.keywords.map((k: any) => String(k).trim()).filter(Boolean)
                : [],
            }))
            .filter((f: ScriptField) => f.id && f.label)
        : [];

      if (fields.length === 0) {
        throw new Error("A IA não conseguiu extrair campos do template");
      }

      setForm({
        name: String(data.name ?? tpl.name).trim() || tpl.name,
        description: typeof data.description === "string" ? data.description : "",
        fields,
        applicable_ward_types: Array.isArray(data.applicable_ward_types)
          ? data.applicable_ward_types.filter((w: string): w is Enums<"ward_type"> =>
              validWards.includes(w as any),
            )
          : tpl.applicable_ward_types ?? [],
        is_active: true,
      });
      toast.success(`Roteiro gerado com ${fields.length} campos. Revise antes de salvar.`);
      setStep("form");
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setGenerateError(msg);
      toast.error(`Erro ao gerar: ${msg}`);
    } finally {
      setGenerating(false);
    }
  }

  function addField() {
    setForm((p) => ({
      ...p,
      fields: [
        ...p.fields,
        { id: `campo_${p.fields.length + 1}`, label: "", required: false, keywords: [] },
      ],
    }));
  }

  function updateField(idx: number, patch: Partial<ScriptField>) {
    setForm((p) => ({
      ...p,
      fields: p.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  }

  function removeField(idx: number) {
    setForm((p) => ({ ...p, fields: p.fields.filter((_, i) => i !== idx) }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    if (form.fields.length === 0) {
      toast.error("Adicione pelo menos um campo");
      return;
    }
    const invalid = form.fields.find((f) => !f.label.trim() || !f.id.trim());
    if (invalid) {
      toast.error("Todos os campos precisam de label e id");
      return;
    }

    // Garante ids únicos
    const ids = new Set<string>();
    const fieldsClean = form.fields.map((f) => {
      let id = slugify(f.id) || slugify(f.label);
      let n = 1;
      while (ids.has(id)) {
        n += 1;
        id = `${slugify(f.label)}_${n}`;
      }
      ids.add(id);
      return {
        id,
        label: f.label.trim(),
        required: !!f.required,
        keywords: f.keywords
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean)
          // dedup
          .filter((k, i, a) => a.indexOf(k) === i),
      };
    });

    try {
      if (editing) {
        await updateScript.mutateAsync({
          id: editing.id,
          patch: {
            name: form.name.trim(),
            description: form.description.trim() || null,
            fields: fieldsClean,
            applicable_ward_types: form.applicable_ward_types,
            is_active: form.is_active,
          },
        });
        toast.success("Roteiro atualizado");
      } else {
        if (!hospitalId) {
          toast.error("Você não está vinculado a um hospital");
          return;
        }
        await createScript.mutateAsync({
          hospital_id: hospitalId,
          name: form.name.trim(),
          description: form.description.trim() || null,
          fields: fieldsClean,
          applicable_ward_types: form.applicable_ward_types,
          is_active: form.is_active,
          created_by: user?.id ?? null,
        });
        toast.success("Roteiro criado");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto grid-cols-[minmax(0,1fr)]">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? `Editar "${editing.name}"`
              : step === "choice"
                ? "Novo roteiro"
                : step === "pick-template"
                  ? "Escolher template base"
                  : "Revisar roteiro"}
          </DialogTitle>
          <DialogDescription>
            {step === "choice" && "Crie do zero ou gere automaticamente a partir de um template de relatório existente."}
            {step === "pick-template" && "A IA vai ler o prompt do template e gerar os pontos do roteiro com suas palavras-chave."}
            {step === "form" && "Cada campo é um ponto que vai aparecer no teleprompter. As palavras-chave determinam quando o ponto é marcado como coberto durante a gravação."}
          </DialogDescription>
        </DialogHeader>

        {/* ─── Step: choice ─── */}
        {step === "choice" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <ChoiceCard
              icon={<Pencil className="w-5 h-5" />}
              title="Criar do zero"
              description="Escrever nome, descrição e cada ponto manualmente."
              onClick={() => setStep("form")}
            />
            <ChoiceCard
              icon={<Sparkles className="w-5 h-5" />}
              title="Gerar de um template"
              description="A IA lê um template existente e cria o roteiro pareado."
              onClick={() => setStep("pick-template")}
              highlighted
            />
          </div>
        )}

        {/* ─── Step: pick-template ─── */}
        {step === "pick-template" && (
          <div className="space-y-3 py-1">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "var(--text-muted)" }}
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar template…"
                className="pl-10"
              />
            </div>

            <div className="border rounded-lg max-h-[360px] overflow-y-auto">
              {filteredTemplates.length === 0 ? (
                <p
                  className="text-sm py-6 text-center"
                  style={{ color: "var(--text-muted)" }}
                >
                  {search ? "Nenhum template bate com a busca." : "Nenhum template disponível."}
                </p>
              ) : (
                filteredTemplates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(t.id)}
                    className={cn(
                      "w-full text-left p-3 border-b last:border-b-0 transition-colors flex items-start gap-3",
                      selectedTemplateId === t.id
                        ? "bg-enf-soft"
                        : "hover:bg-[var(--bg-card-hov)]",
                    )}
                  >
                    <FileText
                      className="w-4 h-4 mt-1 flex-shrink-0"
                      style={{
                        color:
                          selectedTemplateId === t.id
                            ? "var(--enf-deep)"
                            : "var(--text-muted)",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{t.name}</div>
                      {t.description && (
                        <div
                          className="text-xs mt-1 line-clamp-2"
                          style={{ color: "var(--text-soft)" }}
                        >
                          {t.description}
                        </div>
                      )}
                      {t.applicable_ward_types && t.applicable_ward_types.length > 0 && (
                        <div
                          className="text-[11px] mt-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {t.applicable_ward_types
                            .map((w) => WARD_TYPES.find((x) => x.value === w)?.label ?? w)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            {generateError && (
              <div
                className="flex items-start gap-2 p-3 rounded-md text-sm"
                style={{ background: "var(--uti-soft)", color: "var(--uti-text)" }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{generateError}</span>
              </div>
            )}
          </div>
        )}

        {/* ─── Step: form ─── */}
        {step === "form" && (
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Evolução de Enfermagem"
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                Deve bater com o nome do template — pareamento 1:1.
              </p>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Quando este roteiro aparece"
              />
            </div>

            <div>
              <Label className="mb-2 block">Setores aplicáveis</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 border rounded-md p-2 text-sm">
                {WARD_TYPES.map((wt) => (
                  <div key={wt.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`scr-wt-${wt.value}`}
                      checked={form.applicable_ward_types.includes(wt.value)}
                      onCheckedChange={() =>
                        setForm((p) => ({
                          ...p,
                          applicable_ward_types: toggleArr(p.applicable_ward_types, wt.value),
                        }))
                      }
                    />
                    <Label
                      htmlFor={`scr-wt-${wt.value}`}
                      className="cursor-pointer text-sm font-normal"
                    >
                      {wt.label}
                    </Label>
                  </div>
                ))}
              </div>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                Vazio = qualquer setor
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Pontos do roteiro *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addField} className="gap-1">
                  <Plus className="w-3 h-3" /> Adicionar
                </Button>
              </div>
              {form.fields.length === 0 ? (
                <p
                  className="text-sm text-center py-6 border rounded-md"
                  style={{ color: "var(--text-muted)" }}
                >
                  Nenhum ponto ainda. Adicione manualmente ou volte e gere por IA.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.fields.map((f, idx) => (
                    <FieldEditor
                      key={idx}
                      field={f}
                      onChange={(patch) => updateField(idx, patch)}
                      onRemove={() => removeField(idx)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="scr-active"
                checked={form.is_active}
                onCheckedChange={(c) =>
                  setForm((p) => ({ ...p, is_active: c === true }))
                }
              />
              <Label htmlFor="scr-active" className="cursor-pointer">
                Ativo (aparece pra escolha em novas gravações)
              </Label>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          {step === "choice" && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          {step === "pick-template" && (
            <>
              <Button variant="ghost" onClick={() => setStep("choice")} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </Button>
              <Button
                onClick={generateFromTemplate}
                disabled={!selectedTemplateId || generating}
                className="gap-2 bg-enf hover:bg-enf-hover text-white shadow-sm font-semibold"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Gerando…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Gerar roteiro
                  </>
                )}
              </Button>
            </>
          )}
          {step === "form" && (
            <>
              {!editing && (
                <Button
                  variant="ghost"
                  onClick={() => setStep("choice")}
                  className="gap-2 sm:mr-auto"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </Button>
              )}
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={createScript.isPending || updateScript.isPending}
                className="bg-enf hover:bg-enf-hover text-white shadow-sm font-semibold"
              >
                {createScript.isPending || updateScript.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldEditor({
  field,
  onChange,
  onRemove,
}: {
  field: ScriptField;
  onChange: (patch: Partial<ScriptField>) => void;
  onRemove: () => void;
}) {
  const [kwInput, setKwInput] = useState("");

  function addKeyword() {
    const v = kwInput.trim().toLowerCase();
    if (!v) return;
    if (field.keywords.includes(v)) {
      setKwInput("");
      return;
    }
    onChange({ keywords: [...field.keywords, v] });
    setKwInput("");
  }

  function removeKeyword(kw: string) {
    onChange({ keywords: field.keywords.filter((k) => k !== kw) });
  }

  return (
    <div className="border rounded-md p-3 space-y-2 bg-[var(--bg-card-hov)]">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <Textarea
            rows={2}
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Ex: Avaliação neurológica (consciência, Glasgow)"
            className="text-sm bg-background"
          />
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`req-${field.id}`}
                checked={field.required}
                onCheckedChange={(c) => onChange({ required: c === true })}
              />
              <Label htmlFor={`req-${field.id}`} className="cursor-pointer text-xs font-normal">
                Obrigatório
              </Label>
            </div>
            <div className="flex-1 text-xs" style={{ color: "var(--text-muted)" }}>
              id: <code>{field.id}</code>
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-destructive flex-shrink-0"
          aria-label="Remover ponto"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div>
        <Label className="text-xs">Palavras-chave (sem acentos)</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input
            value={kwInput}
            onChange={(e) => setKwInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addKeyword();
              }
            }}
            placeholder="Digite e Enter pra adicionar"
            className="text-sm bg-background h-8"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addKeyword}
            disabled={!kwInput.trim()}
          >
            Adicionar
          </Button>
        </div>
        {field.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {field.keywords.map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => removeKeyword(kw)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-background border hover:bg-uti-soft hover:text-uti-text hover:border-uti-text transition-colors"
                title="Clique para remover"
              >
                {kw}
                <span className="opacity-50">×</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChoiceCard({
  icon, title, description, onClick, highlighted,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  highlighted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left p-4 rounded-lg border-2 transition-all hover:shadow-md",
        highlighted
          ? "border-enf bg-enf-soft hover:border-enf-hover"
          : "border-[var(--border-color)] hover:border-[var(--border-hov)]",
      )}
    >
      <div
        className="w-10 h-10 rounded-md flex items-center justify-center mb-3"
        style={{
          background: highlighted ? "white" : "var(--bg-card-hov)",
          color: highlighted ? "var(--enf-deep)" : "var(--text-soft)",
        }}
      >
        {icon}
      </div>
      <div
        className="text-[14px] font-semibold mb-1"
        style={{ color: highlighted ? "var(--enf-deep)" : "var(--text)" }}
      >
        {title}
      </div>
      <div
        className="text-[12px] leading-relaxed"
        style={{ color: highlighted ? "var(--enf-deep)" : "var(--text-soft)" }}
      >
        {description}
      </div>
    </button>
  );
}
