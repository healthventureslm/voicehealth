import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, PieChart, Pie, Cell,
  AreaChart, Area
} from "recharts";
import { TrendingUp, AlertTriangle, CheckCircle2, XCircle, Plus, Bell, Target, Zap, Loader2, ClipboardCheck, ListTree } from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BundleChecklist } from "@/components/indicators/BundleChecklist";
import { SubtypeDrillDown } from "@/components/indicators/SubtypeDrillDown";
import { BundleAlertPanel } from "@/components/indicators/BundleAlertPanel";

const COLORS = {
  green: "hsl(160, 84%, 39%)",
  yellow: "hsl(38, 92%, 50%)",
  red: "hsl(0, 72%, 51%)",
  primary: "hsl(199, 89%, 48%)",
  muted: "hsl(220, 10%, 46%)",
};

interface Indicator {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  calc_type: string;
  target_value: number | null;
  warning_threshold: number | null;
  critical_threshold: number | null;
  frequency: string;
  department_id: string | null;
  numerator_label: string;
  denominator_label: string;
  category: string | null;
  auto_enabled: boolean;
  auto_source: string | null;
}

interface IndicatorValue {
  id: string;
  indicator_id: string;
  department_id: string;
  period_start: string;
  period_end: string;
  numerator_value: number;
  denominator_value: number;
  calculated_value: number | null;
  source: string;
  notes: string | null;
}

interface Department {
  id: string;
  name: string;
}

function getSeverity(value: number | null, target: number | null, warning: number | null, critical: number | null): "green" | "yellow" | "red" {
  if (value == null || target == null) return "green";
  const pct = (value / target) * 100;
  if (critical != null && pct <= critical) return "red";
  if (warning != null && pct <= warning) return "yellow";
  return "green";
}

