import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const wardTypes = [
  { value: "enfermaria", label: "Enfermaria" },
  { value: "UTI", label: "UTI" },
  { value: "CC", label: "Centro Cirúrgico" },
  { value: "PS", label: "Pronto Socorro" },
  { value: "ambulatorio", label: "Ambulatório" },
];

export default function AdminWards() {
  const { profile } = useAuth();
  const [wards, setWards] = useState<Tables<"wards">[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"wards"> | null>(null);
  const [form, setForm] = useState({ name: "", ward_type: "enfermaria", bed_count: 0 });

  useEffect(() => {
    if (!profile?.department_id) return;
    loadWards();
  }, [profile?.department_id]);

  async function loadWards() {
    setLoading(true);
    const { data } = await supabase.from("wards")
      .select("*")
      .eq("department_id", profile!.department_id!)
      .order("name");
    if (data) setWards(data);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ name: "", ward_type: "enfermaria", bed_count: 0 });
    setDialogOpen(true);
  }

  function openEdit(w: Tables<"wards">) {
    setEditing(w);
    setForm({ name: w.name, ward_type: w.ward_type, bed_count: w.bed_count || 0 });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    if (editing) {
      const { error } = await supabase.from("wards").update({ name: form.name, ward_type: form.ward_type, bed_count: form.bed_count }).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Enfermaria atualizada" });
    } else {
      const { error } = await supabase.from("wards").insert({ name: form.name, ward_type: form.ward_type, bed_count: form.bed_count, department_id: profile!.department_id! });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Enfermaria criada" });
    }
    setDialogOpen(false);
    loadWards();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta enfermaria?")) return;
    const { error } = await supabase.from("wards").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Enfermaria excluída" });
    loadWards();
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-['Space_Grotesk'] text-foreground">Enfermarias / Sub-unidades</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Nova Enfermaria</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Enfermaria</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.ward_type} onValueChange={v => setForm(p => ({ ...p, ward_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{wardTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Nº Leitos</Label><Input type="number" value={form.bed_count} onChange={e => setForm(p => ({ ...p, bed_count: Number(e.target.value) }))} /></div>
                <Button className="w-full" onClick={handleSave}>Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Leitos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : wards.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma enfermaria cadastrada</TableCell></TableRow>
                ) : wards.map(w => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell><Badge variant="outline">{wardTypes.find(t => t.value === w.ward_type)?.label || w.ward_type}</Badge></TableCell>
                    <TableCell>{w.bed_count}</TableCell>
                    <TableCell><Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? "Ativa" : "Inativa"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(w)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(w.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
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
