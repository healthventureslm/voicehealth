import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
  useDashboardStats,
  usePatients,
  useConsultations,
} from "@/hooks/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic, Users, ClipboardList, FileText, ArrowRight, Activity, UserCircle2,
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, wardIds, roles, isSuperAdmin } = useAuth();
  const { data: stats, isLoading: loadingStats } = useDashboardStats();
  const { data: patients } = usePatients();
  const { data: myRecent } = useConsultations({ mineOnly: true });

  const firstName = profile?.full_name?.split(" ")[0] ?? "—";
  const isHospitalAdmin = roles.some((r) => r.role === "hospital_admin");

  // Mostra apenas pacientes nos setores ATUAIS do usuário.
  // Pacientes transferidos pra fora dos meus setores (que ainda são visíveis
  // via consultas próprias) ficam acessíveis em /gravacoes, não aqui.
  const myActivePatients = (patients ?? []).filter((p) => {
    if (isSuperAdmin || isHospitalAdmin) return true;
    return !!p.current_ward_id && wardIds.includes(p.current_ward_id);
  });
  const recentPatients = myActivePatients.slice(0, 6);
  const recentConsultations = (myRecent ?? []).slice(0, 5);

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          eyebrow="Hoje"
          title={`Olá, ${firstName}`}
          actions={
            <Button onClick={() => navigate("/consultations/new")} className="gap-2">
              <Mic className="w-4 h-4" /> Nova gravação
            </Button>
          }
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="w-4 h-4" />}
            label="Pacientes"
            value={loadingStats ? "—" : stats?.patients ?? 0}
            hint="visíveis pra você"
          />
          <StatCard
            icon={<Activity className="w-4 h-4" />}
            label="Gravações hoje"
            value={loadingStats ? "—" : stats?.todayConsultations ?? 0}
            hint="no hospital"
          />
          <StatCard
            icon={<ClipboardList className="w-4 h-4" />}
            label="Meus rascunhos"
            value={loadingStats ? "—" : stats?.myInProgress ?? 0}
            hint="não-finalizados"
          />
          <StatCard
            icon={<FileText className="w-4 h-4" />}
            label="Minhas gravações"
            value={loadingStats ? "—" : stats?.myCompleted ?? 0}
            hint="finalizadas"
          />
        </div>

        {/* 2 colunas: pacientes + minhas gravações */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pacientes */}
          <Card className="hv-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="heading-section">Pacientes</CardTitle>
                <CardDescription>
                  Nos seus setores ativos
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/patients")} className="gap-1">
                Ver todos <ArrowRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {recentPatients.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum paciente cadastrado.{" "}
                  <button
                    onClick={() => navigate("/patients")}
                    className="underline hover:text-foreground"
                  >
                    Cadastrar
                  </button>
                </p>
              ) : (
                recentPatients.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/patients/${p.id}/history`)}
                    className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent/30 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{p.full_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.medical_record && `Prontuário ${p.medical_record} · `}
                          {p.bed && `Leito ${p.bed} · `}
                          {p.current_ward?.name ?? "—"}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Minhas gravações recentes */}
          <Card className="hv-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="heading-section">Minhas gravações</CardTitle>
                <CardDescription>Últimas que você registrou</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/consultations")} className="gap-1">
                Ver todas <ArrowRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {recentConsultations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Você ainda não registrou nenhuma gravação.
                </p>
              ) : (
                recentConsultations.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/consultations/${c.id}/report`)}
                    className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent/30 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {c.patient?.full_name ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.ward?.name ? `${c.ward.name} · ` : ""}
                        {new Date(c.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">
                      {c.status}
                    </Badge>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </AppLayout>
  );
}

function StatCard({
  icon, label, value, hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
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
        {hint && (
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
