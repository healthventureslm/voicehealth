import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

export default function IpsgAuditDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [audit, setAudit] = useState<any>(null);
  const [actionPlans, setActionPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("ipsg_audit_records").select("*, ipsg_goals(code, name, target_value), wards(name)").eq("id", id).single(),
      supabase.from("ipsg_action_plans").select("*").eq("audit_record_id", id),
    ]).then(([a, p]) => {
      if (a.data) setAudit(a.data);
      if (p.data) setActionPlans(p.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div></AppLayout>;
  }

  if (!audit) {
    return <AppLayout><div className="p-6 text-muted-foreground">Auditoria não encontrada.</div></AppLayout>;
  }

  const responses = Array.isArray(audit.responses) ? audit.responses : [];

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-3xl">
        <Button variant="ghost" onClick={() => navigate("/ipsg/audits")} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-['Space_Grotesk'] text-foreground">
            Auditoria {(audit.ipsg_goals as any)?.code}
          </h1>
          <Badge variant={audit.status === "completed" ? "default" : "secondary"}>
            {audit.status === "completed" ? "Concluída" : "Rascunho"}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Data</p><p className="font-medium">{new Date(audit.audit_date).toLocaleDateString("pt-BR")}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Enfermaria</p><p className="font-medium">{(audit.wards as any)?.name || "—"}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Conformidade</p><p className={`text-xl font-bold ${Number(audit.conformity_rate) >= 90 ? "text-green-600" : Number(audit.conformity_rate) >= 70 ? "text-yellow-600" : "text-red-600"}`}>{audit.conformity_rate}%</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Itens</p><p className="font-medium">{audit.conforming_items}/{audit.total_items}</p></CardContent></Card>
        </div>

        {responses.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Respostas do Checklist</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {responses.map((r: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                  {r.conforming ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                  <span className="text-sm">{r.question}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {audit.notes && (
          <Card>
            <CardHeader><CardTitle>Observações</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{audit.notes}</p></CardContent>
          </Card>
        )}

        {actionPlans.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Planos de Ação Gerados</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {actionPlans.map(p => (
                <div key={p.id} className="p-3 rounded-lg border space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{p.title}</p>
                    <Badge variant={p.status === "open" ? "destructive" : p.status === "completed" ? "default" : "secondary"}>{p.status}</Badge>
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
