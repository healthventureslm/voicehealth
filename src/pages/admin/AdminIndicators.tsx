import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Target, Calculator, Zap, ListTree, X } from "lucide-react";
import { AutoCollectionConfig } from "@/components/admin/AutoCollectionConfig";

interface Indicator {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  calc_type: string;
  numerator_label: string;
  denominator_label: string;
  formula_description: string | null;
  target_value: number | null;
  warning_threshold: number | null;
  critical_threshold: number | null;
  frequency: string;
  department_id: string | null;
  is_active: boolean;
  is_system: boolean;
  auto_enabled: boolean;
  auto_source: string | null;
  auto_numerator_filter: Record<string, any> | null;
  auto_denominator_filter: Record<string, any> | null;
  auto_operation: string;
  auto_agg_column: string | null;
}

interface Subtype {
  id?: string;
  code: string;
  name: string;
  description: string;
  bundle_items: { code: string; label: string; reference: string }[];
  target_value: string;
  warning_threshold: string;
  critical_threshold: string;
}

interface Department {
  id: string;
  name: string;
}

const defaultForm = {
  name: "",
  description: "",
  category: "",
  unit: "%",
  calc_type: "percentage",
  numerator_label: "Numerador",
  denominator_label: "Denominador",
  formula_description: "",
  target_value: "",
  warning_threshold: "80",
  critical_threshold: "60",
  frequency: "monthly",
  department_id: "",
  is_active: true,
  auto_enabled: false,
  auto_source: "",
  auto_numerator_filter: {} as Record<string, any>,
  auto_denominator_filter: {} as Record<string, any>,
  auto_operation: "count",
  auto_agg_column: "",
};

const emptySubtype: Subtype = {
  code: "", name: "", description: "", bundle_items: [], target_value: "", warning_threshold: "", critical_threshold: "",
};

const PRESET_BUNDLES: Record<string, { name: string; items: { code: string; label: string; reference: string }[] }> = {
  PAV: {
    name: "Pneumonia Associada à Ventilação",
    items: [
      { code: "CAB", label: "Elevação cabeceira 30-45°", reference: "JCI IPSG.5" },
      { code: "HO", label: "Higiene oral com clorexidina", reference: "JCI IPSG.5" },
      { code: "SED", label: "Pausa diária de sedação", reference: "JCI IPSG.5" },
      { code: "TVP", label: "Profilaxia de TVP", reference: "JCI IPSG.5" },
      { code: "EXT", label: "Avaliação diária de extubação", reference: "JCI IPSG.5" },
    ],
  },
  IPCS: {
    name: "Infecção Primária de Corrente Sanguínea",
    items: [
      { code: "HM", label: "Higiene das mãos – 5 momentos", reference: "JCI IPSG.5" },
      { code: "BM", label: "Barreira máxima na inserção", reference: "JCI IPSG.5" },
      { code: "CLO", label: "Clorexidina na inserção", reference: "JCI IPSG.5" },
      { code: "ADN", label: "Avaliação diária de necessidade", reference: "JCI IPSG.5" },
      { code: "CUR", label: "Curativo transparente adequado", reference: "JCI IPSG.5" },
    ],
  },
  ISC: {
    name: "Infecção de Sítio Cirúrgico",
    items: [
      { code: "ATB", label: "ATB profilático até 1h antes", reference: "JCI IPSG.4" },
      { code: "TRI", label: "Tricotomia adequada", reference: "JCI IPSG.4" },
      { code: "NOR", label: "Normotermia perioperatória", reference: "JCI IPSG.4" },
      { code: "GLI", label: "Glicemia controlada", reference: "JCI IPSG.4" },
      { code: "BAN", label: "Banho pré-op com clorexidina", reference: "JCI IPSG.4" },
    ],
  },
  ITU: {
    name: "Infecção do Trato Urinário",
    items: [
      { code: "IND", label: "Indicação documentada", reference: "ONA" },
      { code: "ASE", label: "Inserção asséptica", reference: "ONA" },
      { code: "FEC", label: "Sistema fechado mantido", reference: "ONA" },
      { code: "ADN", label: "Avaliação diária de necessidade", reference: "ONA" },
      { code: "HIG", label: "Higiene meatal adequada", reference: "ONA" },
    ],
  },
  QUEDAS: {
    name: "Prevenção de Quedas",
    items: [
      { code: "MOR", label: "Escala de Morse aplicada", reference: "JCI IPSG.6" },
      { code: "SIN", label: "Sinalização de risco", reference: "JCI IPSG.6" },
      { code: "AMB", label: "Ambiente seguro verificado", reference: "JCI IPSG.6" },
      { code: "CAL", label: "Calçado adequado", reference: "JCI IPSG.6" },
      { code: "ORI", label: "Orientação ao paciente/familiar", reference: "JCI IPSG.6" },
    ],
  },
  IDENT: {
    name: "Identificação do Paciente",
    items: [
      { code: "PUL", label: "Pulseira com 2 identificadores", reference: "JCI IPSG.1" },
      { code: "CON", label: "Conferência antes do procedimento", reference: "JCI IPSG.1" },
      { code: "NOM", label: "Nome completo + data nascimento", reference: "JCI IPSG.1" },
    ],
  },
  COMUNIC: {
    name: "Comunicação Efetiva",
    items: [
      { code: "SBAR", label: "Técnica SBAR utilizada", reference: "JCI IPSG.2" },
      { code: "RDB", label: "Read-back realizado", reference: "JCI IPSG.2" },
      { code: "RES", label: "Resultados críticos em 30min", reference: "JCI IPSG.2" },
      { code: "PAS", label: "Passagem de plantão estruturada", reference: "JCI IPSG.2" },
    ],
  },
  MEDIC: {
    name: "Segurança de Medicamentos",
    items: [
      { code: "DUP", label: "Dupla checagem realizada", reference: "JCI IPSG.3" },
      { code: "LAS", label: "LASA separados/sinalizados", reference: "JCI IPSG.3" },
      { code: "ROT", label: "Rotulagem adequada", reference: "JCI IPSG.3" },
      { code: "DOS", label: "Dose máxima verificada", reference: "JCI IPSG.3" },
      { code: "ALE", label: "Alergia verificada", reference: "JCI IPSG.3" },
    ],
  },
};

