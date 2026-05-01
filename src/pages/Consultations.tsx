import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useConsultations } from "@/hooks/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mic, Lock } from "lucide-react";

export default function Consultations() {
  const navigate = useNavigate();
  const { data: consultations, isLoading } = useConsultations();

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="heading-page">Atendimentos</h1>
          <Button onClick={() => navigate("/consultations/new")} className="gap-2">
            <Mic className="w-4 h-4" /> Novo atendimento
          </Button>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando…</p>
        ) : (consultations ?? []).length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              Nenhum atendimento registrado ainda.
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
                  <div className="flex items-center gap-2">
                    {c.locked_at && (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="w-3 h-3" /> Bloqueada
                      </Badge>
                    )}
                    <Badge variant="outline">{c.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
