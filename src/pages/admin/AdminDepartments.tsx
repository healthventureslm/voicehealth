import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Department = Tables<"departments">;

export default function AdminDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const fetchAll = async () => {
    const { data } = await supabase.from("departments").select("*").order("name");
    setDepartments(data || []);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSave = async () => {
    if (!form.name) return;
    if (editingId) {
      await supabase.from("departments").update(form).eq("id", editingId);
      toast.success("Departamento atualizado!");
    } else {
      const { error } = await supabase.from("departments").insert(form);
      if (error) { toast.error(error.message); return; }
      toast.success("Departamento criado!");
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm({ name: "", description: "" });
    fetchAll();
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Departamentos</h1>
            <p className="text-muted-foreground">Gerencie os departamentos da instituição</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); setForm({ name: "", description: "" }); } }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> Novo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Editar" : "Novo"} Departamento</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <Button onClick={handleSave} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Descrição</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
              <TableBody>
                {departments.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">{d.description || "—"}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingId(d.id); setForm({ name: d.name, description: d.description || "" }); setDialogOpen(true); }}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={async () => { await supabase.from("departments").delete().eq("id", d.id); fetchAll(); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