export default function AdminIndicators() {
  const { isAdmin } = useAuth();
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [subtypesOpen, setSubtypesOpen] = useState(false);
  const [subtypesIndicator, setSubtypesIndicator] = useState<Indicator | null>(null);
  const [subtypes, setSubtypes] = useState<Subtype[]>([]);
  const [editingSubtype, setEditingSubtype] = useState<Subtype | null>(null);
  const [subtypeForm, setSubtypeForm] = useState<Subtype>(emptySubtype);
  const [savingSubtype, setSavingSubtype] = useState(false);

  useEffect(() => {
    fetchIndicators();
    fetchDepartments();
  }, []);

  const fetchIndicators = async () => {
    const { data } = await supabase.from("indicators").select("*").order("name");
    setIndicators((data as any[]) || []);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from("departments").select("id, name").order("name");
    setDepartments(data || []);
  };

  const fetchSubtypes = async (indicatorId: string) => {
    const { data } = await supabase
      .from("indicator_subtypes")
      .select("*")
      .eq("indicator_id", indicatorId)
      .order("code");
    setSubtypes(
      ((data as any[]) || []).map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        description: s.description || "",
        bundle_items: Array.isArray(s.bundle_items) ? s.bundle_items : [],
        target_value: s.target_value?.toString() || "",
        warning_threshold: s.warning_threshold?.toString() || "",
        critical_threshold: s.critical_threshold?.toString() || "",
      }))
    );
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Nome do indicador é obrigatório");
      return;
    }
    setLoading(true);
    const payload = {
      name: form.name,
      description: form.description || null,
      category: form.category || null,
      unit: form.unit,
      calc_type: form.calc_type,
      numerator_label: form.numerator_label,
      denominator_label: form.denominator_label,
      formula_description: form.formula_description || null,
      target_value: form.target_value ? Number(form.target_value) : null,
      warning_threshold: form.warning_threshold ? Number(form.warning_threshold) : null,
      critical_threshold: form.critical_threshold ? Number(form.critical_threshold) : null,
      frequency: form.frequency,
      department_id: form.department_id && form.department_id !== "global" ? form.department_id : null,
      is_active: form.is_active,
      auto_enabled: form.auto_enabled,
      auto_source: form.auto_source || null,
      auto_numerator_filter: form.auto_numerator_filter,
      auto_denominator_filter: form.auto_denominator_filter,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("indicators").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("indicators").insert(payload));
    }

    if (error) {
      toast.error("Erro ao salvar indicador");
    } else {
      toast.success(editingId ? "Indicador atualizado" : "Indicador criado");
      setOpen(false);
      setEditingId(null);
      setForm(defaultForm);
      fetchIndicators();
    }
    setLoading(false);
  };

  const handleEdit = (ind: Indicator) => {
    setEditingId(ind.id);
    setForm({
      name: ind.name,
      description: ind.description || "",
      category: ind.category || "",
      unit: ind.unit,
      calc_type: ind.calc_type,
      numerator_label: ind.numerator_label,
      denominator_label: ind.denominator_label,
      formula_description: ind.formula_description || "",
      target_value: ind.target_value?.toString() || "",
      warning_threshold: ind.warning_threshold?.toString() || "80",
      critical_threshold: ind.critical_threshold?.toString() || "60",
      frequency: ind.frequency,
      department_id: ind.department_id || "",
      is_active: ind.is_active,
      auto_enabled: ind.auto_enabled,
      auto_source: ind.auto_source || "",
      auto_numerator_filter: (ind.auto_numerator_filter as Record<string, any>) || {},
      auto_denominator_filter: (ind.auto_denominator_filter as Record<string, any>) || {},
      auto_operation: ind.auto_operation || "count",
      auto_agg_column: ind.auto_agg_column || "",
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este indicador?")) return;
    const { error } = await supabase.from("indicators").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Indicador excluído");
      fetchIndicators();
    }
  };

  const openSubtypes = (ind: Indicator) => {
    setSubtypesIndicator(ind);
    fetchSubtypes(ind.id);
    setSubtypesOpen(true);
    setEditingSubtype(null);
    setSubtypeForm(emptySubtype);
  };

  const handleSaveSubtype = async () => {
    if (!subtypeForm.code || !subtypeForm.name || !subtypesIndicator) {
      toast.error("Código e nome são obrigatórios");
      return;
    }
    setSavingSubtype(true);
    const payload = {
      indicator_id: subtypesIndicator.id,
      code: subtypeForm.code,
      name: subtypeForm.name,
      description: subtypeForm.description || null,
      bundle_items: subtypeForm.bundle_items,
      target_value: subtypeForm.target_value ? Number(subtypeForm.target_value) : null,
      warning_threshold: subtypeForm.warning_threshold ? Number(subtypeForm.warning_threshold) : null,
      critical_threshold: subtypeForm.critical_threshold ? Number(subtypeForm.critical_threshold) : null,
    };

    let error;
    if (editingSubtype?.id) {
      ({ error } = await supabase.from("indicator_subtypes").update(payload).eq("id", editingSubtype.id));
    } else {
      ({ error } = await supabase.from("indicator_subtypes").insert(payload));
    }

    if (error) {
      toast.error("Erro ao salvar subtipo");
    } else {
      toast.success("Subtipo salvo");
      fetchSubtypes(subtypesIndicator.id);
      setEditingSubtype(null);
      setSubtypeForm(emptySubtype);
    }
    setSavingSubtype(false);
  };

  const handleDeleteSubtype = async (id: string) => {
    if (!confirm("Excluir este subtipo?")) return;
    await supabase.from("indicator_subtypes").delete().eq("id", id);
    if (subtypesIndicator) fetchSubtypes(subtypesIndicator.id);
  };

  const applyPreset = (presetCode: string) => {
    const preset = PRESET_BUNDLES[presetCode];
    if (preset) {
      setSubtypeForm({
        ...subtypeForm,
        code: presetCode,
        name: preset.name,
        bundle_items: preset.items,
      });
    }
  };

  const addBundleItem = () => {
    setSubtypeForm({
      ...subtypeForm,
      bundle_items: [...subtypeForm.bundle_items, { code: "", label: "", reference: "" }],
    });
  };

  const updateBundleItem = (idx: number, field: string, value: string) => {
    const items = [...subtypeForm.bundle_items];
    items[idx] = { ...items[idx], [field]: value };
    setSubtypeForm({ ...subtypeForm, bundle_items: items });
  };

  const removeBundleItem = (idx: number) => {
    setSubtypeForm({
      ...subtypeForm,
      bundle_items: subtypeForm.bundle_items.filter((_, i) => i !== idx),
    });
  };

  const calcTypeLabel: Record<string, string> = {
    percentage: "Percentual",
    absolute: "Absoluto",
    average: "Média",
  };

  const freqLabel: Record<string, string> = {
    daily: "Diário",
    weekly: "Semanal",
    monthly: "Mensal",
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Acesso restrito a administradores.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Indicadores</h1>
            <p className="text-muted-foreground">Gerencie indicadores com fórmulas customizáveis e metas</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(defaultForm); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2 gradient-primary text-white border-0">
                <Plus className="w-4 h-4" /> Novo Indicador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Indicador" : "Novo Indicador"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Nome *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Taxa de Ocupação" />
                  </div>
                  <div className="col-span-2">
                    <Label>Descrição</Label>
                    <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição do indicador..." rows={2} />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex: Ocupação, Qualidade" />
                  </div>
                  <div>
                    <Label>Tipo de Cálculo</Label>
                    <Select value={form.calc_type} onValueChange={(v) => setForm({ ...form, calc_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentual (N/D × 100)</SelectItem>
                        <SelectItem value="absolute">Absoluto (N)</SelectItem>
                        <SelectItem value="average">Média (N/D)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Rótulo do Numerador</Label>
                    <Input value={form.numerator_label} onChange={(e) => setForm({ ...form, numerator_label: e.target.value })} placeholder="Leitos ocupados" />
                  </div>
                  <div>
                    <Label>Rótulo do Denominador</Label>
                    <Input value={form.denominator_label} onChange={(e) => setForm({ ...form, denominator_label: e.target.value })} placeholder="Total de leitos" disabled={form.calc_type === "absolute"} />
                  </div>
                  <div className="col-span-2">
                    <Label>Descrição da Fórmula</Label>
                    <Input value={form.formula_description} onChange={(e) => setForm({ ...form, formula_description: e.target.value })} placeholder="(Leitos ocupados / Total de leitos) × 100" />
                  </div>
                  <div>
                    <Label>Unidade</Label>
                    <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="%, dias, qtd" />
                  </div>
                  <div>
                    <Label>Frequência</Label>
                    <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Meta</Label>
                    <Input type="number" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} placeholder="85" />
                  </div>
                  <div>
                    <Label>Limiar Amarelo (%)</Label>
                    <Input type="number" value={form.warning_threshold} onChange={(e) => setForm({ ...form, warning_threshold: e.target.value })} placeholder="80" />
                  </div>
                  <div>
                    <Label>Limiar Vermelho (%)</Label>
                    <Input type="number" value={form.critical_threshold} onChange={(e) => setForm({ ...form, critical_threshold: e.target.value })} placeholder="60" />
                  </div>
                  <div>
                    <Label>Departamento</Label>
                    <Select value={form.department_id || "global"} onValueChange={(v) => setForm({ ...form, department_id: v === "global" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Global (todos)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">Global (todos)</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                    <Label>Ativo</Label>
                  </div>
                  <AutoCollectionConfig
                    autoEnabled={form.auto_enabled}
                    autoSource={form.auto_source}
                    autoNumeratorFilter={form.auto_numerator_filter}
                    autoDenominatorFilter={form.auto_denominator_filter}
                    calcType={form.calc_type}
                    autoOperation={form.auto_operation}
                    autoAggColumn={form.auto_agg_column || undefined}
                    onChange={(field, value) => setForm({ ...form, [field]: value })}
                  />
                </div>
                <Button onClick={handleSubmit} disabled={loading} className="w-full gradient-primary text-white border-0">
                  {loading ? "Salvando..." : editingId ? "Atualizar" : "Criar Indicador"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {indicators.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Calculator className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Nenhum indicador cadastrado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {indicators.map((ind) => (
              <Card key={ind.id} className={`glass-card ${!ind.is_active ? "opacity-60" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{ind.name}</CardTitle>
                      {ind.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ind.description}</p>}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSubtypes(ind)} title="Gerenciar Subtipos">
                        <ListTree className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(ind)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(ind.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{calcTypeLabel[ind.calc_type]}</Badge>
                    <Badge variant="outline">{freqLabel[ind.frequency]}</Badge>
                    {ind.category && <Badge variant="secondary">{ind.category}</Badge>}
                    {ind.auto_enabled && (
                      <Badge variant="default" className="gap-1 bg-primary/10 text-primary border-primary/20">
                        <Zap className="w-2.5 h-2.5" /> Auto
                      </Badge>
                    )}
                    {!ind.is_active && <Badge variant="destructive">Inativo</Badge>}
                  </div>
                  {ind.formula_description && (
                    <p className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                      {ind.formula_description}
                    </p>
                  )}
                  {ind.target_value != null && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Target className="w-3.5 h-3.5 text-primary" />
                      <span>Meta: {ind.target_value}{ind.unit}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Subtypes Management Dialog */}
        <Dialog open={subtypesOpen} onOpenChange={setSubtypesOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ListTree className="w-5 h-5 text-primary" />
                Subtipos: {subtypesIndicator?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Existing subtypes */}
              {subtypes.map((st) => (
                <div key={st.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{st.code}</Badge>
                      <span className="font-medium text-sm">{st.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {st.bundle_items.length} itens de bundle
                      {st.target_value && ` • Meta: ${st.target_value}%`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                      setEditingSubtype(st);
                      setSubtypeForm(st);
                    }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteSubtype(st.id!)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Add/Edit form */}
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <p className="font-semibold text-sm">
                  {editingSubtype?.id ? "Editar Subtipo" : "Novo Subtipo"}
                </p>

                {/* Preset buttons */}
                {!editingSubtype?.id && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Preencher com preset:</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.keys(PRESET_BUNDLES).map((code) => (
                        <Button key={code} variant="outline" size="sm" className="h-6 text-xs" onClick={() => applyPreset(code)}>
                          {code}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Código *</Label>
                    <Input value={subtypeForm.code} onChange={(e) => setSubtypeForm({ ...subtypeForm, code: e.target.value.toUpperCase() })} placeholder="PAV" />
                  </div>
                  <div>
                    <Label className="text-xs">Nome *</Label>
                    <Input value={subtypeForm.name} onChange={(e) => setSubtypeForm({ ...subtypeForm, name: e.target.value })} placeholder="Pneumonia Associada à Ventilação" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Descrição</Label>
                    <Input value={subtypeForm.description} onChange={(e) => setSubtypeForm({ ...subtypeForm, description: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Meta (%)</Label>
                    <Input type="number" value={subtypeForm.target_value} onChange={(e) => setSubtypeForm({ ...subtypeForm, target_value: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Limiar Amarelo (%)</Label>
                    <Input type="number" value={subtypeForm.warning_threshold} onChange={(e) => setSubtypeForm({ ...subtypeForm, warning_threshold: e.target.value })} />
                  </div>
                </div>

                {/* Bundle items */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Itens do Bundle (Checklist de Prevenção)</Label>
                    <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={addBundleItem}>
                      <Plus className="w-3 h-3" /> Item
                    </Button>
                  </div>
                  <div className="space-y-2 mt-2">
                    {subtypeForm.bundle_items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-background p-2 rounded border">
                        <Input className="h-7 text-xs w-16" placeholder="Código" value={item.code} onChange={(e) => updateBundleItem(idx, "code", e.target.value.toUpperCase())} />
                        <Input className="h-7 text-xs flex-1" placeholder="Descrição do item" value={item.label} onChange={(e) => updateBundleItem(idx, "label", e.target.value)} />
                        <Input className="h-7 text-xs w-28" placeholder="Referência" value={item.reference} onChange={(e) => updateBundleItem(idx, "reference", e.target.value)} />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeBundleItem(idx)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveSubtype} disabled={savingSubtype} className="flex-1 gradient-primary text-white border-0">
                    {savingSubtype ? "Salvando..." : editingSubtype?.id ? "Atualizar" : "Criar Subtipo"}
                  </Button>
                  {editingSubtype?.id && (
                    <Button variant="outline" onClick={() => { setEditingSubtype(null); setSubtypeForm(emptySubtype); }}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
