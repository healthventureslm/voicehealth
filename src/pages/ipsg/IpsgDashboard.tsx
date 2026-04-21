import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Shield, Plus, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, BarChart, Bar, ReferenceLine
} from "recharts";

interface IpsgGoal {
  id: string;
  code: string;
  name: string;
  target_value: number | null;
  warning_threshold: number | null;
  critical_threshold: number | null;
  unit: string;
  sort_order: number;
}

interface AuditSummary {
  ipsg_goal_id: string;
  avg_conformity: number;
  total_audits: number;
}

function getSeverityColor(value: number, target: number | null, warning: number | null, critical: number | null) {
  if (!target) return "default";
  if (value >= target) return "success";
  if (warning && value >= warning) return "warning";
  return "destructive";
}

function SemaphoreIcon({ value, target, warning, critical }: { value: number; target: number | null; warning: number | null; critical: number | null }) {
  if (!target) return <CheckCircle2 className="w-5 h-5 text-muted-foreground" />;
  if (value >= target) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  if (warning && value >= warning) return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  return <XCircle className="w-5 h-5 text-red-500" />;
}

export default function IpsgDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [goals, setGoals] = useState<IpsgGoal[]>([]);
  const [summaries, setSummaries] = useState<Map<string, AuditSummary>>(new Map());
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPlansCount, setActionPlansCount] = useState(0);

  useEffect(() => {
    if (!profile?.department_id) return;
    loadData();
  }, [profile?.department_id]);

  async function loadData() {
    setLoading(true);
    const [goalsRes, auditsRes, plansRes] = await Promise.all([
      supabase.from("ipsg_goals").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("ipsg_audit_records").select("ipsg_goal_id, conformity_rate, audit_date")
        .eq("department_id", profile!.department_id!)
        .eq("status", "completed")
        .order("audit_date", { ascending: true }),
      supabase.from("ipsg_action_plans").select("id", { count: "exact" })
        .eq("department_id", profile!.department_id!)
        .in("status", ["open", "in_progress"])
    ]);

    if (goalsRes.data) setGoals(goalsRes.data as IpsgGoal[]);
    if (plansRes.count) setActionPlansCount(plansRes.count);

    // Build summaries and trend
    if (auditsRes.data && goalsRes.data) {
      const map = new Map<string, { sum: number; count: number }>();
      const trendMap = new Map<string, any>();

      for (const a of auditsRes.data) {
        const existing = map.get(a.ipsg_goal_id) || { sum: 0, count: 0 };
        existing.sum += Number(a.conformity_rate || 0);
        existing.count += 1;
        map.set(a.ipsg_goal_id, existing);

        // Trend by month
        const month = a.audit_date.substring(0, 7);
        if (!trendMap.has(month)) trendMap.set(month, { month });
        const goal = goalsRes.data.find((g: any) => g.id === a.ipsg_goal_id);
        if (goal) {
          const key = (goal as IpsgGoal).code;
          const entry = trendMap.get(month)!;
          if (!entry[key]) entry[key] = { sum: 0, count: 0 };
          entry[key].sum += Number(a.conformity_rate || 0);
          entry[key].count += 1;
        }
      }

      const summaryMap = new Map<string, AuditSummary>();
      map.forEach((v, k) => summaryMap.set(k, { ipsg_goal_id: k, avg_conformity: v.count > 0 ? v.sum / v.count : 0, total_audits: v.count }));
      setSummaries(summaryMap);

      // Flatten trend
      const trend = Array.from(trendMap.values()).map(entry => {
        const flat: any = { month: entry.month };
        for (const key of Object.keys(entry)) {
          if (key !== "month" && entry[key].count > 0) {
            flat[key] = Math.round(entry[key].sum / entry[key].count);
          }
        }
        return flat;
      });
      setTrendData(trend);
    }

    setLoading(false);
  }

  // Radar data
  const radarData = goals.map(g => {
    const s = summaries.get(g.id);
    return {
      goal: g.code,
      conformidade: s ? Math.round(s.avg_conformity) : 0,
      meta: g.target_value || 0,
      fullMark: 100,
    };
  });

  const lineColors = ["hsl(199 89% 48%)", "hsl(160 84% 39%)", "hsl(38 92% 50%)", "hsl(0 72% 51%)", "hsl(270 60% 50%)", "hsl(30 80% 50%)"];

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk'] text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Dashboard IPSG
            </h1>
            <p className="text-muted-foreground text-sm">Metas Internacionais de Segurança do Paciente — JCI 8ª Edição</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/ipsg/action-plans")}>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Planos de Ação ({actionPlansCount})
            </Button>
            <Button onClick={() => navigate("/ipsg/audit/new")}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Auditoria
            </Button>
          </div>
        </div>

        {/* Semaphore Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {goals.map(g => {
            const s = summaries.get(g.id);
            const value = s ? Math.round(s.avg_conformity) : 0;
            const severity = getSeverityColor(value, g.target_value, g.warning_threshold, g.critical_threshold);
            return (
              <Card key={g.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/ipsg/audits?goal=${g.code}`)}>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={severity === "success" ? "default" : severity === "warning" ? "secondary" : severity === "destructive" ? "destructive" : "outline"} className="text-xs">
                      {g.code}
                    </Badge>
                    <SemaphoreIcon value={value} target={g.target_value} warning={g.warning_threshold} critical={g.critical_threshold} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{value}{g.unit === "%" ? "%" : ""}</p>
                  <p className="text-xs text-muted-foreground truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground">Meta: {g.target_value}{g.unit === "%" ? "%" : ` ${g.unit}`}</p>
                  <p className="text-xs text-muted-foreground">{s?.total_audits || 0} auditorias</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Radar de Conformidade</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="goal" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="Conformidade" dataKey="conformidade" stroke="hsl(199 89% 48%)" fill="hsl(199 89% 48%)" fillOpacity={0.3} />
                  <Radar name="Meta" dataKey="meta" stroke="hsl(160 84% 39%)" fill="none" strokeDasharray="5 5" />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Line Chart - Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tendência de Conformidade</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  {goals.map((g, i) => (
                    <Line key={g.code} type="monotone" dataKey={g.code} stroke={lineColors[i % lineColors.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  ))}
                  <ReferenceLine y={90} stroke="hsl(160 84% 39%)" strokeDasharray="3 3" label="Meta geral" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
