import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Users, ClipboardList, Activity, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDashboardStats, useRecentConsultations, useDepartments } from "@/hooks/queries";

import hospitalIcu from "@/assets/hospital-icu.jpg";
import hospitalEmergency from "@/assets/hospital-emergency.jpg";
import hospitalWard from "@/assets/hospital-ward.jpg";
import hospitalClinic from "@/assets/hospital-clinic.jpg";

const departmentImages: Record<string, string> = {
  UTI: hospitalIcu,
  Emergência: hospitalEmergency,
  Enfermaria: hospitalWard,
  Ambulatório: hospitalClinic,
};

export default function Dashboard() {
  const { user, profile, roles } = useAuth();
  const navigate = useNavigate();
  const hasDept = !!profile?.department_id;
  const { data: stats, isLoading: loadingStats } = useDashboardStats(hasDept);
  const { data: recentConsultations = [] } = useRecentConsultations(hasDept);
  const { data: departments = [] } = useDepartments();
  const loading = loadingStats;

  const roleLabel: Record<string, string> = {
    admin: "Administrador",
    medico: "Médico(a)",
    enfermeiro: "Enfermeiro(a)",
    tecnico: "Técnico(a)",
    farmaceutico: "Farmacêutico(a)",
  };

  const statusLabel: Record<string, string> = {
    recording: "Gravando",
    transcribing: "Transcrevendo",
    transcribed: "Transcrito",
    editing: "Editando",
    completed: "Concluído",
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Olá, {profile?.full_name?.split(" ")[0] || "Profissional"} 👋
            </h1>
            <p className="text-muted-foreground text-sm md:text-base mt-1">
              {roles.map((r) => roleLabel[r] || r).join(", ")} •{" "}
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <Button
            onClick={() => navigate("/consultations/new")}
            className="gap-2 h-11 md:h-12 px-5 md:px-6 rounded-xl gradient-primary border-0 text-white shadow-lg hover:opacity-90 transition-opacity w-full md:w-auto md:self-start"
          >
            <Mic className="w-5 h-5" />
            Nova Gravação
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <Card className="glass-card">
            <CardContent className="p-3 md:p-6 flex flex-col md:flex-row items-center gap-2 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <div className="text-center md:text-left">
                {loading ? <Skeleton className="h-7 w-12" /> : <p className="text-xl md:text-2xl font-bold tabular-nums">{stats?.patients ?? 0}</p>}
                <p className="text-xs md:text-sm text-muted-foreground">Pacientes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-3 md:p-6 flex flex-col md:flex-row items-center gap-2 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 md:w-6 md:h-6 text-secondary" />
              </div>
              <div className="text-center md:text-left">
                {loading ? <Skeleton className="h-7 w-12" /> : <p className="text-xl md:text-2xl font-bold">{stats?.consultations ?? 0}</p>}
                <p className="text-xs md:text-sm text-muted-foreground">Atendimentos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-3 md:p-6 flex flex-col md:flex-row items-center gap-2 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Activity className="w-5 h-5 md:w-6 md:h-6 text-warning" />
              </div>
              <div className="text-center md:text-left">
                {loading ? <Skeleton className="h-7 w-12" /> : <p className="text-xl md:text-2xl font-bold">{stats?.todayConsultations ?? 0}</p>}
                <p className="text-xs md:text-sm text-muted-foreground">Hoje</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Hospital Rooms */}
        <div>
          <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Setores Hospitalares</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {departments.map((dept) => {
              const img = departmentImages[dept.name] || hospitalClinic;
              return (
                <Card key={dept.id} role="link" tabIndex={0} className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/patients?department=${dept.id}&department_name=${encodeURIComponent(dept.name)}`)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/patients?department=${dept.id}&department_name=${encodeURIComponent(dept.name)}`); } }}>
                  <div className="relative h-36 overflow-hidden">
                    <img
                      src={img}
                      alt={`Setor ${dept.name}`}
                      loading="lazy"
                      width={640}
                      height={512}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 left-3">
                      <p className="text-white font-semibold text-sm">{dept.name}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Recent */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Últimos Atendimentos</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/consultations")}>
              Ver todos
            </Button>
          </CardHeader>
          <CardContent>
            {recentConsultations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Nenhum atendimento ainda</p>
                <Button
                  variant="outline"
                  className="mt-4 gap-2"
                  onClick={() => navigate("/consultations/new")}
                >
                  <Plus className="w-4 h-4" /> Iniciar primeiro atendimento
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentConsultations.map((c) => (
                  <div
                    key={c.id}
                    role="link"
                    tabIndex={0}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/consultations/${c.id}/edit`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/consultations/${c.id}/edit`); } }}
                  >
                    <div>
                      <p className="font-medium">{c.patients?.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Leito {c.patients?.bed || "—"} • {format(new Date(c.created_at), "dd/MM HH:mm")}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      c.status === "completed" ? "bg-success/10 text-success" :
                      c.status === "transcribed" ? "bg-primary/10 text-primary" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {statusLabel[c.status] || c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
