import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Shield, Clock, CheckCircle2, AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";

export default function AdminLgpd() {
  const { user, isAdmin } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [retentionPolicies, setRetentionPolicies] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [responseNotes, setResponseNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [retentionDialog, setRetentionDialog] = useState(false);
  const [retentionForm, setRetentionForm] = useState({ table_name: "", retention_days: 365, anonymize_on_expiry: true, description: "" });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [r, p] = await Promise.all([
      supabase.from("lgpd_data_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("lgpd_data_retention_policies").select("*").order("table_name"),
    ]);
    setRequests(r.data || []);
    setRetentionPolicies(p.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpdateRequest = async () => {
    if (!selectedRequest || !newStatus || !user) return;
    await supabase.from("lgpd_data_requests").update({
      status: newStatus,
      notes: responseNotes,
      processed_at: new Date().toISOString(),
      processed_by: user.id,
    }).eq("id", selectedRequest.id);

    await supabase.from("lgpd_audit_logs").insert({
      user_id: user.id,
      action: `request_${newStatus}`,
      table_name: "lgpd_data_requests",
      record_id: selectedRequest.id,
      details: { request_type: selectedRequest.request_type, notes: responseNotes },
    });

    toast.success("Solicitação atualizada");
    setSelectedRequest(null);
    setResponseNotes("");
    setNewStatus("");
    fetchData();
  };

  const handleAddRetention = async () => {
    if (!retentionForm.table_name) return;
    const { error } = await supabase.from("lgpd_data_retention_policies").insert(retentionForm);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Política de retenção adicionada");
    setRetentionDialog(false);
    setRetentionForm({ table_name: "", retention_days: 365, anonymize_on_expiry: true, description: "" });
    fetchData();
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> Pendente</Badge>;
      case "processing": return <Badge className="bg-amber-500/20 text-amber-700 border-amber-300">Processando</Badge>;
      case "completed": return <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-300">Concluído</Badge>;
      case "denied": return <Badge variant="destructive">Negado</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const typeLabel = (t: string) => ({ export: "Exportação", deletion: "Eliminação", rectification: "Correção", access: "Acesso" }[t] || t);

  if (!isAdmin) return <AppLayout><div className="p-6"><p>Acesso restrito a administradores.</p></div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" /> Gestão LGPD
          </h1>
          <p className="text-muted-foreground">Gerencie solicitações de titulares e políticas de retenção de dados</p>
        </div>

        {/* Pending Requests Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-amber-600">{requests.filter(r => r.status === "pending").length}</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-blue-600">{requests.filter(r => r.status === "processing").length}</p>
              <p className="text-sm text-muted-foreground">Em processamento</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-emerald-600">{requests.filter(r => r.status === "completed").length}</p>
              <p className="text-sm text-muted-foreground">Concluídas</p>
            </CardContent>
          </Card>
        </div>

        {/* Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Solicitações de Titulares</CardTitle>
            <CardDescription>Art. 18 LGPD — Prazo de 15 dias para resposta</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma solicitação</TableCell></TableRow>
                ) : requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{typeLabel(r.request_type)}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.notes || "—"}</TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" || r.status === "processing" ? (
                        <Button size="sm" variant="outline" onClick={() => { setSelectedRequest(r); setNewStatus(""); setResponseNotes(""); }}>
                          Responder
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Retention Policies */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Políticas de Retenção de Dados</CardTitle>
              <CardDescription>Art. 16 LGPD — Definição de prazos de retenção por tabela</CardDescription>
            </div>
            <Button size="sm" className="gap-1" onClick={() => setRetentionDialog(true)}>
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tabela</TableHead>
                  <TableHead>Retenção (dias)</TableHead>
                  <TableHead>Anonimizar</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {retentionPolicies.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma política definida</TableCell></TableRow>
                ) : retentionPolicies.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.table_name}</TableCell>
                    <TableCell>{p.retention_days}</TableCell>
                    <TableCell>{p.anonymize_on_expiry ? "Sim" : "Não"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.description || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Response Dialog */}
        <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && setSelectedRequest(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Responder Solicitação</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm">Tipo: <strong>{selectedRequest && typeLabel(selectedRequest.request_type)}</strong></p>
              <p className="text-sm text-muted-foreground">{selectedRequest?.notes}</p>
              <div>
                <Label>Novo Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="processing">Em processamento</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="denied">Negado (justificar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={responseNotes} onChange={(e) => setResponseNotes(e.target.value)} placeholder="Detalhes da resposta..." />
              </div>
              <Button onClick={handleUpdateRequest} disabled={!newStatus} className="w-full">Atualizar</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Retention Dialog */}
        <Dialog open={retentionDialog} onOpenChange={setRetentionDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Política de Retenção</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome da Tabela</Label><Input value={retentionForm.table_name} onChange={(e) => setRetentionForm({ ...retentionForm, table_name: e.target.value })} placeholder="ex: consultations" /></div>
              <div><Label>Dias de Retenção</Label><Input type="number" value={retentionForm.retention_days} onChange={(e) => setRetentionForm({ ...retentionForm, retention_days: parseInt(e.target.value) || 365 })} /></div>
              <div><Label>Descrição</Label><Textarea value={retentionForm.description} onChange={(e) => setRetentionForm({ ...retentionForm, description: e.target.value })} /></div>
              <Button onClick={handleAddRetention} className="w-full">Adicionar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
