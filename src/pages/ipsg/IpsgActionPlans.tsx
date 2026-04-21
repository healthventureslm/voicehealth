import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  completed: "Concluído",
  overdue: "Atrasado",
};

const statusVariant: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  open: "destructive",
  in_progress: "secondary",
  completed: "default",
  overdue: "destructive",
};

export default function IpsgActionPlans() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("open");

  useEffect(() => {
    if (!profile?.department_id) return;
    loadData();
  }, [profile?.department_id, filterStatus]);

  async function loadData() {
    setLoading(true);
    let q = supabase.from("ipsg_action_plans")
      .select("*, ipsg_goals(code, name), wards(name)")
      .eq("department_id", profile!.department_id!)
      .order("created_at", { ascending: false });
    if (filterStatus !== "all") q = q.eq("status", filterStatus);
    const { data } = await q;
    if (data) setPlans(data);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    const update: any = { status };
    if (status === "completed") update.completed_at = new Date().toISOString();
    const { error } = await supabase.from("ipsg_action_plans").update(update).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Status atualizado" });
      loadData();
    }
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold font-['Space_Grotesk'] text-foreground">Planos de Ação IPSG</h1>

        <div className="flex gap-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="in_progress">Em Andamento</SelectItem>
              <SelectItem value="completed">Concluídos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meta</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Enfermaria</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : plans.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum plano de ação encontrado</TableCell></TableRow>
                ) : plans.map(p => (
                  <TableRow key={p.id}>
                    <TableCell><Badge variant="outline">{(p.ipsg_goals as any)?.code}</Badge></TableCell>
                    <TableCell className="max-w-[300px] truncate">{p.title}</TableCell>
                    <TableCell>{(p.wards as any)?.name || "—"}</TableCell>
                    <TableCell>{p.due_date ? new Date(p.due_date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell><Badge variant={statusVariant[p.status] || "outline"}>{statusLabels[p.status] || p.status}</Badge></TableCell>
                    <TableCell>
                      {p.status === "open" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, "in_progress")}>Iniciar</Button>
                      )}
                      {p.status === "in_progress" && (
                        <Button size="sm" onClick={() => updateStatus(p.id, "completed")}>Concluir</Button>
                      )}
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
