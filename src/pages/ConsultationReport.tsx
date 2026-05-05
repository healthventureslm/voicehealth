import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
  useConsultation, useClinicalReports, useAddenda,
} from "@/hooks/queries";
import { AddendumDialog } from "@/components/consultation/AddendumDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Lock, Mic, History, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { exportReportPdf } from "@/lib/exportReportPdf";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  recording: "Gravando",
  transcribing: "Transcrevendo",
  transcribed: "Transcrita",
  editing: "Editando",
  completed: "Concluída",
};

export default function ConsultationReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: consultation, isLoading } = useConsultation(id);
  const { data: reports } = useClinicalReports(id);
  const { data: addenda } = useAddenda(id);

  async function handleExportPdf() {
    if (!consultation) return;
    if (!latestReport) {
      toast.error("Não há relatório pra exportar ainda");
      return;
    }
    const c = consultation as any;
    try {
      await exportReportPdf({
        consultation: c,
        reportContent: latestReport.content,
        reportVersion: latestReport.version,
        reportFormat: latestReport.format,
        addenda: (addenda as any) ?? [],
        professionalName: profile?.full_name ?? undefined,
        hospitalName: c.hospital?.name ?? undefined,
        hospitalLogoUrl: c.hospital?.logo_url ?? undefined,
      });
      toast.success("PDF gerado");
    } catch (e: any) {
      toast.error(`Falha ao exportar: ${e?.message ?? e}`);
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <PageContainer width="narrow">Carregando…</PageContainer>
      </AppLayout>
    );
  }

  if (!consultation) {
    return (
      <AppLayout>
        <PageContainer width="narrow">
          <p>Gravação não encontrada ou sem permissão.</p>
        </PageContainer>
      </AppLayout>
    );
  }

  const c: any = consultation;
  const latestReport = (reports ?? [])[0];

  return (
    <AppLayout>
      <PageContainer width="narrow">
        <PageHeader
          back
          title={`Gravação — ${c.patient?.full_name ?? "—"}`}
          subtitle={
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
              {c.ward?.name && <span>· {c.ward.name}</span>}
              <Badge variant="outline" className="ml-1">
                {STATUS_LABELS[c.status] ?? c.status}
              </Badge>
              {c.locked_at && (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="w-3 h-3" /> Bloqueada
                </Badge>
              )}
            </span>
          }
          actions={
            <>
              <Button
                variant="outline"
                onClick={handleExportPdf}
                disabled={!latestReport}
                className="gap-2"
              >
                <Download className="w-4 h-4" /> PDF
              </Button>
              {!c.locked_at && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/consultations/${c.id}/edit`)}
                  className="gap-2"
                >
                  Editar
                </Button>
              )}
            </>
          }
        />

        {c.locked_at && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-4 text-sm">
              Esta gravação foi bloqueada em{" "}
              <strong>{new Date(c.locked_at).toLocaleString("pt-BR")}</strong>{" "}
              porque o paciente foi transferido para outro setor. Você ainda pode adicionar
              observações (adendos), que ficam permanentemente registradas com seu nome
              e timestamp.
            </CardContent>
          </Card>
        )}

        {/* Relatório clínico */}
        {latestReport ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="heading-section flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Relatório clínico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <article className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{latestReport.content}</ReactMarkdown>
              </article>
            </CardContent>
          </Card>
        ) : c.edited_transcription || c.raw_transcription ? (
          <Card>
            <CardHeader>
              <CardTitle className="heading-section flex items-center gap-2">
                <Mic className="w-5 h-5 text-primary" />
                Transcrição
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">
                {c.edited_transcription || c.raw_transcription}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Adendos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Observações posteriores
            </CardTitle>
            <AddendumDialog consultationId={c.id} />
          </CardHeader>
          <CardContent>
            {(addenda ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum adendo registrado.
              </p>
            ) : (
              <div className="space-y-3">
                {(addenda ?? []).map((a: any) => (
                  <div key={a.id} className="border-l-2 border-accent/40 pl-3 py-2">
                    <div className="text-xs text-muted-foreground mb-1">
                      {a.author?.full_name ?? "—"} ·{" "}
                      <span className="capitalize">{a.author_role_at_time}</span>{" "}
                      · {new Date(a.created_at).toLocaleString("pt-BR")}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{a.content}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </AppLayout>
  );
}
