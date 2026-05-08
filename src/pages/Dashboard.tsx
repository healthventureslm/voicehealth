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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GradientAvatar } from "@/components/GradientAvatar";
import { WardChip } from "@/components/WardChip";
import {
  Mic, Users, ClipboardList, FileText, ArrowRight, Activity,
} from "lucide-react";

const WEEKDAYS = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
const MONTHS = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function formatToday(now = new Date()): string {
  const wd = WEEKDAYS[now.getDay()];
  return `Hoje · ${wd.charAt(0).toUpperCase() + wd.slice(1)}, ${now.getDate()} de ${MONTHS[now.getMonth()]}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, wardIds, roles, isSuperAdmin } = useAuth();
  const { data: stats, isLoading: loadingStats } = useDashboardStats();
  const { data: patients } = usePatients();
  const { data: myRecent } = useConsultations({ mineOnly: true });

  const firstName = profile?.full_name?.split(" ")[0] ?? "—";
  const isHospitalAdmin = roles.some((r) => r.role === "hospital_admin");

  // Mostra apenas pacientes nos setores ATUAIS do usuário.
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
          variant="greeting"
          eyebrow={formatToday()}
          title={`Olá, ${firstName}`}
          actions={
            <Button
              onClick={() => navigate("/consultations/new")}
              className="gap-2 bg-enf hover:bg-enf-hover text-white shadow-sm font-semibold"
            >
              <span className="pulse-dot" aria-hidden="true" />
              Nova gravação
            </Button>
          }
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between pb-3 gap-3 border-b">
              <div className="min-w-0">
                <h2 className="heading-card">Pacientes</h2>
                <p
                  className="text-[12px] mt-[2px]"
                  style={{ color: "var(--text-soft)" }}
                >
                  Nos seus setores ativos
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/patients")}
                className="gap-1 text-enf-deep hover:text-enf-deep hover:bg-enf-soft font-medium"
              >
                Ver todos <ArrowRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-1.5">
              {recentPatients.length === 0 ? (
                <p
                  className="text-sm py-6 text-center"
                  style={{ color: "var(--text-soft)" }}
                >
                  Nenhum paciente cadastrado.{" "}
                  <button
                    onClick={() => navigate("/patients")}
                    className="underline hover:text-foreground text-enf-deep"
                  >
                    Cadastrar
                  </button>
                </p>
              ) : (
                recentPatients.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/patients/${p.id}/history`)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--bg-card-hov)] text-left transition-colors"
                  >
                    <GradientAvatar name={p.full_name} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium truncate">
                        {p.full_name}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {p.medical_record && (
                          <span
                            className="text-[12px]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            PRT {p.medical_record}
                          </span>
                        )}
                        {p.bed && (
                          <>
                            <span style={{ color: "var(--text-muted)" }}>·</span>
                            <span
                              className="text-[12px]"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Leito {p.bed}
                            </span>
                          </>
                        )}
                        {p.current_ward?.type && (
                          <WardChip type={p.current_ward.type} label={p.current_ward.name ?? undefined} />
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Minhas gravações recentes */}
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between pb-3 gap-3 border-b">
              <div className="min-w-0">
                <h2 className="heading-card">Minhas gravações</h2>
                <p
                  className="text-[12px] mt-[2px]"
                  style={{ color: "var(--text-soft)" }}
                >
                  Últimas que você registrou
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/consultations")}
                className="gap-1 text-enf-deep hover:text-enf-deep hover:bg-enf-soft font-medium"
              >
                Ver todas <ArrowRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-1.5">
              {recentConsultations.length === 0 ? (
                <EmptyRecordings onClick={() => navigate("/consultations/new")} />
              ) : (
                recentConsultations.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/consultations/${c.id}/report`)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[var(--bg-card-hov)] text-left transition-colors gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium truncate">
                        {c.patient?.full_name ?? "—"}
                      </div>
                      <div
                        className="text-[12px] mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {c.ward?.name ? `${c.ward.name} · ` : ""}
                        {new Date(c.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[11px] flex-shrink-0 font-medium"
                    >
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
    <Card className="transition-all hover:shadow-md hover:border-[var(--border-hov)]">
      <CardContent className="p-5">
        <div
          className="flex items-center gap-1.5 mb-3.5 text-[12px] font-medium"
          style={{ color: "var(--text-soft)" }}
        >
          <span style={{ color: "var(--text-soft)" }}>{icon}</span>
          {label}
        </div>
        <div className="text-kpi-value">{value}</div>
        {hint && (
          <p
            className="text-[12px] mt-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyRecordings({ onClick }: { onClick: () => void }) {
  return (
    <div className="px-6 py-10 text-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
        style={{ background: "var(--enf-soft)", color: "var(--enf-deep)" }}
      >
        <Mic className="w-5 h-5" aria-hidden="true" />
      </div>
      <p
        className="text-[14px] font-semibold mb-1"
        style={{ color: "var(--text)" }}
      >
        Você ainda não registrou nenhuma gravação
      </p>
      <p
        className="text-[13px] mb-4 max-w-[300px] mx-auto leading-relaxed"
        style={{ color: "var(--text-soft)" }}
      >
        Comece sua primeira agora — é só dizer o que aconteceu com o paciente.
      </p>
      <Button
        onClick={onClick}
        className="gap-2 bg-enf hover:bg-enf-hover text-white shadow-sm font-semibold mx-auto"
      >
        <span className="pulse-dot" aria-hidden="true" />
        Nova gravação
      </Button>
    </div>
  );
}
