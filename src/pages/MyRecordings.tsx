import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useConsultations } from "@/hooks/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic } from "lucide-react";

export default function MyRecordings() {
  const navigate = useNavigate();
  const { data: consultations, isLoading } = useConsultations({ mineOnly: true });

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="heading-page flex items-center gap-2">
            <Mic className="w-6 h-6 text-primary" />
            Minhas gravações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Atendimentos que você registrou. Aparecem aqui mesmo após o paciente
            ser transferido — você sempre pode revisitar e adicionar adendos.
          </p>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando…</p>
        ) : (consultations ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              Você ainda não registrou nenhum atendimento.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {(consultations ?? []).map((c: any) => (
              <Card
                key={c.id}
                className="cursor-pointer hover:border-primary/50"
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
      </div>
    </AppLayout>
  );
}
