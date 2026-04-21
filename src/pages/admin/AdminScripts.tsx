import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Loader2, Sparkles, PlayCircle } from "lucide-react";
import { TeleprompterDemo } from "@/components/admin/TeleprompterDemo";
import { toast } from "sonner";

interface ScriptField {
  id: string;
  label: string;
  required: boolean;
  keywords: string[];
}

interface ConsultationScript {
  id: string;
  name: string;
  sector: string | null;
  report_type: string | null;
  description: string;
  fields: ScriptField[];
  is_active: boolean;
  created_at: string;
}

const SECTOR_LABELS: Record<string, string> = {
  uti: "UTI",
  emergencia: "Emergência",
  enfermaria: "Enfermaria",
  ambulatorio: "Ambulatório",
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  medical_evolution: "Evolução Médica",
  icu_evolution: "Evolução UTI",
  prescription: "Prescrição",
  nursing_evolution: "Evolução Enfermagem",
  physiotherapy_evolution: "Evolução Fisioterapia",
  nutrition_evolution: "Evolução Nutrição",
  handoff_isbar: "Passagem de Plantão",
  surgical_note: "Nota Cirúrgica",
  interconsult: "Interconsulta",
};

const emptyForm = {
  name: "",
  sector: "",
  report_type: "",
  description: "",
  is_active: true,
};

export default function AdminScripts() {
  const [scripts, setScripts] = useState<ConsultationScript[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [parsedFields, setParsedFields] = useState<ScriptField[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [demoScript, setDemoScript] = useState<ConsultationScript | null>(null);
  const fetchScripts = async () => {
    const { data, error } = await supabase
      .from("consultation_scripts" as any)
      .select("*")
      .order("name");
    if (error) {
      toast.error("Erro ao carregar scripts: " + error.message);
      return;
    }
    setScripts((data as unknown as ConsultationScript[]) || []);
  };

  useEffect(() => {
    fetchScripts();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setParsedFields([]);
    setDialogOpen(true);
  };

  const openEdit = (script: ConsultationScript) => {
    setEditingId(script.id);
    setForm({
      name: script.name,
      sector: script.sector || "",
      report_type: script.report_type || "",
      description: script.description,
      is_active: script.is_active,
    });
    setParsedFields(script.fields || []);
    setDialogOpen(true);
  };

  const handleParseFields = async () => {
    if (!form.description.trim()) {
      toast.error("Escreva o roteiro antes de extrair os campos");
      return;
    }
    setIsParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-script-fields", {
        body: { description: form.description, sector: form.sector || undefined },
      });
      if (error) throw error;
      if (!data?.fields?.length) throw new Error("Nenhum campo extraído");
      setParsedFields(data.fields);
      toast.success(`${data.fields.length} campos extraídos com sucesso!`);
    } catch (err: any) {
      toast.error("Erro ao extrair campos: " + (err.message || "Tente novamente"));
    } finally {
      setIsParsing(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      toast.error("Nome e roteiro são obrigatórios");
      return;
    }
    if (!parsedFields.length) {
      toast.error("Extraia os campos do roteiro antes de salvar");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sector: form.sector || null,
        report_type: form.report_type || null,
        description: form.description.trim(),
        fields: parsedFields,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from("consultation_scripts" as any)
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Script atualizado!");
      } else {
        const { error } = await supabase
          .from("consultation_scripts" as any)
          .insert(payload);
        if (error) throw error;
        toast.success("Script criado!");
      }

      setDialogOpen(false);
      fetchScripts();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("consultation_scripts" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Script excluído");
      setDeleteId(null);
      fetchScripts();
    }
  };

  const handleToggleActive = async (script: ConsultationScript) => {
    const { error } = await supabase
      .from("consultation_scripts" as any)
      .update({ is_active: !script.is_active, updated_at: new Date().toISOString() })
      .eq("id", script.id);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      fetchScripts();
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Scripts de Consulta</h1>
            <p className="text-muted-foreground">
              Configure o roteiro que o profissional deve seguir durante a gravação
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Script
          </Button>
        </div>

        {scripts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="text-muted-foreground">Nenhum script cadastrado.</p>
              <Button onClick={openCreate} variant="outline" className="gap-2">
                <Plus className="w-4 h-4" /> Criar primeiro script
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {scripts.map((script) => (
              <Card key={script.id} className={script.is_active ? "" : "opacity-60"}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{script.name}</span>
                      {script.sector && (
                        <Badge variant="outline" className="text-xs">
                          {SECTOR_LABELS[script.sector] || script.sector}
                        </Badge>
                      )}
                      {script.report_type && (
                        <Badge variant="secondary" className="text-xs">
                          {REPORT_TYPE_LABELS[script.report_type] || script.report_type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {script.description}
                    </p>
                    {script.fields?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {script.fields.length} campo(s) configurado(s)
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => setDemoScript(script)}
                      disabled={!script.fields?.length}
                    >
                      <PlayCircle className="w-3.5 h-3.5" /> Testar
                    </Button>
                    <Switch
                      checked={script.is_active}
                      onCheckedChange={() => handleToggleActive(script)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(script)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(script.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Script" : "Novo Script"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome do script *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Evolução UTI — Sepse"
                />
              </div>
              <div>
                <Label>Setor</Label>
                <Select
                  value={form.sector || "_none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, sector: v === "_none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Todos os setores</SelectItem>
                    {Object.entries(SECTOR_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de relatório</Label>
                <Select
                  value={form.report_type || "_none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, report_type: v === "_none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de documento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Qualquer tipo</SelectItem>
                    {Object.entries(REPORT_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Roteiro em linguagem natural *</Label>
              <p className="text-xs text-muted-foreground mb-1">
                Descreva o que o profissional deve mencionar durante a consulta
              </p>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ex: O médico deve informar: nome e idade do paciente, diagnóstico principal com CID, prescrição completa com medicamento, dose, via e frequência, e plano terapêutico ou data de alta prevista."
                className="min-h-[120px]"
              />
            </div>

            <Button
              variant="outline"
              onClick={handleParseFields}
              disabled={isParsing || !form.description.trim()}
              className="w-full gap-2"
            >
              {isParsing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isParsing ? "Extraindo campos..." : "Extrair campos do roteiro com IA"}
            </Button>

            {parsedFields.length > 0 && (
              <div>
                <Label>Campos extraídos — preview do teleprompter</Label>
                <div className="mt-2 space-y-2 rounded-md border p-3 bg-muted/20">
                  {parsedFields.map((field) => (
                    <div key={field.id} className="flex items-start gap-2 text-sm">
                      <span className="text-muted-foreground mt-0.5">○</span>
                      <div className="flex-1">
                        <span className="font-medium">{field.label}</span>
                        {field.required && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0 ml-1">*</Badge>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Keywords: {field.keywords.join(", ")}
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground pt-1 border-t">
                    * = campo obrigatório para o documento
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label>Script ativo (visível durante gravações)</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !parsedFields.length}
              >
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</>
                ) : (
                  editingId ? "Atualizar" : "Criar Script"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir script?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Teleprompter Demo */}
      <TeleprompterDemo
        open={!!demoScript}
        onOpenChange={(o) => !o && setDemoScript(null)}
        scriptName={demoScript?.name || ""}
        fields={demoScript?.fields || []}
      />
    </AppLayout>
  );
}
