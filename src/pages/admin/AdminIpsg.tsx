import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Tables, Json } from "@/integrations/supabase/types";

interface ChecklistItem { id: string; question: string; }

export default function AdminIpsg() {
  const [goals, setGoals] = useState<Tables<"ipsg_goals">[]>([]);
  const [checklists, setChecklists] = useState<Tables<"ipsg_audit_checklists">[]>([]);
  const [loading, setLoading] = useState(true);
  const [editGoal, setEditGoal] = useState<Tables<"ipsg_goals"> | null>(null);
  const [goalForm, setGoalForm] = useState({ target_value: 0, warning_threshold: 0, critical_threshold: 0 });
  const [editChecklist, setEditChecklist] = useState<Tables<"ipsg_audit_checklists"> | null>(null);
  const [checklistForm, setChecklistForm] = useState({ title: "", description: "", items_text: "", ipsg_goal_id: "" });
  const [showChecklistDialog, setShowChecklistDialog] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [g, c] = await Promise.all([
      supabase.from("ipsg_goals").select("*").order("sort_order"),
      supabase.from("ipsg_audit_checklists").select("*").order("created_at"),
    ]);
    if (g.data) setGoals(g.data);
    if (c.data) setChecklists(c.data);
    setLoading(false);
  }

  function openEditGoal(g: Tables<"ipsg_goals">) {
    setEditGoal(g);
    setGoalForm({ target_value: Number(g.target_value) || 0, warning_threshold: Number(g.warning_threshold) || 0, critical_threshold: Number(g.critical_threshold) || 0 });
  }

  async function saveGoal() {
    if (!editGoal) return;
    const { error } = await supabase.from("ipsg_goals").update(goalForm).eq("id", editGoal.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Meta atualizada" });
    setEditGoal(null);
    loadData();
  }

  function openNewChecklist(goalId?: string) {
    setEditChecklist(null);
    setChecklistForm({ title: "", description: "", items_text: "", ipsg_goal_id: goalId || "" });
    setShowChecklistDialog(true);
  }

  function openEditChecklist(c: Tables<"ipsg_audit_checklists">) {
    setEditChecklist(c);
    const items = Array.isArray(c.items) ? (c.items as unknown as ChecklistItem[]) : [];
    setChecklistForm({
      title: c.title,
      description: c.description || "",
      items_text: items.map(i => i.question).join("\n"),
      ipsg_goal_id: c.ipsg_goal_id,
    });
    setShowChecklistDialog(true);
  }

  async function saveChecklist() {
    const items: ChecklistItem[] = checklistForm.items_text.split("\n").filter(Boolean).map((q, i) => ({ id: `item-${i + 1}`, question: q.trim() }));
    const payload = {
      title: checklistForm.title,
      description: checklistForm.description || null,
      ipsg_goal_id: checklistForm.ipsg_goal_id,
      items: items as unknown as Json,
    };
    if (editChecklist) {
      const { error } = await supabase.from("ipsg_audit_checklists").update(payload).eq("id", editChecklist.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("ipsg_audit_checklists").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: "Checklist salvo" });
    setShowChecklistDialog(false);
    loadData();
  }

  async function deleteChecklist(id: string) {
    if (!confirm("Excluir este checklist?")) return;
    await supabase.from("ipsg_audit_checklists").delete().eq("id", id);
    toast({ title: "Checklist excluído" });
    loadData();
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold font-['Space_Grotesk'] text-foreground">Configuração IPSG</h1>

        <Tabs defaultValue="goals">
          <TabsList>
            <TabsTrigger value="goals">Metas IPSG</TabsTrigger>
            <TabsTrigger value="checklists">Checklists de Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="goals" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Meta</TableHead>
                      <TableHead>Alerta</TableHead>
                      <TableHead>Crítico</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {goals.map(g => (
                      <TableRow key={g.id}>
                        <TableCell><Badge variant="outline">{g.code}</Badge></TableCell>
                        <TableCell>{g.name}</TableCell>
                        <TableCell>{g.target_value}</TableCell>
                        <TableCell>{g.warning_threshold}</TableCell>
                        <TableCell>{g.critical_threshold}</TableCell>
                        <TableCell>{g.unit}</TableCell>
                        <TableCell>
                          {g.is_customizable && (
                            <Button variant="ghost" size="icon" onClick={() => openEditGoal(g)}><Pencil className="w-4 h-4" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {editGoal && (
              <Dialog open={!!editGoal} onOpenChange={() => setEditGoal(null)}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Editar Meta: {editGoal.code}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Meta (%)</Label><Input type="number" value={goalForm.target_value} onChange={e => setGoalForm(p => ({ ...p, target_value: Number(e.target.value) }))} /></div>
                    <div><Label>Limiar de Alerta (%)</Label><Input type="number" value={goalForm.warning_threshold} onChange={e => setGoalForm(p => ({ ...p, warning_threshold: Number(e.target.value) }))} /></div>
                    <div><Label>Limiar Crítico (%)</Label><Input type="number" value={goalForm.critical_threshold} onChange={e => setGoalForm(p => ({ ...p, critical_threshold: Number(e.target.value) }))} /></div>
                    <Button className="w-full" onClick={saveGoal}>Salvar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>

          <TabsContent value="checklists" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => openNewChecklist()}><Plus className="w-4 h-4 mr-2" /> Novo Checklist</Button>
            </div>

            {goals.map(g => {
              const goalChecklists = checklists.filter(c => c.ipsg_goal_id === g.id);
              if (goalChecklists.length === 0) return null;
              return (
                <Card key={g.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Badge variant="outline">{g.code}</Badge> {g.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {goalChecklists.map(c => {
                      const items = Array.isArray(c.items) ? (c.items as unknown as ChecklistItem[]) : [];
                      return (
                        <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{c.title}</p>
                            <p className="text-xs text-muted-foreground">{items.length} itens · {c.frequency}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditChecklist(c)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteChecklist(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}

            <Dialog open={showChecklistDialog} onOpenChange={setShowChecklistDialog}>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{editChecklist ? "Editar" : "Novo"} Checklist</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Meta IPSG *</Label>
                    <select className="w-full border rounded-md p-2 text-sm" value={checklistForm.ipsg_goal_id} onChange={e => setChecklistForm(p => ({ ...p, ipsg_goal_id: e.target.value }))}>
                      <option value="">Selecione</option>
                      {goals.map(g => <option key={g.id} value={g.id}>{g.code} - {g.name}</option>)}
                    </select>
                  </div>
                  <div><Label>Título *</Label><Input value={checklistForm.title} onChange={e => setChecklistForm(p => ({ ...p, title: e.target.value }))} /></div>
                  <div><Label>Descrição</Label><Input value={checklistForm.description} onChange={e => setChecklistForm(p => ({ ...p, description: e.target.value }))} /></div>
                  <div>
                    <Label>Itens do Checklist (um por linha)</Label>
                    <Textarea rows={8} value={checklistForm.items_text} onChange={e => setChecklistForm(p => ({ ...p, items_text: e.target.value }))} placeholder="Paciente identificado com pulseira?&#10;Dois identificadores verificados?&#10;..." />
                  </div>
                  <Button className="w-full" onClick={saveChecklist}>Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