function SeverityBadge({ severity }: { severity: "green" | "yellow" | "red" }) {
  const config = {
    green: { icon: CheckCircle2, label: "No alvo", class: "bg-success/10 text-success" },
    yellow: { icon: AlertTriangle, label: "Atenção", class: "bg-warning/10 text-warning" },
    red: { icon: XCircle, label: "Crítico", class: "bg-destructive/10 text-destructive" },
  };
  const c = config[severity];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${c.class}`}>
      <c.icon className="w-3 h-3" /> {c.label}
    </span>
  );
}

export default function IndicatorsDashboard() {
  const { profile, isAdmin } = useAuth();
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [values, setValues] = useState<IndicatorValue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [selectedIndicator, setSelectedIndicator] = useState<string | null>(null);
  const [period, setPeriod] = useState("6");
  const [addValueOpen, setAddValueOpen] = useState(false);
  const [addForm, setAddForm] = useState({ indicator_id: "", numerator: "", denominator: "", period_start: "", period_end: "", notes: "" });
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillIndicator, setDrillIndicator] = useState<Indicator | null>(null);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [bundleChecklistOpen, setBundleChecklistOpen] = useState(false);
  const [subtypeDrillOpen, setSubtypeDrillOpen] = useState(false);
  const [subtypeDrillIndicator, setSubtypeDrillIndicator] = useState<any>(null);
  const [subtypeCounts, setSubtypeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [indRes, deptRes, alertRes] = await Promise.all([
      supabase.from("indicators").select("*").eq("is_active", true).order("name"),
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("indicator_alerts").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setIndicators((indRes.data as any[]) || []);
    setDepartments(deptRes.data || []);
    setAlerts((alertRes.data as any[]) || []);
    fetchValues();
    fetchSubtypeCounts((indRes.data as any[]) || []);
  };

  const fetchValues = async () => {
    const from = subMonths(new Date(), Number(period));
    const { data } = await supabase
      .from("indicator_values")
      .select("*")
      .gte("period_start", format(from, "yyyy-MM-dd"))
      .order("period_start");
    setValues((data as any[]) || []);
  };

  const fetchSubtypeCounts = async (inds: any[]) => {
    const counts: Record<string, number> = {};
    for (const ind of inds) {
      const { count } = await supabase
        .from("indicator_subtypes")
        .select("id", { count: "exact", head: true })
        .eq("indicator_id", ind.id);
      if (count && count > 0) counts[ind.id] = count;
    }
    setSubtypeCounts(counts);
  };

  useEffect(() => { fetchValues(); }, [period]);

  const filteredValues = useMemo(() => {
    let v = values;
    if (selectedDept !== "all") v = v.filter((val) => val.department_id === selectedDept);
    if (selectedIndicator) v = v.filter((val) => val.indicator_id === selectedIndicator);
    return v;
  }, [values, selectedDept, selectedIndicator]);

  const latestByIndicator = useMemo(() => {
    const map: Record<string, IndicatorValue> = {};
    const deptId = selectedDept !== "all" ? selectedDept : profile?.department_id;
    for (const v of values) {
      if (deptId && v.department_id !== deptId) continue;
      if (!map[v.indicator_id] || v.period_start > map[v.indicator_id].period_start) {
        map[v.indicator_id] = v;
      }
    }
    return map;
  }, [values, selectedDept, profile]);

  const sparklineByIndicator = useMemo(() => {
    const map: Record<string, { value: number }[]> = {};
    const deptId = selectedDept !== "all" ? selectedDept : profile?.department_id;
    for (const v of values) {
      if (deptId && v.department_id !== deptId) continue;
      if (v.calculated_value == null) continue;
      if (!map[v.indicator_id]) map[v.indicator_id] = [];
      map[v.indicator_id].push({ value: v.calculated_value });
    }
    // Sort by insertion order (values are already sorted by period_start)
    return map;
  }, [values, selectedDept, profile]);

  const chartData = useMemo(() => {
    if (!selectedIndicator) return [];
    const grouped: Record<string, any> = {};
    for (const v of filteredValues) {
      if (v.indicator_id !== selectedIndicator) continue;
      const key = v.period_start;
      if (!grouped[key]) grouped[key] = { period: format(new Date(v.period_start), "MMM/yy", { locale: ptBR }) };
      const dept = departments.find((d) => d.id === v.department_id);
      grouped[key][dept?.name || "Valor"] = v.calculated_value;
    }
    return Object.values(grouped);
  }, [filteredValues, selectedIndicator, departments]);

  const severityDistribution = useMemo(() => {
    let green = 0, yellow = 0, red = 0;
    for (const ind of indicators) {
      const latest = latestByIndicator[ind.id];
      const sev = getSeverity(latest?.calculated_value ?? null, ind.target_value, ind.warning_threshold, ind.critical_threshold);
      if (sev === "green") green++;
      else if (sev === "yellow") yellow++;
      else red++;
    }
    return [
      { name: "No alvo", value: green, color: COLORS.green },
      { name: "Atenção", value: yellow, color: COLORS.yellow },
      { name: "Crítico", value: red, color: COLORS.red },
    ].filter((d) => d.value > 0);
  }, [indicators, latestByIndicator]);

  const calculateValue = (num: number, den: number, calcType: string): number => {
    if (calcType === "absolute") return num;
    if (den === 0) return 0;
    if (calcType === "percentage") return Math.round((num / den) * 10000) / 100;
    return Math.round((num / den) * 100) / 100;
  };

  const handleAddValue = async () => {
    const ind = indicators.find((i) => i.id === addForm.indicator_id);
    if (!ind || !addForm.period_start || !addForm.period_end) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const num = Number(addForm.numerator) || 0;
    const den = Number(addForm.denominator) || 0;
    const calc = calculateValue(num, den, ind.calc_type);

    const { data: insertedValue, error } = await supabase.from("indicator_values").insert({
      indicator_id: ind.id,
      department_id: profile?.department_id!,
      period_start: addForm.period_start,
      period_end: addForm.period_end,
      numerator_value: num,
      denominator_value: den,
      calculated_value: calc,
      source: "manual",
      notes: addForm.notes || null,
      recorded_by: profile?.user_id,
    }).select("id").single();

    if (error) {
      toast.error(error.message.includes("duplicate") ? "Já existe valor para este período" : "Erro ao salvar");
      return;
    }

    if (insertedValue) {
      supabase.functions.invoke("check-indicator-alert", {
        body: { indicator_value_id: insertedValue.id },
      }).catch(() => {});
    }

    toast.success("Valor registrado com sucesso");
    setAddValueOpen(false);
    setAddForm({ indicator_id: "", numerator: "", denominator: "", period_start: "", period_end: "", notes: "" });
    fetchAll();
  };

  const openDrillDown = (ind: Indicator) => {
    // If indicator has subtypes, open subtype drill-down
    if (subtypeCounts[ind.id]) {
      setSubtypeDrillIndicator(ind);
      setSubtypeDrillOpen(true);
    } else {
      setDrillIndicator(ind);
      setSelectedIndicator(ind.id);
      setDrillDownOpen(true);
    }
  };

  const handleCollectNow = async (ind: Indicator, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile?.department_id) {
      toast.error("Departamento não configurado");
      return;
    }
    setCollectingId(ind.id);
    try {
      const { data, error } = await supabase.functions.invoke("collect-indicator-data", {
        body: { indicator_id: ind.id, department_id: profile.department_id },
      });
      if (error) throw error;
      toast.success(`Coletado: ${data.calculated_value}${ind.unit} (N=${data.numerator}, D=${data.denominator})`);
      fetchAll();
    } catch (err: any) {
      toast.error("Erro na coleta: " + (err.message || "Tente novamente"));
    } finally {
      setCollectingId(null);
    }
  };

  const drillDownData = useMemo(() => {
    if (!drillIndicator) return [];
    return values
      .filter((v) => v.indicator_id === drillIndicator.id)
      .sort((a, b) => b.period_start.localeCompare(a.period_start));
  }, [drillIndicator, values]);

  const unreadAlerts = alerts.filter((a) => !a.is_read);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-primary" />
              Dashboard de Indicadores
            </h1>
            <p className="text-muted-foreground mt-1">Monitore indicadores com drill-down até o paciente</p>
          </div>
          <div className="flex gap-2">
            {unreadAlerts.length > 0 && (
              <Badge variant="destructive" className="gap-1 py-1">
                <Bell className="w-3 h-3" /> {unreadAlerts.length} alertas
              </Badge>
            )}
            <Button onClick={() => setBundleChecklistOpen(true)} variant="outline" className="gap-2">
              <ClipboardCheck className="w-4 h-4" /> Registrar Evento
            </Button>
            <Button onClick={() => setAddValueOpen(true)} className="gap-2 gradient-primary text-white border-0">
              <Plus className="w-4 h-4" /> Registrar Valor
            </Button>
          </div>
        </div>

        {/* Bundle Alerts */}
        <BundleAlertPanel />

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="w-48">
            <Label className="text-xs">Departamento</Label>
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Label className="text-xs">Indicador</Label>
            <Select value={selectedIndicator || "all"} onValueChange={(v) => setSelectedIndicator(v === "all" ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {indicators.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-36">
            <Label className="text-xs">Período</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 meses</SelectItem>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Severity Overview + Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {indicators.map((ind) => {
                const latest = latestByIndicator[ind.id];
                const severity = getSeverity(latest?.calculated_value ?? null, ind.target_value, ind.warning_threshold, ind.critical_threshold);
                const hasSubtypes = !!subtypeCounts[ind.id];
                return (
                  <Card
                    key={ind.id}
                    className={`glass-card cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
                      severity === "green" ? "border-l-success" : severity === "yellow" ? "border-l-warning" : "border-l-destructive"
                    }`}
                    onClick={() => openDrillDown(ind)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-medium text-sm truncate flex-1">{ind.name}</p>
                        <SeverityBadge severity={severity} />
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <p className="text-2xl font-bold">
                          {latest?.calculated_value != null ? `${latest.calculated_value}${ind.unit}` : "—"}
                        </p>
                        {(sparklineByIndicator[ind.id]?.length ?? 0) >= 2 && (
                          <div className="w-20 h-10 flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={sparklineByIndicator[ind.id]} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                                <defs>
                                  <linearGradient id={`spark-${ind.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={severity === "green" ? COLORS.green : severity === "yellow" ? COLORS.yellow : COLORS.red} stopOpacity={0.4} />
                                    <stop offset="100%" stopColor={severity === "green" ? COLORS.green : severity === "yellow" ? COLORS.yellow : COLORS.red} stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <Area
                                  type="monotone"
                                  dataKey="value"
                                  stroke={severity === "green" ? COLORS.green : severity === "yellow" ? COLORS.yellow : COLORS.red}
                                  fill={`url(#spark-${ind.id})`}
                                  strokeWidth={1.5}
                                  dot={false}
                                  isAnimationActive={false}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {ind.target_value != null && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Target className="w-3 h-3" /> Meta: {ind.target_value}{ind.unit}
                          </p>
                        )}
                        {hasSubtypes && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <ListTree className="w-2.5 h-2.5" /> {subtypeCounts[ind.id]} subtipos
                          </Badge>
                        )}
                      </div>
                      {ind.auto_enabled && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7 text-xs gap-1"
                          disabled={collectingId === ind.id}
                          onClick={(e) => handleCollectNow(ind, e)}
                        >
                          {collectingId === ind.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Zap className="w-3 h-3" />
                          )}
                          Coletar Agora
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
          {severityDistribution.length > 0 && (
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribuição</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={severityDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                      {severityDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Chart */}
        {selectedIndicator && chartData.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">
                Evolução: {indicators.find((i) => i.id === selectedIndicator)?.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip />
                  <Legend />
                  {(() => {
                    const ind = indicators.find((i) => i.id === selectedIndicator);
                    return ind?.target_value != null ? (
                      <ReferenceLine y={ind.target_value} stroke={COLORS.green} strokeDasharray="5 5" label="Meta" />
                    ) : null;
                  })()}
                  {departments.map((d, i) => (
                    <Line
                      key={d.id}
                      type="monotone"
                      dataKey={d.name}
                      stroke={i === 0 ? COLORS.primary : i === 1 ? COLORS.green : COLORS.yellow}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Recent Alerts */}
        {alerts.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4" /> Alertas de Indicadores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alerts.slice(0, 10).map((a) => (
                  <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg ${a.is_read ? "bg-muted/30" : "bg-muted/60"}`}>
                    <div className="flex items-center gap-3">
                      <SeverityBadge severity={a.severity} />
                      <span className="text-sm">{a.message}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(a.created_at), "dd/MM HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Value Dialog */}
        <Dialog open={addValueOpen} onOpenChange={setAddValueOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Valor de Indicador</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Indicador *</Label>
                <Select value={addForm.indicator_id} onValueChange={(v) => setAddForm({ ...addForm, indicator_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {indicators.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {addForm.indicator_id && (() => {
                const ind = indicators.find((i) => i.id === addForm.indicator_id);
                if (!ind) return null;
                return (
                  <>
                    <div>
                      <Label>{ind.numerator_label} *</Label>
                      <Input type="number" value={addForm.numerator} onChange={(e) => setAddForm({ ...addForm, numerator: e.target.value })} />
                    </div>
                    {ind.calc_type !== "absolute" && (
                      <div>
                        <Label>{ind.denominator_label} *</Label>
                        <Input type="number" value={addForm.denominator} onChange={(e) => setAddForm({ ...addForm, denominator: e.target.value })} />
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Início do Período *</Label>
                  <Input type="date" value={addForm.period_start} onChange={(e) => setAddForm({ ...addForm, period_start: e.target.value })} />
                </div>
                <div>
                  <Label>Fim do Período *</Label>
                  <Input type="date" value={addForm.period_end} onChange={(e) => setAddForm({ ...addForm, period_end: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Input value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} />
              </div>
              <Button onClick={handleAddValue} className="w-full gradient-primary text-white border-0">
                Registrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Legacy Drill-down Dialog */}
        <Dialog open={drillDownOpen} onOpenChange={(v) => { setDrillDownOpen(v); if (!v) setDrillIndicator(null); }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Drill-down: {drillIndicator?.name}</DialogTitle>
            </DialogHeader>
            {drillIndicator && (
              <div className="space-y-4 mt-2">
                <p className="text-sm text-muted-foreground">{drillIndicator.description}</p>
                {(() => {
                  const byDept: Record<string, { name: string; value: number }> = {};
                  for (const v of values.filter((val) => val.indicator_id === drillIndicator.id)) {
                    const dept = departments.find((d) => d.id === v.department_id);
                    if (!byDept[v.department_id] || v.period_start > (byDept[v.department_id] as any).date) {
                      byDept[v.department_id] = { name: dept?.name || "—", value: v.calculated_value || 0, ...(v as any) };
                    }
                  }
                  const data = Object.values(byDept);
                  if (data.length === 0) return <p className="text-center text-muted-foreground py-4">Sem dados</p>;
                  return (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="value" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                        {drillIndicator.target_value != null && (
                          <ReferenceLine y={drillIndicator.target_value} stroke={COLORS.green} strokeDasharray="5 5" label="Meta" />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>{drillIndicator.numerator_label}</TableHead>
                      {drillIndicator.calc_type !== "absolute" && <TableHead>{drillIndicator.denominator_label}</TableHead>}
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillDownData.map((v) => {
                      const dept = departments.find((d) => d.id === v.department_id);
                      const severity = getSeverity(v.calculated_value, drillIndicator.target_value, drillIndicator.warning_threshold, drillIndicator.critical_threshold);
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="text-sm">{format(new Date(v.period_start), "dd/MM/yyyy")} – {format(new Date(v.period_end), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{dept?.name || "—"}</TableCell>
                          <TableCell>{v.numerator_value}</TableCell>
                          {drillIndicator.calc_type !== "absolute" && <TableCell>{v.denominator_value}</TableCell>}
                          <TableCell className="font-medium">{v.calculated_value}{drillIndicator.unit}</TableCell>
                          <TableCell><SeverityBadge severity={severity} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Bundle Checklist Dialog */}
        <BundleChecklist open={bundleChecklistOpen} onOpenChange={setBundleChecklistOpen} onSaved={fetchAll} />

        {/* Subtype Drill-down Dialog */}
        <SubtypeDrillDown open={subtypeDrillOpen} onOpenChange={setSubtypeDrillOpen} indicator={subtypeDrillIndicator} />
      </div>
    </AppLayout>
  );
}
