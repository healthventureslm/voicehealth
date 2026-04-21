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
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { PromptWizardDialog } from "@/components/admin/PromptWizardDialog";
import type { Tables } from "@/integrations/supabase/types";

type Protocol = Tables<"clinical_protocols">;

export default function AdminProtocols() {
  const { user } = useAuth();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", category: "", content: "", keywords: "" });
  const [wizardOpen, setWizardOpen] = useState(false);

  const fetchAll = async () => {
    const { data } = await supabase.from("clinical_protocols").select("*").order("title");
    setProtocols(data || []);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    const payload = { title: form.title, category: form.category || null, content: form.content, keywords: form.keywords ? form.keywords.split(",").map((k) => k.trim()) : null };
    if (editingId) {
      await supabase.from("clinical_protocols").update(payload).eq("id", editingId);
      toast.success("Protocolo atualizado!");
    } else {
      await supabase.from("clinical_protocols").insert({ ...payload, created_by: user?.id });
      toast.success("Protocolo criado!");
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm({ title: "", category: "", content: "", keywords: "" });
    fetchAll();
  };

  const handleEdit = (p: Protocol) => {
    setEditingId(p.id);
    setForm({ title: p.title, category: p.category || "", content: p.content, keywords: p.keywords?.join(", ") || "" });
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Protocolos Clínicos</h1>
            <p className="text-muted-foreground">Base de conhecimento para auxílio à decisão clínica</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); setForm({ title: "", category: "", content: "", keywords: "" }); } }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> Novo Protocolo</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editingId ? "Editar" : "Novo"} Protocolo</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex: Cardiologia, Emergência" /></div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>Conteúdo *</Label>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setWizardOpen(true)}>
                      <Wand2 className="w-3 h-3" /> Wizard de Prompt
                    </Button>
                  </div>
                  <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="min-h-[200px]" />
                </div>
                <div><Label>Palavras-chave (separadas por vírgula)</Label><Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="dispneia, taquicardia, ICC" /></div>
                <Button onClick={handleSave} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
          <PromptWizardDialog
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            onPromptGenerated={(prompt) => setForm({ ...form, content: prompt })}
            contextType="protocol"
            contextName={form.title}
            contextDescription={form.category}
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Palavras-chave</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {protocols.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell>{p.category || "—"}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex flex-wrap gap-1">{p.keywords?.slice(0, 3).map((k) => <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>)}</div>
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={async () => { await supabase.from("clinical_protocols").delete().eq("id", p.id); fetchAll(); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
