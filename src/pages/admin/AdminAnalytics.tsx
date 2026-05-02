import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useHospitalAnalytics } from "@/hooks/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Activity, Users, Building2, ClipboardList, BarChart3 } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  recording: "Gravando",
  transcribing: "Transcrevendo",
  transcribed: "Transcrita",
  editing: "Editando",
  completed: "Concluída",
};

const WARD_TYPE_LABEL: Record<string, string> = {
  uti: "UTI",
  enfermaria: "Enfermaria",
  centro_cirurgico: "Centro Cirúrgico",
  pronto_socorro: "Pronto-Socorro",
  ambulatorio: "Ambulatório",
};

export default function AdminAnalytics() {
  const { hospitalIds } = useAuth();
  const hospitalId = hospitalIds[0];
  const [periodDays, setPeriodDays] = useState<number>(30);
  const { data, isLoading } = useHospitalAnalytics(hospitalId, periodDays);

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          icon={<BarChart3 className="w-6 h-6" />}
          title="Métricas de uso"
          subtitle="Acompanhe atividade clínica e adoção do sistema."
          actions={
            <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          }
        />

        {isLoading || !data ? (
          <EmptyState loading />
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Kpi icon={<Activity className="w-4 h-4" />} label="Atendimentos" value={data.totals.consultations} hint={`em ${periodDays} dias`} />
              <Kpi icon={<Users className="w-4 h-4" />} label="Usuários" value={data.totals.users} hint="vinculados ao hospital" />
              <Kpi icon={<ClipboardList className="w-4 h-4" />} label="Pacientes" value={data.totals.patients} hint="ativos" />
              <Kpi icon={<Building2 className="w-4 h-4" />} label="Setores" value={data.totals.wards} hint="ativos" />
            </div>

            {/* Gráfico de atendimentos por dia */}
            <Card className="hv-card">
              <CardHeader>
                <CardTitle className="heading-section">Atendimentos por dia</CardTitle>
                <CardDescription>
                  Distribuição diária no período selecionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.totals.consultations === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    Nenhum atendimento registrado no período.
                  </p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.series}>
                        <defs>
                          <linearGradient id="vh-area" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgb(255 255 255 / 0.06)" />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                          }
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 10 }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid rgb(255 255 255 / 0.06)",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          labelFormatter={(v) =>
                            new Date(v).toLocaleDateString("pt-BR", {
                              day: "2-digit", month: "long",
                            })
                          }
                          formatter={(val: number) => [`${val} atendimento${val !== 1 ? "s" : ""}`, ""]}
                        />
                        <Area
                          type="monotone"
                          dataKey="consultations"
                          stroke="hsl(var(--primary))"
                          fill="url(#vh-area)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Distribuição por setor + Top profissionais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="hv-card">
                <CardHeader>
                  <CardTitle className="heading-section">Por setor</CardTitle>
                  <CardDescription>Volume de atendimentos por ward</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.byWard.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Nenhum setor cadastrado.
                    </p>
                  ) : (
                    [...data.byWard]
                      .sort((a, b) => b.count - a.count)
                      .map((w) => (
                        <div key={w.ward_id} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="truncate">{w.name}</span>
                            <span className="text-muted-foreground tabular-nums">{w.count}</span>
                          </div>
                          <BarRow value={w.count} max={Math.max(...data.byWard.map((x) => x.count), 1)} />
                          <p className="text-xs text-muted-foreground">
                            {WARD_TYPE_LABEL[w.ward_type] ?? w.ward_type}
                          </p>
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>

              <Card className="hv-card">
                <CardHeader>
                  <CardTitle className="heading-section">Top profissionais</CardTitle>
                  <CardDescription>Quem mais registrou atendimentos no período</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.topProfessionals.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Sem atividade no período.
                    </p>
                  ) : (
                    data.topProfessionals.map((p, i) => (
                      <div key={p.user_id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="hv-eyebrow text-primary tabular-nums">
                            #{(i + 1).toString().padStart(2, "0")}
                          </span>
                          <span className="text-sm truncate">{p.full_name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {p.count}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Status distribution */}
            <Card className="hv-card">
              <CardHeader>
                <CardTitle className="heading-section">Por status</CardTitle>
                <CardDescription>Estado das consultas registradas</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {Object.keys(data.statusCounts).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Sem atendimentos no período.
                  </p>
                ) : (
                  Object.entries(data.statusCounts).map(([status, count]) => (
                    <Badge key={status} variant="outline" className="gap-1">
                      <span>{STATUS_LABEL[status] ?? status}</span>
                      <span className="text-muted-foreground">· {count}</span>
                    </Badge>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </PageContainer>
    </AppLayout>
  );
}

function Kpi({
  icon, label, value, hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card className="hv-card">
      <CardHeader className="pb-2">
        <CardDescription className="hv-eyebrow flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hv-stat">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function BarRow({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full bg-primary transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
