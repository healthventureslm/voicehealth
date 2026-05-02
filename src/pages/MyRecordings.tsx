import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { useConsultations } from "@/hooks/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MyRecordings() {
  const navigate = useNavigate();
  const { data: consultations, isLoading } = useConsultations({ mineOnly: true });

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Minhas gravações"
          subtitle="Atendimentos que você registrou. Aparecem aqui mesmo após o paciente ser transferido — você sempre pode revisitar e adicionar adendos."
        />

        {isLoading ? (
          <EmptyState loading />
        ) : (consultations ?? []).length === 0 ? (
          <EmptyState
            title="Nenhum atendimento registrado"
            description="Suas gravações aparecem aqui assim que forem criadas."
          />
        ) : (
          <div className="space-y-2">
            {(consultations ?? []).map((c: any) => (
              <Card
                key={c.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/consultations/${c.id}/report`)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.patient?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.ward?.name ? `${c.ward.name} · ` : ""}
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <Badge variant="outline">{c.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
