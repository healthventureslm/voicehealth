import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  usePatient, usePatientWardHistory, useConsultations,
} from "@/hooks/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mic, ClipboardList, History } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  recording: "Gravando",
  transcribing: "Transcrevendo",
  transcribed: "Transcrita",
  editing: "Editando",
  completed: "Concluída",
};

export default function PatientHistory() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: patient, isLoading } = usePatient(id);
  const { data: wardHistory } = usePatientWardHistory(id);
  const { data: consultations } = useConsultations({ patientId: id });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-4xl mx-auto">Carregando…</div>
      </AppLayout>
    );
  }

  if (!patient) {
    return (
      <AppLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <p>Paciente não encontrado ou sem permissão.</p>
          <Button variant="outline" onClick={() => navigate("/patients")} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/patients")} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para pacientes
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{patient.full_name}</h1>
            <div className="text-sm text-muted-foreground space-x-3 mt-1">
              {patient.medical_record && <span>Prontuário: {patient.medical_record}</span>}
              {patient.bed && <span>Leito: {patient.bed}</span>}
              {patient.date_of_birth && (
                <span>Nascimento: {new Date(patient.date_of_birth).toLocaleDateString("pt-BR")}</span>
              )}
            </div>
            {(patient as any).current_ward && (
              <Badge variant="outline" className="mt-2">
                {(patient as any).current_ward.name}
              </Badge>
            )}
          </div>
          <Button onClick={() => navigate(`/consultations/new?patient=${patient.id}`)} className="gap-2">
            <Mic className="w-4 h-4" /> Nova evolução
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Atendimentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(consultations ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum atendimento registrado ainda.
              </p>
            ) : (
              (consultations ?? []).map((c: any) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-accent/50 cursor-pointer"
                  onClick={() => navigate(`/consultations/${c.id}/report`)}
                >
                  <div>
                    <div className="text-sm font-medium">
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.ward?.name ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.locked_at && <Badge variant="secondary">bloqueada</Badge>}
                    <Badge variant="outline">{STATUS_LABELS[c.status] ?? c.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Trajetória entre setores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(wardHistory ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sem histórico de transferências.
              </p>
            ) : (
              (wardHistory ?? []).map((h: any) => (
                <div key={h.id} className="text-sm flex items-center justify-between border-l-2 border-primary/30 pl-3 py-1">
                  <div>
                    <span className="font-medium">{h.ward?.name ?? "—"}</span>
                    <span className="text-muted-foreground ml-2">
                      {new Date(h.admitted_at).toLocaleString("pt-BR")}
                      {h.discharged_at && ` → ${new Date(h.discharged_at).toLocaleString("pt-BR")}`}
                    </span>
                  </div>
                  {!h.discharged_at && <Badge>atual</Badge>}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
