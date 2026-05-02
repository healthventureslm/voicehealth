import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { ListItemCard, ListItemContent, ListItemActions } from "@/components/layout/ListItemCard";
import { useConsultations } from "@/hooks/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";

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
            action={
              <Button onClick={() => navigate("/consultations/new")} className="gap-2">
                <Mic className="w-4 h-4" /> Iniciar gravação
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {(consultations ?? []).map((c: any) => (
              <ListItemCard key={c.id} onClick={() => navigate(`/consultations/${c.id}/report`)}>
                <ListItemContent
                  title={c.patient?.full_name ?? "—"}
                  subtitle={
                    <>
                      {c.ward?.name && <span>{c.ward.name}</span>}
                      <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                    </>
                  }
                />
                <ListItemActions>
                  <Badge variant="outline">{c.status}</Badge>
                </ListItemActions>
              </ListItemCard>
            ))}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
