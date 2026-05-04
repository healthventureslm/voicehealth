import { useNavigate, useParams } from "react-router-dom";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useHospitalDetail, useUpdateHospital } from "@/hooks/queries";
import { HospitalLogoUpload } from "@/components/superadmin/HospitalLogoUpload";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Users, ClipboardList, Activity,
  UserCircle2, Power,
} from "lucide-react";
import { toast } from "sonner";

const ROLE_LABEL: Record<string, string> = {
  super_admin:    "Super Admin",
  hospital_admin: "Admin",
  doctor:         "Médico(a)",
  nurse:          "Enfermeiro(a)",
  auditor:        "Auditor(a)",
};

const WARD_TYPE_LABEL: Record<string, string> = {
  uti:              "UTI",
  enfermaria:       "Enfermaria",
  centro_cirurgico: "Centro Cirúrgico",
  pronto_socorro:   "Pronto-Socorro",
  ambulatorio:      "Ambulatório",
};

export default function SuperAdminHospitalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useHospitalDetail(id);
  const updateHospital = useUpdateHospital();

  if (isLoading) {
    return (
      <SuperAdminLayout>
        <PageContainer>Carregando…</PageContainer>
      </SuperAdminLayout>
    );
  }

  if (!data?.hospital) {
    return (
      <SuperAdminLayout>
        <PageContainer width="narrow">
          <PageHeader back backTo="/superadmin/hospitals" title="Hospital não encontrado" />
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Verifique se o ID está correto.
            </CardContent>
          </Card>
        </PageContainer>
      </SuperAdminLayout>
    );
  }

  const { hospital, wards, users, stats } = data;

  async function toggleActive() {
    try {
      await updateHospital.mutateAsync({
        id: hospital.id,
        patch: { is_active: !hospital.is_active },
      });
      toast.success(`Hospital ${hospital.is_active ? "desativado" : "ativado"}`);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  return (
    <SuperAdminLayout>
      <PageContainer>
        <PageHeader
          back
          backTo="/superadmin/hospitals"
          eyebrow="Hospital"
          icon={<Building2 className="w-7 h-7" />}
          title={
            <span className="flex items-center gap-3">
              {hospital.name}
              {!hospital.is_active && <Badge variant="secondary">inativo</Badge>}
            </span>
          }
          subtitle={
            <span className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">slug: {hospital.slug}</Badge>
              <Badge variant="outline">plano: {hospital.plan}</Badge>
              {hospital.cnpj && <Badge variant="outline">CNPJ {hospital.cnpj}</Badge>}
              <span>· criado {new Date(hospital.created_at).toLocaleDateString("pt-BR")}</span>
            </span>
          }
          actions={
            <Button
              variant="outline"
              onClick={toggleActive}
              disabled={updateHospital.isPending}
              className="gap-2"
            >
              <Power className="w-4 h-4" />
              {hospital.is_active ? "Desativar" : "Ativar"}
            </Button>
          }
        />

        {/* Logo do hospital */}
        <HospitalLogoUpload hospital={hospital} />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={<Building2 className="w-4 h-4" />} label="Setores" value={stats.wards_count} />
          <KpiCard icon={<Users className="w-4 h-4" />}      label="Usuários" value={stats.users_count} />
          <KpiCard icon={<UserCircle2 className="w-4 h-4" />} label="Pacientes" value={stats.patients_count} />
          <KpiCard icon={<Activity className="w-4 h-4" />}    label="Atendimentos" value={stats.consultations_count} />
        </div>

        {/* 2 colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Setores */}
          <Card className="hv-card">
            <CardHeader>
              <CardTitle className="heading-section flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Setores ({wards.length})
              </CardTitle>
              <CardDescription>Wards cadastrados neste hospital</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {wards.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum setor cadastrado.
                </p>
              ) : (
                wards.map((w: any) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between p-3 border rounded-md"
                  >
                    <div>
                      <div className="text-sm font-medium">{w.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {WARD_TYPE_LABEL[w.ward_type] ?? w.ward_type}
                        </Badge>
                        <span>{w.bed_count} leitos</span>
                        {!w.is_active && <Badge variant="secondary" className="text-xs">inativo</Badge>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Usuários */}
          <Card className="hv-card">
            <CardHeader>
              <CardTitle className="heading-section flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Equipe ({users.length})
              </CardTitle>
              <CardDescription>Usuários vinculados a este hospital</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum usuário vinculado.
                </p>
              ) : (
                users.map((u) => (
                  <div
                    key={u.user_id}
                    className="flex items-center justify-between p-3 border rounded-md"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {u.full_name ?? "—"}
                      </div>
                      {u.professional_role && (
                        <div className="text-xs text-muted-foreground truncate">
                          {u.professional_role}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {u.roles.map((r) => (
                        <Badge key={r} variant="outline" className="text-xs">
                          {ROLE_LABEL[r] ?? r}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Indicador de health */}
        <Card className="hv-card">
          <CardHeader>
            <CardTitle className="heading-section flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Saúde do tenant
            </CardTitle>
            <CardDescription>Sinais rápidos pra avaliar uso e adoção</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <Signal
              label="Onboarding"
              ok={stats.users_count >= 1 && stats.wards_count >= 1}
              positive="Hospital configurado"
              negative="Falta admin ou setores"
            />
            <Signal
              label="Atividade clínica"
              ok={stats.consultations_count > 0}
              positive={`${stats.consultations_count} atendimento${stats.consultations_count !== 1 ? "s" : ""}`}
              negative="Nenhuma consulta ainda"
            />
            <Signal
              label="Equipe completa"
              ok={users.some((u) => u.roles.includes("doctor") || u.roles.includes("nurse"))}
              positive="Tem profissionais clínicos"
              negative="Só admins, sem médicos/enfermeiros"
            />
          </CardContent>
        </Card>
      </PageContainer>
    </SuperAdminLayout>
  );
}

function KpiCard({
  icon, label, value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
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
      </CardContent>
    </Card>
  );
}

function Signal({
  label, ok, positive, negative,
}: {
  label: string;
  ok: boolean;
  positive: string;
  negative: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div
        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
        style={{ background: ok ? "var(--hv-accent)" : "rgb(255 208 96)" }}
      />
      <div>
        <p className="hv-eyebrow mb-1">{label}</p>
        <p className="text-sm">{ok ? positive : negative}</p>
      </div>
    </div>
  );
}
