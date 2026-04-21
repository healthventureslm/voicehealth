import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import { Users, FileText, Mic, Stethoscope, DollarSign, TrendingUp, Building2, Hospital } from "lucide-react";
import { Navigate } from "react-router-dom";
import { subDays, format, startOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type PeriodFilter = "7d" | "30d" | "90d" | "365d" | "all";

function getPeriodDate(period: PeriodFilter): string | null {
  if (period === "all") return null;
  const days = parseInt(period);
  return subDays(new Date(), days).toISOString();
}

export default function AdminAnalytics() {
  const { isAdmin } = useAuth();
  const [period, setPeriod] = useState<PeriodFilter>("30d");

  const periodDate = useMemo(() => getPeriodDate(period), [period]);

  // Fetch all data in parallel
  const { data: consultations = [] } = useQuery({
    queryKey: ["analytics-consultations", period],
    queryFn: async () => {
      let q = supabase.from("consultations").select("id, professional_id, department_id, ward_id, specialty_id, audio_url, created_at");
      if (periodDate) q = q.gte("created_at", periodDate);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["analytics-patients", period],
    queryFn: async () => {
      let q = supabase.from("patients").select("id, department_id, current_ward_id, created_at");
      if (periodDate) q = q.gte("created_at", periodDate);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["analytics-reports", period],
    queryFn: async () => {
      let q = supabase.from("clinical_reports").select("id, consultation_id, created_at");
      if (periodDate) q = q.gte("created_at", periodDate);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["analytics-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, professional_role, department_id");
      return data || [];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["analytics-departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name");
      return data || [];
    },
  });

  const { data: wards = [] } = useQuery({
    queryKey: ["analytics-wards"],
    queryFn: async () => {
      const { data } = await supabase.from("wards").select("id, name, department_id");
      return data || [];
    },
  });

  const { data: specialties = [] } = useQuery({
    queryKey: ["analytics-specialties"],
    queryFn: async () => {
      const { data } = await supabase.from("medical_specialties").select("id, name");
      return data || [];
    },
  });

  const { data: costSetting } = useQuery({
    queryKey: ["analytics-cost-setting"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "cost_per_recording").maybeSingle();
      return data?.value ? parseFloat(data.value) : 0.5;
    },
  });

  const costPerRecording = costSetting ?? 0.5;

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  // Summary
  const totalProfiles = profiles.length;
  const totalPatients = patients.length;
  const totalReports = reports.length;
  const recordingsCount = consultations.filter((c) => c.audio_url).length;
  const totalCost = recordingsCount * costPerRecording;

  // Top users by consultations
  const userConsultationMap: Record<string, number> = {};
  consultations.forEach((c) => {
    userConsultationMap[c.professional_id] = (userConsultationMap[c.professional_id] || 0) + 1;
  });
  const topUsers = Object.entries(userConsultationMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([userId, count]) => {
      const p = profiles.find((pr) => pr.user_id === userId);
      const dept = departments.find((d) => d.id === p?.department_id);
      return { name: p?.full_name || "—", role: p?.professional_role || "—", department: dept?.name || "—", count };
    });

  // Reports by month
  const reportsByMonth: Record<string, number> = {};
  reports.forEach((r) => {
    const key = format(startOfMonth(parseISO(r.created_at)), "yyyy-MM");
    reportsByMonth[key] = (reportsByMonth[key] || 0) + 1;
  });
  const reportsChartData = Object.entries(reportsByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      month: format(parseISO(month + "-01"), "MMM/yy", { locale: ptBR }),
      relatorios: count,
    }));

  // By department
  const deptStats = departments.map((dept) => {
    const deptConsultations = consultations.filter((c) => c.department_id === dept.id);
    const deptRecordings = deptConsultations.filter((c) => c.audio_url).length;
    return {
      name: dept.name,
      pacientes: patients.filter((p) => p.department_id === dept.id).length,
      atendimentos: deptConsultations.length,
      gravacoes: deptRecordings,
      custo: (deptRecordings * costPerRecording).toFixed(2),
    };
  });

  // By ward
  const wardStats = wards.map((w) => {
    const wardConsultations = consultations.filter((c) => c.ward_id === w.id);
    const dept = departments.find((d) => d.id === w.department_id);
    return {
      name: w.name,
      department: dept?.name || "—",
      atendimentos: wardConsultations.length,
      gravacoes: wardConsultations.filter((c) => c.audio_url).length,
    };
  }).filter((w) => w.atendimentos > 0);

  // Ambulatory by specialty
  const ambulatoryConsultations = consultations.filter((c) => c.specialty_id);
  const specMap: Record<string, number> = {};
  ambulatoryConsultations.forEach((c) => {
    if (c.specialty_id) specMap[c.specialty_id] = (specMap[c.specialty_id] || 0) + 1;
  });
  const ambulatoryStats = Object.entries(specMap).map(([specId, count]) => ({
    specialty: specialties.find((s) => s.id === specId)?.name || "—",
    consultas: count,
  }));

  // Cost by professional
  const costByProfessional = Object.entries(userConsultationMap)
    .map(([userId]) => {
      const p = profiles.find((pr) => pr.user_id === userId);
      const recordings = consultations.filter((c) => c.professional_id === userId && c.audio_url).length;
      return { name: p?.full_name || "—", gravacoes: recordings, custo: (recordings * costPerRecording).toFixed(2) };
    })
    .filter((x) => x.gravacoes > 0)
    .sort((a, b) => b.gravacoes - a.gravacoes)
    .slice(0, 10);

  const chartConfig = {
    relatorios: { label: "Relatórios", color: "hsl(var(--primary))" },
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Métricas de Uso</h1>
            <p className="text-muted-foreground text-sm">Visão geral operacional e de custos</p>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="365d">Último ano</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <SummaryCard icon={Users} label="Usuários" value={totalProfiles} />
          <SummaryCard icon={Stethoscope} label="Pacientes" value={totalPatients} />
          <SummaryCard icon={FileText} label="Relatórios" value={totalReports} />
          <SummaryCard icon={Mic} label="Gravações" value={recordingsCount} />
          <SummaryCard icon={DollarSign} label="Custo Total" value={`R$ ${totalCost.toFixed(2)}`} subtitle={`R$ ${costPerRecording.toFixed(2)}/gravação`} />
        </div>

        {/* Reports chart */}
        {reportsChartData.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Relatórios por Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={reportsChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="relatorios" fill="var(--color-relatorios)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Top Users */}
        {topUsers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" /> Usuários Mais Frequentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profissional</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead className="text-right">Atendimentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topUsers.map((u, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                      <TableCell>{u.department}</TableCell>
                      <TableCell className="text-right font-semibold">{u.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* By Department */}
        {deptStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Métricas por Unidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Departamento</TableHead>
                    <TableHead className="text-right">Pacientes</TableHead>
                    <TableHead className="text-right">Atendimentos</TableHead>
                    <TableHead className="text-right">Gravações</TableHead>
                    <TableHead className="text-right">Custo (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deptStats.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-right">{d.pacientes}</TableCell>
                      <TableCell className="text-right">{d.atendimentos}</TableCell>
                      <TableCell className="text-right">{d.gravacoes}</TableCell>
                      <TableCell className="text-right">{d.custo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* By Ward */}
        {wardStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Hospital className="w-4 h-4" /> Métricas por Enfermaria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Enfermaria</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead className="text-right">Atendimentos</TableHead>
                    <TableHead className="text-right">Gravações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wardStats.map((w, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell>{w.department}</TableCell>
                      <TableCell className="text-right">{w.atendimentos}</TableCell>
                      <TableCell className="text-right">{w.gravacoes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Ambulatory by specialty */}
        {ambulatoryStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="w-4 h-4" /> Ambulatório por Especialidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Especialidade</TableHead>
                    <TableHead className="text-right">Consultas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ambulatoryStats.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{a.specialty}</TableCell>
                      <TableCell className="text-right font-semibold">{a.consultas}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Cost by professional */}
        {costByProfessional.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Custo por Profissional
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profissional</TableHead>
                    <TableHead className="text-right">Gravações</TableHead>
                    <TableHead className="text-right">Custo (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costByProfessional.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right">{c.gravacoes}</TableCell>
                      <TableCell className="text-right">{c.custo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function SummaryCard({ icon: Icon, label, value, subtitle }: { icon: React.ElementType; label: string; value: string | number; subtitle?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
            {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
