import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
  usePatient, usePatientWardHistory, usePatientTimeline,
} from "@/hooks/queries";
import { TransferPatientDialog } from "@/components/TransferPatientDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Mic, ClipboardList, History, Lock,
  FileText, FileSignature,
} from "lucide-react";

function truncate(s: string | null | undefined, max = 140): string {
  if (!s) return "";
  const trimmed = s.trim();
  return trimmed.length > max ? trimmed.slice(0, max) + "…" : trimmed;
}

export default function PatientHistory() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { wardIds, roles, isSuperAdmin } = useAuth();
  const { data: patient, isLoading } = usePatient(id);
  const { data: wardHistory } = usePatientWardHistory(id);
  const { data: timeline } = usePatientTimeline(id);

  // O usuário pode atender este paciente?
  // - super_admin sempre pode
  // - hospital_admin do hospital do paciente sempre pode
  // - doctor/nurse só se o paciente está em um dos seus wards
  const canAttendPatient = (() => {
    if (!patient) return false;
    if (isSuperAdmin) return true;
    const isHospitalAdmin = roles.some(
      (r) => r.role === "hospital_admin" && r.hospital_id === patient.hospital_id,
    );
    if (isHospitalAdmin) return true;
    return !!patient.current_ward_id && wardIds.includes(patient.current_ward_id);
  })();

  if (isLoading) {
    return (
      <AppLayout>
        <PageContainer>Carregando…</PageContainer>
      </AppLayout>
    );
  }

  if (!patient) {
    return (
      <AppLayout>
        <PageContainer>
          <p>Paciente não encontrado ou sem permissão.</p>
          <Button variant="outline" onClick={() => navigate("/patients")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </PageContainer>
      </AppLayout>
    );
  }

  const subtitleParts = [
    patient.medical_record && `Prontuário: ${patient.medical_record}`,
    patient.bed && `Leito: ${patient.bed}`,
    patient.date_of_birth && `Nascimento: ${new Date(patient.date_of_birth).toLocaleDateString("pt-BR")}`,
  ].filter(Boolean) as string[];

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          back
          backTo="/patients"
          title={
            <span className="flex items-center gap-3">
              {patient.full_name}
              {(patient as any).current_ward && (
                <Badge variant="outline" className="text-xs font-mono">
                  {(patient as any).current_ward.name}
                </Badge>
              )}
            </span>
          }
          subtitle={subtitleParts.join(" · ")}
          actions={
            canAttendPatient ? (
              <>
                <TransferPatientDialog
                  patientId={patient.id}
                  patientName={patient.full_name}
                  currentWardId={patient.current_ward_id}
                  hospitalId={patient.hospital_id}
                />
                <Button
                  variant="outline"
                  onClick={() => navigate(`/documents/new?patient=${patient.id}`)}
                  className="gap-2"
                >
                  <FileSignature className="w-4 h-4" /> Gerar documento
                </Button>
                <Button onClick={() => navigate(`/consultations/new?patient=${patient.id}`)} className="gap-2">
                  <Mic className="w-4 h-4" /> Nova nota
                </Button>
              </>
            ) : (
              <Button disabled variant="outline" className="gap-2" title="Paciente está fora dos seus setores">
                <Lock className="w-4 h-4" /> Sem acesso clínico
              </Button>
            )
          }
        />

        {!canAttendPatient && (patient as any).current_ward && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-3 text-sm flex items-start gap-3">
              <Lock className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
              <div>
                Este paciente está atualmente em <strong>{(patient as any).current_ward.name}</strong>,
                que não está entre os seus setores ativos. Você pode visualizar o
                histórico, mas não pode iniciar novos atendimentos. Adendos em
                consultas suas continuam permitidos.
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            <CardTitle className="heading-section">Linha do tempo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(timeline ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nada registrado ainda. Comece com uma nota.
              </p>
            ) : (
              (timeline ?? []).map((item) => {
                const p = item.payload;
                const Icon =
                  item.kind === "note" ? Mic
                  : item.kind === "consultation" ? ClipboardList
                  : FileText;
                const targetUrl =
                  item.kind === "document"
                    ? `/documents/${p.id}`
                    : `/consultations/${p.id}/report`;
                const kindLabel =
                  item.kind === "note" ? "Nota"
                  : item.kind === "consultation" ? `Atendimento — ${p.template?.name ?? "—"}`
                  : `Documento — ${p.template?.name ?? "—"}`;
                const preview =
                  item.kind === "note"
                    ? truncate(p.edited_transcription ?? p.raw_transcription)
                    : item.kind === "document"
                    ? `Gerado a partir de ${p.source_consultation_ids?.length ?? 0} nota${(p.source_consultation_ids?.length ?? 0) === 1 ? "" : "s"}`
                    : (p.ward?.name ?? "");

                return (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className="flex items-start gap-3 p-3 border rounded-md hover:bg-accent/30 cursor-pointer transition-colors"
                    onClick={() => navigate(targetUrl)}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{kindLabel}</span>
                        {p.locked_at && <Badge variant="secondary" className="text-xs">bloqueada</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(item.createdAt).toLocaleString("pt-BR")}
                      </div>
                      {preview && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {preview}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <CardTitle className="heading-section">Trajetória entre setores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(wardHistory ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sem histórico de transferências.
              </p>
            ) : (
              (wardHistory ?? []).map((h: any) => (
                <div key={h.id} className="text-sm flex items-center justify-between border-l-2 border-accent/40 pl-3 py-1">
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
      </PageContainer>
    </AppLayout>
  );
}
