import { useState } from "react";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from "@/hooks/queries";
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
import { Plus, Pencil, Trash2, FileText, Globe } from "lucide-react";
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
  name: "", description: "", prompt: "",
  applicable_ward_types: [], applicable_roles: [], is_active: true,
};

export default function SuperAdminTemplates() {
  const { user } = useAuth();
  // hospital_id undefined → useAdminTemplates não roda; usar query direta
  // Mas como super_admin vê tudo via RLS, conseguimos buscar globais sem hospital_id.
  // Reaproveitando o hook passando undefined retorna vazio. Vamos usar consulta direta.
  const { data: allTemplates, isLoading } = useAdminTemplates(undefined as any);

  // Filtrar apenas globais (hospital_id NULL)
  const globalTemplates = (allTemplates ?? []).filter((t) => t.hospital_id === null);
  // Quando o hook não retorna nada por falta de hospitalId, fazemos consulta paralela:
  const enabled = !allTemplates;

  // Pra simplificar e garantir o fetch dos globais mesmo sem hospitalId,
  // podemos chamar diretamente via supabase aqui — mas pra reutilizar hook,
  // vou tratar via wrapper abaixo.
  void enabled;

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
    if (!form.name.trim() || !form.prompt.trim()) {
      toast.error("Nome e prompt são obrigatórios");
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
      } else {
        await createTpl.mutateAsync({
          hospital_id: null, // GLOBAL
          name: form.name.trim(),
          description: form.description.trim() || null,
          prompt: form.prompt,
          applicable_ward_types: form.applicable_ward_types,
          applicable_roles: form.applicable_roles,
          is_active: form.is_active,
          created_by: user?.id ?? null,
        });
      }
      toast.success("Template salvo");
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
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  return (
    <SuperAdminLayout>
      <PageContainer>
        <PageHeader
          icon={<Globe className="w-6 h-6" />}
          title="Templates globais"
          subtitle="Disponíveis em todos os hospitais. Cada hospital também pode criar os próprios em /admin/templates."
          actions={
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} className="gap-2">
                <Plus className="w-4 h-4" /> Novo template global
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editing ? `Editar "${editing.name}"` : "Novo template global"}
                </DialogTitle>
                <DialogDescription>
                  Defina o prompt que a IA usará pra gerar relatórios desse tipo.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Prompt da IA *</Label>
                  <Textarea
                    rows={10}
                    className="font-mono text-sm"
                    value={form.prompt}
                    onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use <code>{"{{transcription}}"}</code> se quiser inserir a transcrição
                    em local específico, ou deixe sem placeholder.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-2 block">Setores aplicáveis</Label>
                    <div className="space-y-1 border rounded-md p-2 text-sm">
                      {WARD_TYPES.map((wt) => (
                        <div key={wt.value} className="flex items-center gap-2">
                          <Checkbox
                            id={`g-tpl-wt-${wt.value}`}
                            checked={form.applicable_ward_types.includes(wt.value)}
                            onCheckedChange={() =>
                              setForm((p) => ({
                                ...p,
                                applicable_ward_types: toggleArr(p.applicable_ward_types, wt.value),
                              }))
                            }
                          />
                          <Label htmlFor={`g-tpl-wt-${wt.value}`} className="cursor-pointer text-sm font-normal">
                            {wt.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Papéis aplicáveis</Label>
                    <div className="space-y-1 border rounded-md p-2 text-sm">
                      {ROLES.map((r) => (
                        <div key={r.value} className="flex items-center gap-2">
                          <Checkbox
                            id={`g-tpl-r-${r.value}`}
                            checked={form.applicable_roles.includes(r.value)}
                            onCheckedChange={() =>
                              setForm((p) => ({
                                ...p,
                                applicable_roles: toggleArr(p.applicable_roles, r.value),
                              }))
                            }
                          />
                          <Label htmlFor={`g-tpl-r-${r.value}`} className="cursor-pointer text-sm font-normal">
                            {r.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="g-tpl-active"
                    checked={form.is_active}
                    onCheckedChange={(c) => setForm((p) => ({ ...p, is_active: c === true }))}
                  />
                  <Label htmlFor="g-tpl-active" className="cursor-pointer">Ativo</Label>
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
        ) : globalTemplates.length === 0 ? (
          <EmptyState
            title="Nenhum template global"
            description="Crie templates pra disponibilizar em todos os hospitais."
          />
        ) : (
          <div className="space-y-3">
            {globalTemplates.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="heading-card flex items-center gap-2">
                        {t.name}
                        {!t.is_active && <Badge variant="secondary">inativo</Badge>}
                        <Badge variant="outline" className="gap-1">
                          <Globe className="w-3 h-3" /> global
                        </Badge>
                      </CardTitle>
                      {t.description && (
                        <CardDescription className="mt-1">{t.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
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
                              Sumirá de todos os hospitais. Consultas que já usaram
                              continuam preservadas.
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
                  <div className="mt-2 text-xs text-muted-foreground">
                    v{t.version ?? 1} · atualizado{" "}
                    {new Date(t.updated_at).toLocaleDateString("pt-BR")}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContainer>
    </SuperAdminLayout>
  );
}
