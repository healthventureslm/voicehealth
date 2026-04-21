import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { Save, Send } from "lucide-react";
import type { Tables, Json } from "@/integrations/supabase/types";

interface ChecklistItem {
  id: string;
  question: string;
  category?: string;
}

export default function IpsgNewAudit() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Tables<"ipsg_goals">[]>([]);
  const [wards, setWards] = useState<Tables<"wards">[]>([]);
  const [checklists, setChecklists] = useState<Tables<"ipsg_audit_checklists">[]>([]);
  const [selectedGoal, setSelectedGoal] = useState("");
  const [selectedWard, setSelectedWard] = useState("");
  const [selectedChecklist, setSelectedChecklist] = useState("");
  const [responses, setResponses] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    if (!profile?.department_id) return;
    Promise.all([
      supabase.from("ipsg_goals").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("wards").select("*").eq("department_id", profile.department_id).eq("is_active", true),
    ]).then(([g, w]) => {
      if (g.data) setGoals(g.data);
      if (w.data) setWards(w.data);
    });
  }, [profile?.department_id]);

  useEffect(() => {
    if (!selectedGoal) return;
    supabase.from("ipsg_audit_checklists")
      .select("*")
      .eq("ipsg_goal_id", selectedGoal)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setChecklists(data);
        if (data && data.length > 0) {
          setSelectedChecklist(data[0].id);
          const parsed = Array.isArray(data[0].items) ? (data[0].items as unknown as ChecklistItem[]) : [];
          setItems(parsed);
          setResponses({});
        }
      });
  }, [selectedGoal]);

  useEffect(() => {
    const checklist = checklists.find(c => c.id === selectedChecklist);
    if (checklist) {
      const parsed = Array.isArray(checklist.items) ? (checklist.items as unknown as ChecklistItem[]) : [];
      setItems(parsed);
      setResponses({});
    }
  }, [selectedChecklist]);

  async function handleSave(complete: boolean) {
    if (!selectedGoal || !profile?.department_id || !user) {
      toast({ title: "Preencha meta e enfermaria", variant: "destructive" });
      return;
    }
    setSaving(true);
    const totalItems = items.length;
    const conformingItems = Object.values(responses).filter(Boolean).length;
    const responseArray = items.map(item => ({
      id: item.id,
      question: item.question,
      conforming: responses[item.id] || false
    }));

    const goal = goals.find(g => g.id === selectedGoal);

    const { data, error } = await supabase.from("ipsg_audit_records").insert({
      ipsg_goal_id: selectedGoal,
      ward_id: selectedWard || null,
      department_id: profile.department_id,
      auditor_id: user.id,
      checklist_id: selectedChecklist || null,
      responses: responseArray as unknown as Json,
      total_items: totalItems,
      conforming_items: conformingItems,
      status: complete ? "completed" : "draft",
      notes,
    }).select().single();

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Auto-create action plan if below target
    if (complete && goal && goal.target_value) {
      const conformityRate = totalItems > 0 ? (conformingItems / totalItems) * 100 : 0;
      if (conformityRate < Number(goal.target_value)) {
        await supabase.from("ipsg_action_plans").insert({
          ipsg_goal_id: selectedGoal,
          audit_record_id: data.id,
          ward_id: selectedWard || null,
          department_id: profile.department_id,
          title: `Não-conformidade ${goal.code}: ${Math.round(conformityRate)}% (meta ${goal.target_value}%)`,
          description: `Auditoria de ${new Date().toLocaleDateString("pt-BR")} identificou conformidade de ${Math.round(conformityRate)}%, abaixo da meta de ${goal.target_value}%. Ações corretivas necessárias.`,
          status: "open",
        });

        // Notification
        await supabase.from("notifications").insert({
          user_id: user.id,
          type: "warning",
          title: `Alerta IPSG: ${goal.code} abaixo da meta`,
          message: `Conformidade de ${Math.round(conformityRate)}% na última auditoria (meta: ${goal.target_value}%).`,
          link: `/ipsg/audit/${data.id}`,
        });
      }
    }

    toast({ title: complete ? "Auditoria concluída" : "Rascunho salvo" });
    navigate(complete ? `/ipsg/audit/${data.id}` : "/ipsg/audits");
    setSaving(false);
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-3xl">
        <h1 className="text-2xl font-bold font-['Space_Grotesk'] text-foreground">Nova Auditoria IPSG</h1>

        <Card>
          <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meta IPSG *</Label>
                <Select value={selectedGoal} onValueChange={setSelectedGoal}>
                  <SelectTrigger><SelectValue placeholder="Selecione a meta" /></SelectTrigger>
                  <SelectContent>
                    {goals.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.code} - {g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Enfermaria</Label>
                <Select value={selectedWard} onValueChange={setSelectedWard}>
                  <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {wards.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {checklists.length > 1 && (
              <div className="space-y-2">
                <Label>Checklist</Label>
                <Select value={selectedChecklist} onValueChange={setSelectedChecklist}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {checklists.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Checklist ({Object.values(responses).filter(Boolean).length}/{items.length} conformes)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item, i) => (
                <div key={item.id || i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <Checkbox
                    checked={responses[item.id] || false}
                    onCheckedChange={(v) => setResponses(prev => ({ ...prev, [item.id]: !!v }))}
                  />
                  <span className="text-sm">{item.question}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-4">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionais..." className="mt-2" />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            <Save className="w-4 h-4 mr-2" /> Salvar Rascunho
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            <Send className="w-4 h-4 mr-2" /> Concluir Auditoria
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
