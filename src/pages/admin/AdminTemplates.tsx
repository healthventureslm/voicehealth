import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { PromptWizardDialog } from "@/components/admin/PromptWizardDialog";

const roleOptions = [
  { value: "medico", label: "Médico" },
  { value: "enfermeiro", label: "Enfermeiro" },
  { value: "tecnico", label: "Técnico" },
  { value: "farmaceutico", label: "Farmacêutico" },
  { value: "fisioterapeuta", label: "Fisioterapeuta" },
  { value: "nutricionista", label: "Nutricionista" },
  { value: "fonoaudiologo", label: "Fonoaudiólogo" },
  { value: "psicologo", label: "Psicólogo" },
  { value: "assistente_social", label: "Assistente Social" },
  { value: "auditor", label: "Auditor" },
];

interface Template {
  id: string;
  name: string;
  description: string | null;
  prompt_template: string;
  is_active: boolean;
  applicable_roles: string[] | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  department_id: string | null;
}

export default function AdminTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", prompt_template: "", applicable_roles: [] as string[] });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pendingScriptFields, setPendingScriptFields] = useState<any[] | null>(null);

  const fetchTemplates = async () => {
    const { data } = await supabase.from("report_templates").select("*").order("name");
    setTemplates((data as Template[]) || []);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const toggleRole = (role: string) => {
    setForm(f => ({
      ...f,
      applicable_roles: f.applicable_roles.includes(role)
        ? f.applicable_roles.filter(r => r !== role)
        : [...f.applicable_roles, role],
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.prompt_template) return;
    const payload = {
      name: form.name,
      description: form.description,
      prompt_template: form.prompt_template,
      applicable_roles: form.applicable_roles,
    };
    let templateId = editingId;
    if (editingId) {
      const { error } = await supabase.from("report_templates").update(payload).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Template atualizado!");
    } else {
      const { data, error } = await supabase.from("report_templates").insert({ ...payload, created_by: user?.id }).select("id").single();
      if (error) { toast.error("Erro ao criar"); return; }
      templateId = data?.id || null;
      toast.success("Template criado!");
    }

    // Auto-save consultation script if wizard generated fields
    if (templateId && pendingScriptFields && pendingScriptFields.length > 0) {
      // Check if script already linked
      const { data: existing } = await (supabase
        .from("consultation_scripts")
        .select("id")
        .eq("linked_template_id", templateId)
        .maybeSingle() as any);

      const scriptPayload = {
        name: form.name,
        description: form.prompt_template.slice(0, 500),
        fields: pendingScriptFields,
        linked_template_id: templateId,
        is_active: true,
      };

      if (existing?.id) {
        await (supabase.from("consultation_scripts").update(scriptPayload) as any).eq("id", existing.id);
      } else {
        await (supabase.from("consultation_scripts").insert(scriptPayload) as any);
      }
      toast.success("Script do teleprompter gerado automaticamente!");
      setPendingScriptFields(null);
    }

    setDialogOpen(false);
    setEditingId(null);
    setForm({ name: "", description: "", prompt_template: "", applicable_roles: [] });
    fetchTemplates();
  };

  const handleEdit = (t: Template) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description || "",
      prompt_template: t.prompt_template,
      applicable_roles: t.applicable_roles || [],
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("report_templates").delete().eq("id", id);
    toast.success("Template removido");
    fetchTemplates();
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", description: "", prompt_template: "", applicable_roles: [] });
  };

  const getRoleLabel = (val: string) => roleOptions.find(r => r.value === val)?.label || val;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Templates de Relatório</h1>
            <p className="text-muted-foreground">Configure os prompts para geração de relatórios clínicos por perfil profissional</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> Novo Template</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? "Editar" : "Novo"} Template</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: SOAP, Evolução, Alta" /></div>
                <div><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div>
                  <Label>Perfis Aplicáveis</Label>
                  <p className="text-xs text-muted-foreground mb-2">Selecione quais profissionais podem usar este template. Vazio = todos.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {roleOptions.map((r) => (
                      <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={form.applicable_roles.includes(r.value)}
                          onCheckedChange={() => toggleRole(r.value)}
                        />
                        {r.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>Prompt Template *</Label>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setWizardOpen(true)}>
                      <Wand2 className="w-3 h-3" /> Wizard de Prompt
                    </Button>
                  </div>
                  <Textarea value={form.prompt_template} onChange={(e) => setForm({ ...form, prompt_template: e.target.value })} className="min-h-[200px] font-mono text-sm" placeholder="Use {transcription} para inserir a transcrição do atendimento..." />
                  <p className="text-xs text-muted-foreground mt-1">Use {"{{transcription}}"} como placeholder para a transcrição.</p>
                </div>
                <Button onClick={handleSave} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
          <PromptWizardDialog
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            onPromptGenerated={(prompt, scriptFields) => {
              setForm({ ...form, prompt_template: prompt });
              if (scriptFields) setPendingScriptFields(scriptFields);
            }}
            contextType="template"
            contextName={form.name}
            contextDescription={form.description}
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Perfis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{t.description || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(t.applicable_roles && t.applicable_roles.length > 0)
                          ? t.applicable_roles.map((r) => (
                              <Badge key={r} variant="secondary" className="text-xs">{getRoleLabel(r)}</Badge>
                            ))
                          : <span className="text-xs text-muted-foreground">Todos</span>
                        }
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full ${t.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {t.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(t)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
