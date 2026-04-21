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
import { Plus, Edit, Trash2, Sparkles, Loader2, Eye, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PromptWizardDialog } from "@/components/admin/PromptWizardDialog";
import type { Tables } from "@/integrations/supabase/types";

type Specialty = Tables<"medical_specialties">;

export default function AdminSpecialties() {
  const { user } = useAuth();
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", code: "", description: "", output_prompt: "", icon: "Stethoscope",
  });

  const load = async () => {
    const { data } = await supabase.from("medical_specialties").select("*").order("name");
    setSpecialties(data || []);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.code) { toast.error("Nome e código são obrigatórios"); return; }
    const payload = { ...form, created_by: user?.id };
    if (editingId) {
      const { error } = await supabase.from("medical_specialties").update(payload).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Especialidade atualizada!");
    } else {
      const { error } = await supabase.from("medical_specialties").insert(payload);
      if (error) { toast.error(error.message.includes("duplicate") ? "Código já existe" : "Erro ao criar"); return; }
      toast.success("Especialidade criada!");
    }
    resetForm();
    load();
  };

  const handleEdit = (s: Specialty) => {
    setEditingId(s.id);
    setForm({ name: s.name, code: s.code, description: s.description || "", output_prompt: s.output_prompt, icon: s.icon || "Stethoscope" });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("medical_specialties").delete().eq("id", id);
    toast.success("Especialidade removida");
    load();
  };

  const handleGeneratePrompt = async () => {
    if (!form.name) { toast.error("Informe o nome da especialidade primeiro"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-specialty-prompt", {
        body: { specialty_name: form.name, specialty_description: form.description, base_prompt: form.output_prompt || undefined },
      });
      if (error) throw error;
      setForm({ ...form, output_prompt: data.prompt });
      toast.success("Prompt gerado com IA!");
    } catch {
      toast.error("Erro ao gerar prompt");
    }
    setGenerating(false);
  };

  const resetForm = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ name: "", code: "", description: "", output_prompt: "", icon: "Stethoscope" });
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Especialidades Médicas</h1>
            <p className="text-muted-foreground text-sm">Gerencie especialidades e prompts de saída de consulta</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4" /> Nova Especialidade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? "Editar" : "Nova"} Especialidade</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Cardiologia" /></div>
                  <div><Label>Código *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Ex: CARDIO" /></div>
                </div>
                <div><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Breve descrição da especialidade" /></div>
                <div><Label>Ícone (Lucide)</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Nome do ícone Lucide" /></div>
                <div>
                   <div className="flex items-center justify-between mb-1">
                     <Label>Prompt de Saída da Consulta</Label>
                     <div className="flex gap-1">
                       <Button variant="outline" size="sm" className="gap-1" onClick={() => setWizardOpen(true)}>
                         <Wand2 className="w-3 h-3" /> Wizard de Prompt
                       </Button>
                       <Button variant="outline" size="sm" className="gap-1" onClick={handleGeneratePrompt} disabled={generating}>
                         {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                         {generating ? "Gerando..." : "Gerar com IA"}
                       </Button>
                     </div>
                   </div>
                  <Textarea
                    value={form.output_prompt}
                    onChange={(e) => setForm({ ...form, output_prompt: e.target.value })}
                    className="min-h-[250px] font-mono text-xs"
                    placeholder="Prompt que será usado para gerar o relatório desta especialidade..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Variáveis disponíveis: {"{{patient_name}}"}, {"{{date}}"}, {"{{age}}"}
                  </p>
                </div>
                <Button onClick={handleSave} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
          <PromptWizardDialog
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            onPromptGenerated={(prompt) => setForm({ ...form, output_prompt: prompt })}
            contextType="specialty"
            contextName={form.name}
            contextDescription={form.description}
          />
        </div>

        {/* Preview dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Preview do Prompt</DialogTitle></DialogHeader>
            <pre className="text-xs whitespace-pre-wrap bg-muted p-4 rounded-lg font-mono">{previewPrompt}</pre>
          </DialogContent>
        </Dialog>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden sm:table-cell">Código</TableHead>
                  <TableHead className="hidden md:table-cell">Descrição</TableHead>
                  <TableHead>Prompt</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {specialties.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="hidden sm:table-cell"><Badge variant="outline">{s.code}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm truncate max-w-[200px]">{s.description || "—"}</TableCell>
                    <TableCell>
                      {s.output_prompt ? (
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { setPreviewPrompt(s.output_prompt); setPreviewOpen(true); }}>
                          <Eye className="w-3 h-3" /> Ver
                        </Button>
                      ) : <span className="text-xs text-muted-foreground">Vazio</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {specialties.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma especialidade cadastrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
