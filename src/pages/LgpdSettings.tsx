import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Shield, Download, Trash2, FileEdit, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function LgpdSettings() {
  const { user, profile } = useAuth();
  const [consents, setConsents] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("lgpd_consent_records").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("lgpd_data_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("lgpd_audit_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]).then(([c, r, a]) => {
      setConsents(c.data || []);
      setRequests(r.data || []);
      setAuditLogs(a.data || []);
      setLoading(false);
    });
  }, [user]);

  const handleRevokeConsent = async () => {
    if (!user) return;
    await supabase.from("lgpd_consent_records").insert({
      user_id: user.id,
      consent_type: "data_processing",
      granted: false,
      user_agent: navigator.userAgent,
    });
    await supabase.from("profiles").update({ lgpd_consent_given: false }).eq("user_id", user.id);
    await supabase.from("lgpd_audit_logs").insert({
      user_id: user.id,
      action: "consent_revoked",
      details: { consent_type: "data_processing" },
    });
    toast.success("Consentimento revogado. Algumas funcionalidades podem ser limitadas.");
    const { data } = await supabase.from("lgpd_consent_records").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setConsents(data || []);
  };

  const handleExportData = async () => {
    if (!user) return;
    await supabase.from("lgpd_data_requests").insert({
      user_id: user.id,
      request_type: "export",
      notes: "Solicitação de exportação de dados pessoais — Art. 18, V LGPD",
    });
    await supabase.from("lgpd_audit_logs").insert({
      user_id: user.id,
      action: "data_export_requested",
    });
    toast.success("Solicitação de exportação registrada. Você será notificado quando estiver pronta.");
    const { data } = await supabase.from("lgpd_data_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setRequests(data || []);
  };

  const handleDeleteRequest = async () => {
    if (!user) return;
    await supabase.from("lgpd_data_requests").insert({
      user_id: user.id,
      request_type: "deletion",
      notes: deleteReason || "Solicitação de eliminação de dados — Art. 18, VI LGPD",
    });
    await supabase.from("lgpd_audit_logs").insert({
      user_id: user.id,
      action: "data_deletion_requested",
      details: { reason: deleteReason },
    });
    toast.success("Solicitação de eliminação registrada. Será analisada em até 15 dias.");
    setDeleteDialogOpen(false);
    setDeleteReason("");
    const { data } = await supabase.from("lgpd_data_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setRequests(data || []);
  };

  const handleRectification = async () => {
    if (!user) return;
    await supabase.from("lgpd_data_requests").insert({
      user_id: user.id,
      request_type: "rectification",
      notes: "Solicitação de correção de dados — Art. 18, III LGPD",
    });
    await supabase.from("lgpd_audit_logs").insert({ user_id: user.id, action: "rectification_requested" });
    toast.success("Solicitação de correção registrada.");
    const { data } = await supabase.from("lgpd_data_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setRequests(data || []);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> Pendente</Badge>;
      case "processing": return <Badge className="bg-amber-500/20 text-amber-700 border-amber-300 gap-1"><Clock className="w-3 h-3" /> Processando</Badge>;
      case "completed": return <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-300 gap-1"><CheckCircle2 className="w-3 h-3" /> Concluído</Badge>;
      case "denied": return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Negado</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const requestTypeLabel = (type: string) => {
    switch (type) {
      case "export": return "Exportação de dados";
      case "deletion": return "Eliminação de dados";
      case "rectification": return "Correção de dados";
      case "access": return "Acesso aos dados";
      default: return type;
    }
  };

  const consentGiven = (profile as any)?.lgpd_consent_given;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" /> Privacidade & LGPD
          </h1>
          <p className="text-muted-foreground">Gerencie seus dados pessoais conforme a Lei Geral de Proteção de Dados</p>
        </div>

        {/* Consent Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status do Consentimento</CardTitle>
            <CardDescription>Seu consentimento para o tratamento de dados pessoais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {consentGiven ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                )}
                <div>
                  <p className="font-medium">{consentGiven ? "Consentimento ativo" : "Consentimento não fornecido"}</p>
                  <p className="text-sm text-muted-foreground">
                    {consentGiven && (profile as any)?.lgpd_consent_date
                      ? `Desde ${new Date((profile as any).lgpd_consent_date).toLocaleDateString("pt-BR")}`
                      : "Necessário para uso completo da plataforma"}
                  </p>
                </div>
              </div>
              {consentGiven && (
                <Button variant="outline" size="sm" onClick={handleRevokeConsent}>
                  Revogar Consentimento
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              <Link to="/privacy" className="underline text-primary">Ver Política de Privacidade completa</Link>
            </p>
          </CardContent>
        </Card>

        {/* Rights Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seus Direitos (Art. 18 LGPD)</CardTitle>
            <CardDescription>Exerça seus direitos como titular de dados pessoais</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button variant="outline" className="gap-2 h-auto py-4 flex-col" onClick={handleExportData}>
                <Download className="w-5 h-5" />
                <span className="text-sm">Exportar Meus Dados</span>
                <span className="text-xs text-muted-foreground">Art. 18, V — Portabilidade</span>
              </Button>
              <Button variant="outline" className="gap-2 h-auto py-4 flex-col" onClick={handleRectification}>
                <FileEdit className="w-5 h-5" />
                <span className="text-sm">Corrigir Dados</span>
                <span className="text-xs text-muted-foreground">Art. 18, III — Retificação</span>
              </Button>
              <Button variant="outline" className="gap-2 h-auto py-4 flex-col text-destructive hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="w-5 h-5" />
                <span className="text-sm">Eliminar Dados</span>
                <span className="text-xs text-muted-foreground">Art. 18, VI — Eliminação</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Requests History */}
        {requests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Solicitações</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{requestTypeLabel(r.request_type)}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Audit Log */}
        {auditLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Log de Atividades</CardTitle>
              <CardDescription>Registro de acessos e ações sobre seus dados</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ação</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.action}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.table_name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" /> Solicitar Eliminação de Dados
              </DialogTitle>
              <DialogDescription>
                Conforme Art. 18, VI da LGPD, você pode solicitar a eliminação dos seus dados pessoais.
                Note que dados exigidos por obrigação legal (como prontuários médicos — Resolução CFM 1.821/2007) serão mantidos pelo prazo legal.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Motivo (opcional)</Label>
                <Textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="Descreva o motivo da solicitação..." />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleDeleteRequest}>Confirmar Solicitação</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
