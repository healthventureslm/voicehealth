import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAdminTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate,
} from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, FileText, Lock, Globe } from "lucide-react";
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

export default function AdminTemplates() {
  const { hospitalIds, user } = useAuth();
  const hospitalId = hospitalIds[0];

  const { data: templates, isLoading } = useAdminTemplates(hospitalId);
  const createTpl = useCreateTemplate();
  const updateTpl = useUpdateTemplate();
  const deleteTpl = useDeleteTemplate();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"report_templates"> | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }
  function openEdit(t: Tables<"report_templates">) {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description ?? "",
      prompt: t.prompt,
      applicable_ward_types: t.applicable_ward_types ?? [],
      applicable_roles: t.applicable_roles ?? [],
      is_active: t.is_active,
    });
    setOpen(true);
  }

  function toggleArr<T extends string>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
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
      setOpen(false);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  async function handleDelete(t: Tables<"report_templates">) {
    try {
      await deleteTpl.mutateAsync(t.id);
      toast.success("Template excluído");
    } catch (e: any) {
      toast.error(`Não foi possível excluir: ${e?.message ?? e}`);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          icon={<FileText className="w-6 h-6" />}
          title="Templates de relatório"
          subtitle="Defina como a IA deve estruturar os relatórios. Templates globais (Health Ventures) aparecem como read-only — você pode criar versões próprias do hospital."
          actions={
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} className="gap-2">
                <Plus className="w-4 h-4" /> Novo template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editing ? `Editar "${editing.name}"` : "Novo template"}
                </DialogTitle>
                <DialogDescription>
                  Cada save cria uma nova versão. O prompt é o "como gerar o relatório"
                  passado pra IA, com a transcrição do atendimento como insumo.
                </DialogDescription>
              </DialogHeader>

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
                    rows={10}
                    className="font-mono text-sm"
                    value={form.prompt}
                    onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
                    placeholder="Você é um assistente clínico... Gere uma evolução de enfermagem em formato SOAP..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use <code>{"{{transcription}}"}</code> se quiser inserir a transcrição em
                    um lugar específico, ou deixe sem placeholder que a transcrição é anexada
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
                    <p className="text-xs text-muted-foreground mt-1">
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
                    <p className="text-xs text-muted-foreground mt-1">
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

              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={createTpl.isPending || updateTpl.isPending}>
                  {(createTpl.isPending || updateTpl.isPending) ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          }
        />

        {isLoading ? (
          <EmptyState loading />
        ) : (templates ?? []).length === 0 ? (
          <EmptyState
            title="Nenhum template"
            description="Crie templates próprios do hospital ou aproveite os globais."
          />
        ) : (
          <div className="space-y-3">
            {(templates ?? []).map((t) => {
              const isGlobal = t.hospital_id === null;
              const isMine = t.hospital_id === hospitalId;
              return (
                <Card key={t.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="heading-card flex items-center gap-2">
                          {t.name}
                          {!t.is_active && <Badge variant="secondary">inativo</Badge>}
                        </CardTitle>
                        {t.description && (
                          <CardDescription className="mt-1">{t.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {isGlobal && (
                          <Badge variant="outline" className="gap-1">
                            <Globe className="w-3 h-3" /> global
                          </Badge>
                        )}
                        {isMine && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir "{t.name}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Consultas existentes que usaram este template
                                    continuarão funcionando, mas novos atendimentos não
                                    poderão escolhê-lo.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(t)}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        {!isMine && !isGlobal && (
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1 text-xs">
                      {(t.applicable_ward_types ?? []).map((wt) => (
                        <Badge key={wt} variant="outline">
                          {WARD_TYPES.find((x) => x.value === wt)?.label ?? wt}
                        </Badge>
                      ))}
                      {(t.applicable_roles ?? []).map((r) => (
                        <Badge key={r} variant="secondary">
                          {ROLES.find((x) => x.value === r)?.label ?? r}
                        </Badge>
                      ))}
                      {(t.applicable_ward_types ?? []).length === 0 &&
                        (t.applicable_roles ?? []).length === 0 && (
                          <span className="text-muted-foreground">qualquer setor / qualquer papel</span>
                        )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
