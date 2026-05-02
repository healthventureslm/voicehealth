import { Link } from "react-router-dom";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useGlobalStats, useHospitals } from "@/hooks/queries";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, Activity, FileText, ArrowRight } from "lucide-react";

export default function SuperAdminHome() {
  const { profile } = useAuth();
  const { data: stats, isLoading: loadingStats } = useGlobalStats();
  const { data: hospitals } = useHospitals();

  return (
    <SuperAdminLayout>
      <PageContainer>
        <PageHeader
          eyebrow="Visão geral"
          title={`Olá, ${profile?.full_name?.split(" ")[0] ?? "—"}`}
          subtitle="Visão consolidada de todos os hospitais que rodam VoiceHealth."
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-xs">
                <Building2 className="w-4 h-4" /> Hospitais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="hv-stat">
                {loadingStats ? "—" : stats?.hospitals ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-xs">
                <Users className="w-4 h-4" /> Vínculos de usuários
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="hv-stat">
                {loadingStats ? "—" : stats?.userRoles ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-xs">
                <Activity className="w-4 h-4" /> Pacientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="hv-stat">
                {loadingStats ? "—" : stats?.patients ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-xs">
                <FileText className="w-4 h-4" /> Atendimentos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="hv-stat">
                {loadingStats ? "—" : stats?.consultations ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <Card>
          <CardHeader>
            <CardTitle className="heading-section">Hospitais ({hospitals?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(hospitals ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum hospital cadastrado ainda.{" "}
                <Link to="/superadmin/hospitals" className="text-primary underline">
                  Criar o primeiro
                </Link>
              </p>
            ) : (
              (hospitals ?? []).slice(0, 6).map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div>
                    <div className="font-medium">{h.name}</div>
                    <div className="text-xs text-muted-foreground">
                      slug: {h.slug} · plano: {h.plan} · {h.is_active ? "ativo" : "inativo"}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div className="pt-2">
              <Button asChild variant="outline" className="w-full gap-2">
                <Link to="/superadmin/hospitals">
                  Ver todos os hospitais <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </SuperAdminLayout>
  );
}
