import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useConsultations } from "@/hooks/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Mic, Lock, Search } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  recording: "Gravando",
  transcribing: "Transcrevendo",
  transcribed: "Transcrita",
  editing: "Editando",
  completed: "Concluída",
};

export default function Consultations() {
  const navigate = useNavigate();
  const { data: consultations, isLoading } = useConsultations();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const cutoff =
      periodFilter === "today"
        ? now - day
        : periodFilter === "week"
          ? now - 7 * day
          : periodFilter === "month"
            ? now - 30 * day
            : null;

    return (consultations ?? []).filter((c: any) => {
      const matchesSearch =
        !search ||
        [c.patient?.full_name, c.patient?.medical_record, c.ward?.name]
          .filter(Boolean)
          .some((v: string) => v.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const matchesPeriod =
        cutoff === null || new Date(c.created_at).getTime() >= cutoff;
      return matchesSearch && matchesStatus && matchesPeriod;
    });
  }, [consultations, search, statusFilter, periodFilter]);

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Atendimentos"
          actions={
            <Button onClick={() => navigate("/consultations/new")} className="gap-2">
              <Mic className="w-4 h-4" /> Novo atendimento
            </Button>
          }
        />

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por paciente, prontuário, setor..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os períodos</SelectItem>
              <SelectItem value="today">Últimas 24h</SelectItem>
              <SelectItem value="week">Últimos 7 dias</SelectItem>
              <SelectItem value="month">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando…</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              {(consultations ?? []).length === 0
                ? "Nenhum atendimento registrado ainda."
                : "Nenhum atendimento corresponde aos filtros."}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {filtered.length} atendimento{filtered.length !== 1 && "s"}
            </p>
            {filtered.map((c: any) => (
              <Card
                key={c.id}
                className="cursor-pointer hover:border-primary/50"
                onClick={() => navigate(`/consultations/${c.id}/report`)}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.patient?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.ward?.name ? `${c.ward.name} · ` : ""}
                      {new Date(c.created_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", year: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.locked_at && (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="w-3 h-3" /> Bloqueada
                      </Badge>
                    )}
                    <Badge variant="outline">{STATUS_LABELS[c.status] ?? c.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
