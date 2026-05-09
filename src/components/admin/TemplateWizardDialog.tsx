import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCreateTemplate, useUpdateTemplate,
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
  FileText, Sparkles, UploadCloud, Loader2, ArrowLeft, Pencil,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables, Enums } from "@/integrations/supabase/types";

const WARD_TYPES: Array<{ value: Enums<"ward_type">; label: string }> = [
  { value: "uti",              label: "UTI" },
  { value: "enfermaria",       label: "Enfermaria" },
  { value: "centro_cirurgico", label: "Centro Cirúrgico" },
  { value: "pronto_socorro",   label: "Pronto-Socorro" },
  { value: "ambulatorio",      label: "Ambulatório" },
];

const ROLES: Array<{ value: Enums<"app_role">; label: string }> = [
  { value: "doctor", label: "Médico(a)" },
  { value: "nurse",  label: "Enfermeiro(a)" },
];

const ACCEPTED_MIMES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

interface FormState {
  name: string;
  description: string;
  prompt: string;
  applicable_ward_types: Enums<"ward_type">[];
  applicable_roles: Enums<"app_role">[];
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  prompt: "",
  applicable_ward_types: [],
  applicable_roles: [],
  is_active: true,
};

type Step = "choice" | "upload" | "form";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se passado, abre direto no form em modo edição. */
  editing?: Tables<"report_templates"> | null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Tira o prefixo "data:...;base64,"
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function toggleArr<T extends string>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export function TemplateWizardDialog({ open, onOpenChange, editing }: Props) {
  const { hospitalIds, user } = useAuth();
  const hospitalId = hospitalIds[0];
  const createTpl = useCreateTemplate();
  const updateTpl = useUpdateTemplate();

  const [step, setStep] = useState<Step>(editing ? "form" : "choice");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Estado de upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [hint, setHint] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Reset interno quando o diálogo abre/fecha ou quando muda o "editing"
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? "",
        prompt: editing.prompt,
        applicable_ward_types: editing.applicable_ward_types ?? [],
        applicable_roles: editing.applicable_roles ?? [],
        is_active: editing.is_active,
      });
      setStep("form");
    } else {
      setForm(EMPTY_FORM);
      setStep("choice");
    }
    setFile(null);
    setHint("");
    setUploadError(null);
    setAnalyzing(false);
  }, [open, editing]);

  function pickFile() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ACCEPTED_MIMES.includes(f.type)) {
      setUploadError("Formato não suportado. Envie PDF, PNG, JPG ou WebP.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setUploadError("Arquivo grande demais (limite 10MB).");
      return;
    }
    setFile(f);
  }

  async function analyzeDocument() {
    if (!file) return;
    setAnalyzing(true);
    setUploadError(null);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke(
        "generate-template-from-document",
        {
          body: {
            file_base64: base64,
            mime_type: file.type,
            hint: hint.trim() || undefined,
          },
        },
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Falha desconhecida");

      // Filtra os arrays pra valores válidos do nosso enum
      const validWards = WARD_TYPES.map((w) => w.value);
      const validRoles = ROLES.map((r) => r.value);

      setForm({
        name: data.name ?? "",
        description: data.description ?? "",
        prompt: data.prompt ?? "",
        applicable_ward_types: (data.applicable_ward_types ?? []).filter(
          (w: string): w is Enums<"ward_type"> => validWards.includes(w as any),
        ),
        applicable_roles: (data.applicable_roles ?? []).filter(
          (r: string): r is Enums<"app_role"> => validRoles.includes(r as any),
        ),
        is_active: true,
      });
      toast.success("Template extraído. Revise os campos antes de salvar.");
      setStep("form");
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setUploadError(msg);
      toast.error(`Erro ao analisar: ${msg}`);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    if (!form.prompt.trim()) {
      toast.error("Prompt obrigatório");
      return;
    }
    try {
      if (editing) {
        await updateTpl.mutateAsync({
          id: editing.id,
          patch: {
            name: form.name.trim(),
            description: form.description.trim() || null,
            prompt: form.prompt,
            applicable_ward_types: form.applicable_ward_types,
            applicable_roles: form.applicable_roles,
            is_active: form.is_active,
            version: (editing.version ?? 1) + 1,
          },
        });
        toast.success("Template atualizado");
      } else {
        if (!hospitalId) {
          toast.error("Você não está vinculado a um hospital");
          return;
        }
        await createTpl.mutateAsync({
          hospital_id: hospitalId,
          name: form.name.trim(),
          description: form.description.trim() || null,
          prompt: form.prompt,
          applicable_ward_types: form.applicable_ward_types,
          applicable_roles: form.applicable_roles,
          is_active: form.is_active,
          created_by: user?.id ?? null,
        });
        toast.success("Template criado");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? `Editar "${editing.name}"`
              : step === "choice"
                ? "Novo template"
                : step === "upload"
                  ? "Importar de documento"
                  : "Revisar template"}
          </DialogTitle>
          <DialogDescription>
            {step === "choice" && "Crie do zero ou importe um documento existente para a IA extrair a estrutura."}
            {step === "upload" && "Envie um PDF ou foto do formulário. A IA vai gerar o prompt seguindo o padrão Clínica São Vicente."}
            {step === "form" && "Cada save cria uma nova versão. O prompt é o 'como gerar o relatório' passado pra IA, com a transcrição da gravação como insumo."}
          </DialogDescription>
        </DialogHeader>

        {/* ─── Step: choice ─── */}
        {step === "choice" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <ChoiceCard
              icon={<Pencil className="w-5 h-5" />}
              title="Criar do zero"
              description="Escrever nome, descrição e prompt manualmente."
              onClick={() => setStep("form")}
            />
            <ChoiceCard
              icon={<Sparkles className="w-5 h-5" />}
              title="Importar de documento"
              description="Enviar PDF ou foto e deixar a IA gerar o prompt."
              onClick={() => setStep("upload")}
              highlighted
            />
          </div>
        )}

        {/* ─── Step: upload ─── */}
        {step === "upload" && (
          <div className="space-y-4 py-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={onFileChange}
            />

            <button
              type="button"
              onClick={pickFile}
              className={`w-full flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-lg transition-colors ${
                file
                  ? "border-enf bg-enf-soft"
                  : "border-[var(--border-color)] hover:border-enf hover:bg-[var(--bg-card-hov)]"
              }`}
            >
              {file ? (
                <>
                  <CheckCircle2 className="w-8 h-8 text-enf-deep" />
                  <div className="text-center">
                    <div className="text-sm font-semibold text-enf-deep">{file.name}</div>
                    <div
                      className="text-xs mt-1"
                      style={{ color: "var(--text-soft)" }}
                    >
                      {(file.size / 1024).toFixed(0)} KB · {file.type}
                    </div>
                    <div className="text-xs mt-2 underline" style={{ color: "var(--enf-deep)" }}>
                      trocar arquivo
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <UploadCloud className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
                  <div className="text-center">
                    <div className="text-sm font-medium">Clique para escolher um arquivo</div>
                    <div
                      className="text-xs mt-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      PDF, PNG, JPG ou WebP (até 10MB)
                    </div>
                  </div>
                </>
              )}
            </button>

            <div>
              <Label>Dica de tipo (opcional)</Label>
              <Input
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder='Ex: "Evolução de enfermagem da UTI" ou "Histórico de admissão"'
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                Ajuda a IA a entender o contexto. Se vazio, ela infere do conteúdo.
              </p>
            </div>

            {uploadError && (
              <div
                className="flex items-start gap-2 p-3 rounded-md text-sm"
                style={{
                  background: "var(--uti-soft)",
                  color: "var(--uti-text)",
                }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{uploadError}</span>
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
                placeholder="Ex: Evolução de Enfermagem UTI"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Quando usar este template"
              />
            </div>
            <div>
              <Label>Prompt da IA *</Label>
              <Textarea
                rows={12}
                className="font-mono text-sm"
                value={form.prompt}
                onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
                placeholder="Você é um assistente clínico... Gere uma evolução de enfermagem em formato SOAP..."
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                Use <code>{"{{transcription}}"}</code> para inserir a transcrição em
                um lugar específico, ou deixe sem placeholder que ela é anexada
                automaticamente.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Setores aplicáveis</Label>
                <div className="space-y-1 border rounded-md p-2 text-sm">
                  {WARD_TYPES.map((wt) => (
                    <div key={wt.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`tpl-wt-${wt.value}`}
                        checked={form.applicable_ward_types.includes(wt.value)}
                        onCheckedChange={() =>
                          setForm((p) => ({
                            ...p,
                            applicable_ward_types: toggleArr(p.applicable_ward_types, wt.value),
                          }))
                        }
                      />
                      <Label htmlFor={`tpl-wt-${wt.value}`} className="cursor-pointer text-sm font-normal">
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
                <Label className="mb-2 block">Papéis aplicáveis</Label>
                <div className="space-y-1 border rounded-md p-2 text-sm">
                  {ROLES.map((r) => (
                    <div key={r.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`tpl-r-${r.value}`}
                        checked={form.applicable_roles.includes(r.value)}
                        onCheckedChange={() =>
                          setForm((p) => ({
                            ...p,
                            applicable_roles: toggleArr(p.applicable_roles, r.value),
                          }))
                        }
                      />
                      <Label htmlFor={`tpl-r-${r.value}`} className="cursor-pointer text-sm font-normal">
                        {r.label}
                      </Label>
                    </div>
                  ))}
                </div>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Vazio = qualquer papel
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="tpl-active"
                checked={form.is_active}
                onCheckedChange={(c) =>
                  setForm((p) => ({ ...p, is_active: c === true }))
                }
              />
              <Label htmlFor="tpl-active" className="cursor-pointer">
                Ativo (aparece pra escolha em novas consultas)
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
          {step === "upload" && (
            <>
              <Button variant="ghost" onClick={() => setStep("choice")} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </Button>
              <Button
                onClick={analyzeDocument}
                disabled={!file || analyzing}
                className="gap-2 bg-enf hover:bg-enf-hover text-white shadow-sm font-semibold"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Analisando…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Analisar com IA
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
                disabled={createTpl.isPending || updateTpl.isPending}
                className="bg-enf hover:bg-enf-hover text-white shadow-sm font-semibold"
              >
                {createTpl.isPending || updateTpl.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      className={`text-left p-4 rounded-lg border-2 transition-all hover:shadow-md ${
        highlighted
          ? "border-enf bg-enf-soft hover:border-enf-hover"
          : "border-[var(--border-color)] hover:border-[var(--border-hov)]"
      }`}
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
