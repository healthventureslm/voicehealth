import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Eye } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export default function IpsgAudits() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [audits, setAudits] = useState<any[]>([]);
  const [goals, setGoals] = useState<Tables<"ipsg_goals">[]>([]);
  const [filterGoal, setFilterGoal] = useState(searchParams.get("goal") || "all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.department_id) return;
    loadData();
  }, [profile?.department_id, filterGoal]);

  async function loadData() {
    setLoading(true);
    const [goalsRes, auditsQuery] = await Promise.all([
      supabase.from("ipsg_goals").select("*").eq("is_active", true).order("sort_order"),
      (() => {
        let q = supabase.from("ipsg_audit_records")
          .select("*, ipsg_goals(code, name), wards(name)")
          .eq("department_id", profile!.department_id!)
          .order("audit_date", { ascending: false })
          .limit(100);
        if (filterGoal !== "all") {
          const goalMatch = goals.find(g => g.code === filterGoal);
          if (goalMatch) q = q.eq("ipsg_goal_id", goalMatch.id);
        }
        return q;
      })()
    ]);
    if (goalsRes.data) setGoals(goalsRes.data);
    if (auditsQuery.data) setAudits(auditsQuery.data);
    setLoading(false);
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-['Space_Grotesk'] text-foreground">Auditorias IPSG</h1>
          <Button onClick={() => navigate("/ipsg/audit/new")}>
            <Plus className="w-4 h-4 mr-2" /> Nova Auditoria
          </Button>
        </div>

        <div className="flex gap-4">
          <Select value={filterGoal} onValueChange={setFilterGoal}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por meta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as metas</SelectItem>
              {goals.map(g => (
                <SelectItem key={g.id} value={g.code}>{g.code} - {g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead>Enfermaria</TableHead>
                  <TableHead>Conformidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : audits.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma auditoria encontrada</TableCell></TableRow>
                ) : audits.map(a => (
                  <TableRow key={a.id}>
                    <TableCell>{new Date(a.audit_date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{(a.ipsg_goals as any)?.code}</Badge>
                    </TableCell>
                    <TableCell>{(a.wards as any)?.name || "—"}</TableCell>
                    <TableCell>
                      <span className={`font-medium ${Number(a.conformity_rate) >= 90 ? "text-green-600" : Number(a.conformity_rate) >= 70 ? "text-yellow-600" : "text-red-600"}`}>
                        {a.conformity_rate != null ? `${a.conformity_rate}%` : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.status === "completed" ? "default" : "secondary"}>
                        {a.status === "completed" ? "Concluída" : "Rascunho"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/ipsg/audit/${a.id}`)}>
                        <Eye className="w-4 h-4" />
                      </Button>
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
