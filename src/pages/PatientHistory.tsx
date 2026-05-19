import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
  usePatient, usePatientWardHistory, usePatientTimeline, usePatientDocuments,
} from "@/hooks/queries";
import { TransferPatientDialog } from "@/components/TransferPatientDialog";
import { DischargePatientDialog } from "@/components/DischargePatientDialog";
import { useReadmitPatient } from "@/hooks/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Mic, ClipboardList, History, Lock,
  FileText, FileSignature, ArrowRightLeft, LogIn,
} from "lucide-react";
import { toast } from "sonner";

function truncate(s: string | null | undefined, max = 140): string {
  if (!s) return "";
  const trimmed = s.trim();
  return trimmed.length > max ? trimmed.slice(0, max) + "…" : trimmed;
}

function formatTimelineDate(d: Date): string {
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  }).replace(".", "");
}

export default function PatientHistory() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { wardIds, roles, isSuperAdmin } = useAuth();
  const { data: patient, isLoading } = usePatient(id);
  const { data: wardHistory } = usePatientWardHistory(id);
  const { data: timeline } = usePatientTimeline(id);
  const { data: documents } = usePatientDocuments(id);
  const readmit = useReadmitPatient();

  const isDischarged = patient?.admission_status === "discharged";

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

  const cpfFmt = patient.cpf
    ? patient.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
    : null;
  const subtitleParts = [
    patient.medical_record && `Prontuário: ${patient.medical_record}`,
    cpfFmt && `CPF: ${cpfFmt}`,
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
              {isDischarged ? (
                <Badge variant="secondary" className="text-xs">Em alta</Badge>
              ) : (patient as any).current_ward && (
                <Badge variant="outline" className="text-xs font-mono">
                  {(patient as any).current_ward.name}
                </Badge>
              )}
            </span>
          }
          subtitle={subtitleParts.join(" · ")}
          actions={
            canAttendPatient ? (
              isDischarged ? (
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={readmit.isPending}
                  onClick={async () => {
                    try {
                      await readmit.mutateAsync(patient.id);
                      toast.success("Paciente readmitido");
                    } catch (e: any) {
                      toast.error(`Erro: ${e?.message ?? e}`);
                    }
                  }}
                >
                  <LogIn className="w-4 h-4" />
                  {readmit.isPending ? "Readmitindo…" : "Readmitir"}
                </Button>
              ) : (
                <>
                  <TransferPatientDialog
                    patientId={patient.id}
                    patientName={patient.full_name}
                    currentWardId={patient.current_ward_id}
                    hospitalId={patient.hospital_id}
                  />
                  <DischargePatientDialog
                    patientId={patient.id}
                    patientName={patient.full_name}
                  />
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/documents/new?patient=${patient.id}`)}
                    className="gap-2"
                  >
                    <FileSignature className="w-4 h-4" /> Gerar documento
                  </Button>
                  <Button onClick={() => navigate(`/consultations/new?patient=${patient.id}`)} className="gap-2">
                    <Mic className="w-4 h-4" /> Nova gravação
                  </Button>
                </>
              )
            ) : (
              <Button disabled variant="outline" className="gap-2" title="Paciente está fora dos seus setores">
                <Lock className="w-4 h-4" /> Sem acesso clínico
              </Button>
            )
          }
        />

        {isDischarged && (
          <Card className="border-muted bg-muted/30">
            <CardContent className="py-3 text-sm flex items-start gap-3">
              <LogIn className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground rotate-180" />
              <div className="space-y-1">
                <div>
                  Paciente em alta
                  {patient.discharged_at && (
                    <> desde <strong>{new Date(patient.discharged_at).toLocaleString("pt-BR")}</strong></>
                  )}
                  .
                </div>
                {patient.discharge_reason && (
                  <div className="text-muted-foreground">
                    Motivo: {patient.discharge_reason}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {!canAttendPatient && (patient as any).current_ward && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-3 text-sm flex items-start gap-3">
              <Lock className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
              <div>
                Este paciente está atualmente em <strong>{(patient as any).current_ward.name}</strong>,
                que não está entre os seus setores ativos. Você pode visualizar o
                histórico, mas não pode registrar novas gravações. Adendos em
                gravações suas continuam permitidos.
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <CardTitle className="heading-section">
              Documentos ({documents?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(documents ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum documento gerado ainda.
              </p>
            ) : (
              (documents ?? []).map((d: any) => {
                // Doc gerado de notas (sem consulta) → /documents/:id
                // Relatório gerado de consulta com template → /consultations/:cid/report
                const target = d.consultation_id
                  ? `/consultations/${d.consultation_id}/report`
                  : `/documents/${d.id}`;
                const sourceLabel = d.consultation_id
                  ? "1 gravação"
                  : `${d.source_consultation_ids?.length ?? 0} gravaç${(d.source_consultation_ids?.length ?? 0) === 1 ? "ão" : "ões"}`;
                return (
                  <div
                    key={d.id}
                    className="flex items-start gap-3 p-3 border rounded-md hover:bg-accent/30 cursor-pointer transition-colors"
                    onClick={() => navigate(target)}
                  >
                    <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {d.template?.name ?? "Documento"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(d.generated_at).toLocaleString("pt-BR")} · gerado de {sourceLabel}
                      </div>
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
            <CardTitle className="heading-section">Linha do tempo</CardTitle>
          </CardHeader>
          <CardContent>
            {(timeline ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nada registrado ainda. Comece com uma gravação.
              </p>
            ) : (
              <div className="relative">
                <div
                  className="absolute left-3 top-3 bottom-3 w-px bg-border"
                  aria-hidden
                />
                <ol className="space-y-5">
                  {(timeline ?? []).map((item) => {
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
                      item.kind === "note" ? "Gravação"
                      : item.kind === "consultation" ? `Gravação com documento — ${p.template?.name ?? "—"}`
                      : `Documento — ${p.template?.name ?? "—"}`;
                    const preview =
                      item.kind === "note"
                        ? truncate(p.edited_transcription ?? p.raw_transcription)
                        : item.kind === "document"
                        ? `Gerado a partir de ${p.source_consultation_ids?.length ?? 0} gravaç${(p.source_consultation_ids?.length ?? 0) === 1 ? "ão" : "ões"}`
                        : (p.ward?.name ?? "");

                    const date = new Date(item.createdAt);
                    const dateStr = formatTimelineDate(date);
                    const timeStr = date.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <li
                        key={`${item.kind}-${item.id}`}
                        className="relative pl-10 cursor-pointer group"
                        onClick={() => navigate(targetUrl)}
                      >
                        <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary ring-4 ring-card flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5 text-primary-foreground" />
                        </div>

                        <div className="flex items-baseline gap-2 mb-1.5">
                          <span className="text-base font-semibold text-foreground">
                            {dateStr}
                          </span>
                          <span className="text-foreground/30">·</span>
                          <span className="text-base font-semibold text-foreground tabular-nums">
                            {timeStr}
                          </span>
                        </div>

                        <div className="p-3 border rounded-md group-hover:bg-accent/30 transition-colors">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{kindLabel}</span>
                            {p.locked_at && (
                              <Badge variant="secondary" className="text-xs">bloqueada</Badge>
                            )}
                          </div>
                          {preview && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {preview}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
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
