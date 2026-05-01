import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { profile, roles, isSuperAdmin } = useAuth();
  const primaryRole = roles[0]?.role ?? "—";

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="heading-page">
            Olá, {profile?.full_name?.split(" ")[0] ?? "usuário"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo ao VoiceHealth — versão v2 (rebuild).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="heading-section">Sua sessão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Papel: </span>
                <span className="font-medium">
                  {isSuperAdmin ? "super_admin" : primaryRole}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Hospitais: </span>
                <span className="font-medium">{roles.filter((r) => r.hospital_id).length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="heading-section">Próximas etapas</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Esta é a Fase 1 do rebuild — apenas a fundação. As telas clínicas
              (gravação de consulta, listagem de pacientes, etc.) virão na Fase 2,
              focadas no fluxo de enfermagem.
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
