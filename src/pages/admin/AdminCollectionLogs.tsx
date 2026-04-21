import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, Timer, Save } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface CollectionLog {
  id: string;
  batch_id: string;
  indicator_name: string;
  department_name: string;
  status: string;
  numerator: number | null;
  denominator: number | null;
  calculated_value: number | null;
  error_message: string | null;
  created_at: string;
}

interface BatchGroup {
  batch_id: string;
  created_at: string;
  total: number;
  success: number;
  errors: number;
  logs: CollectionLog[];
}

const SCHEDULE_OPTIONS = [
  { value: "0 0 * * *", label: "Meia-noite (00:00 UTC)" },
  { value: "0 3 * * *", label: "03:00 UTC" },
  { value: "0 6 * * *", label: "06:00 UTC" },
  { value: "0 9 * * *", label: "09:00 UTC" },
  { value: "0 12 * * *", label: "12:00 UTC" },
  { value: "0 15 * * *", label: "15:00 UTC" },
  { value: "0 18 * * *", label: "18:00 UTC" },
  { value: "0 21 * * *", label: "21:00 UTC" },
  { value: "0 */6 * * *", label: "A cada 6 horas" },
  { value: "0 */8 * * *", label: "A cada 8 horas" },
  { value: "0 */12 * * *", label: "A cada 12 horas" },
];

export default function AdminCollectionLogs() {
  const [days, setDays] = useState("7");
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const since = new Date();
  since.setDate(since.getDate() - parseInt(days));

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["collection-logs", days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_logs")
        .select("*")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as CollectionLog[];
    },
  });

  const { data: cronSetting } = useQuery({
    queryKey: ["cron-schedule-setting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "cron_schedule")
        .single();
      if (error) throw error;
      return data?.value || "0 6 * * *";
    },
  });

  const currentSchedule = selectedSchedule ?? cronSetting ?? "0 6 * * *";
  const hasChanges = selectedSchedule !== null && selectedSchedule !== cronSetting;

  const updateSchedule = useMutation({
    mutationFn: async (schedule: string) => {
      const { data, error } = await supabase.functions.invoke("update-cron-schedule", {
        body: { schedule },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Horário atualizado", description: "O agendamento da coleta automática foi alterado com sucesso." });
      setSelectedSchedule(null);
      queryClient.invalidateQueries({ queryKey: ["cron-schedule-setting"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });

  const batches: BatchGroup[] = (() => {
    if (!logs) return [];
    const map = new Map<string, CollectionLog[]>();
    for (const log of logs) {
      const arr = map.get(log.batch_id) || [];
      arr.push(log);
      map.set(log.batch_id, arr);
    }
    return Array.from(map.entries())
      .map(([batch_id, items]) => ({
        batch_id,
        created_at: items[0].created_at,
        total: items.length,
        success: items.filter((l) => l.status === "success").length,
        errors: items.filter((l) => l.status === "error").length,
        logs: items,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  })();

  const totalRuns = batches.length;
  const totalCollected = logs?.filter((l) => l.status === "success").length || 0;
  const totalErrors = logs?.filter((l) => l.status === "error").length || 0;
  const currentLabel = SCHEDULE_OPTIONS.find((o) => o.value === currentSchedule)?.label || currentSchedule;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Logs de Coleta Automática</h1>
            <p className="text-muted-foreground">Histórico e configuração da coleta automática de indicadores</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Últimas 24h</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Schedule Config Card */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Agendamento da Coleta</CardTitle>
            </div>
            <CardDescription>
              Configure o horário em que a coleta automática de indicadores será executada diariamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Select value={currentSchedule} onValueChange={setSelectedSchedule}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecione o horário..." />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => updateSchedule.mutate(currentSchedule)}
                disabled={!hasChanges || updateSchedule.isPending}
                className="gap-2"
              >
                {updateSchedule.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar
              </Button>
              {!hasChanges && cronSetting && (
                <span className="text-sm text-muted-foreground">
                  Atual: <strong>{currentLabel}</strong>
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Execuções</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold">{totalRuns}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Coletas com Sucesso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold">{totalCollected}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Erros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" />
                <span className="text-2xl font-bold">{totalErrors}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : batches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum log de coleta encontrado no período selecionado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Sucesso</TableHead>
                    <TableHead>Erros</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <>
                      <TableRow
                        key={batch.batch_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedBatch(expandedBatch === batch.batch_id ? null : batch.batch_id)}
                      >
                        <TableCell>
                          {expandedBatch === batch.batch_id ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {format(new Date(batch.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{batch.total}</TableCell>
                        <TableCell>{batch.success}</TableCell>
                        <TableCell className="text-destructive">{batch.errors}</TableCell>
                        <TableCell>
                          {batch.errors === 0 ? (
                            <Badge variant="default">OK</Badge>
                          ) : batch.errors === batch.total ? (
                            <Badge variant="destructive">Falha Total</Badge>
                          ) : (
                            <Badge variant="secondary">Parcial</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedBatch === batch.batch_id && batch.logs.map((log) => (
                        <TableRow key={log.id} className="bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell className="text-sm">{log.indicator_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{log.department_name}</TableCell>
                          <TableCell colSpan={2} className="text-sm">
                            {log.status === "success" ? (
                              <span>N={log.numerator} D={log.denominator} V={log.calculated_value}</span>
                            ) : (
                              <span className="text-destructive text-xs">{log.error_message}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {log.status === "success" ? (
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                            ) : (
                              <XCircle className="w-4 h-4 text-destructive" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
