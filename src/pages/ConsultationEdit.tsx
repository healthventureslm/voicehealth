import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  useConsultation, useUpdateConsultation, useClinicalReports,
} from "@/hooks/queries";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Mic, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function ConsultationEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, wardIds, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: consultation, isLoading } = useConsultation(id);
  const { data: reports } = useClinicalReports(id);
  const update = useUpdateConsultation();

  const [transcript, setTranscript] = useState("");
  const [report, setReport] = useState("");
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const latestReport = (reports ?? [])[0];
  const reportVersion = latestReport?.version ?? 0;

  useEffect(() => {
    if (consultation) {
      setTranscript(consultation.edited_transcription ?? consultation.raw_transcription ?? "");
    }
  }, [consultation]);

  useEffect(() => {
    if (latestReport) {
      setReport(latestReport.content ?? "");
    }
  }, [latestReport]);

  if (isLoading) {
    return (
      <AppLayout>
        <PageContainer>Carregando…</PageContainer>
      </AppLayout>
    );
  }
  if (!consultation) {
    return (
      <AppLayout>
        <PageContainer>Gravação não encontrada.</PageContainer>
      </AppLayout>
    );
  }

  // Pode editar? Espelha a função SQL can_edit_consultation:
  //   - super_admin sempre pode
  //   - nota bloqueada (locked_at) → não
  //   - autor diferente → não
  //   - paciente em ward fora dos seus → não
  // Sem isso, a tela abria normalmente, a usuária digitava, e o save batia
  // 406 do PostgREST silenciosamente.
  const c: any = consultation;
  const cannotEditReason = (() => {
    if (isSuperAdmin) return null;
    if (c.locked_at) return "locked";
    if (c.professional_id !== user?.id) return "not-author";
    const patientWard = c.patient?.current_ward_id;
    if (!patientWard) return "no-ward";
    if (!wardIds.includes(patientWard)) return "ward-mismatch";
    return null;
  })();

  if (cannotEditReason) {
    const labels: Record<string, { title: string; body: string }> = {
      locked: {
        title: "Gravação bloqueada",
        body: "Esta gravação foi bloqueada para edição (paciente transferido). Você ainda pode adicionar observações na tela de visualização.",
      },
      "not-author": {
        title: "Sem permissão",
        body: "Apenas quem fez a gravação pode editá-la. Você pode adicionar observações (adendos) na tela de visualização.",
      },
      "ward-mismatch": {
        title: "Sem acesso clínico",
        body: "Você não está mais atribuída ao setor onde este paciente está. Edição bloqueada — observações (adendos) na visualização continuam permitidas.",
      },
      "no-ward": {
        title: "Paciente sem setor",
        body: "Este paciente não tem setor atual atribuído. Edição bloqueada.",
      },
    };
    const { title, body } = labels[cannotEditReason] ?? labels.locked;
    return (
      <AppLayout>
        <PageContainer>
          <PageHeader back title={title} />
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <Lock className="w-8 h-8 text-muted-foreground mx-auto" />
              <div className="font-medium">{title}</div>
              <div className="text-sm text-muted-foreground">{body}</div>
              <Button onClick={() => navigate(`/consultations/${id}/report`)}>
                Ir para visualização
              </Button>
            </CardContent>
          </Card>
        </PageContainer>
      </AppLayout>
    );
  }

  async function saveTranscriptAndGenerate() {
    setSavingTranscript(true);
    try {
      await update.mutateAsync({
        id: id!,
        patch: { edited_transcription: transcript },
      });

      if (consultation.template_id) {
        const { data, error } = await supabase.functions.invoke("generate-report", {
          body: {
            consultation_id: id,
            template_id: consultation.template_id,
            transcription: transcript,
          },
        });
        if (error || data?.error) {
          throw new Error(data?.error ?? error?.message ?? "Falha ao gerar documento");
        }
        toast.success("Transcrição salva e documento gerado");
        setReport(data.content ?? "");
        qc.invalidateQueries({ queryKey: ["clinical_reports", id] });
      } else {
        toast.success("Transcrição salva. Escolha o template para gerar o documento.");
        navigate(`/documents/new?patient=${consultation.patient_id}`);
      }
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    } finally {
      setSavingTranscript(false);
    }
  }

  async function saveReport() {
    if (!report.trim()) {
      toast.error("Conteúdo do relatório vazio");
      return;
    }
    setSavingReport(true);
    try {
      // Cria nova versão do relatório (clinical_reports é versionado)
      const nextVersion = reportVersion + 1;
      const { error } = await supabase.from("clinical_reports").insert({
        consultation_id: id!,
        template_id: latestReport?.template_id ?? null,
        version: nextVersion,
        content: report,
        format: latestReport?.format ?? "markdown",
        generated_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Relatório salvo");
      qc.invalidateQueries({ queryKey: ["clinical_reports", id] });
    } catch (e: any) {
      toast.error(`Erro ao salvar relatório: ${e?.message ?? e}`);
    } finally {
      setSavingReport(false);
    }
  }

  async function regenerateReport() {
    if (!consultation.template_id) {
      toast.error("Esta consulta não tem template associado — não dá pra regerar automaticamente.");
      return;
    }
    if (!transcript.trim()) {
      toast.error("Salve uma transcrição antes de regerar o relatório.");
      return;
    }

    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: {
          consultation_id: id,
          template_id: consultation.template_id,
          transcription: transcript,
        },
      });
      if (error || data?.error) {
        throw new Error(data?.error ?? error?.message ?? "Falha desconhecida");
      }
      toast.success("Relatório atualizado");
      setReport(data.content ?? "");
      qc.invalidateQueries({ queryKey: ["clinical_reports", id] });
    } catch (e: any) {
      toast.error(`Erro ao regerar: ${e?.message ?? e}`);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader back title="Editar gravação" />

        {/* TRANSCRIÇÃO */}
        <Card>
          <CardHeader>
            <CardTitle className="heading-section flex items-center gap-2">
              <Mic className="w-5 h-5 text-primary" />
              Transcrição
            </CardTitle>
            <CardDescription>
              Texto bruto da gravação (origina o relatório). Editar aqui não muda
              o relatório existente — use o botão "Regerar relatório" abaixo se quiser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="sr-only">Transcrição</Label>
            <Textarea
              rows={10}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="font-mono text-sm"
            />
            <div className="flex justify-end">
              <Button onClick={saveTranscriptAndGenerate} disabled={savingTranscript || update.isPending}>
                {savingTranscript ? "Salvando…" : "Salvar e gerar documento desta transcrição"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* RELATÓRIO */}
        <Card>
          <CardHeader>
            <CardTitle className="heading-section flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Relatório clínico
            </CardTitle>
            <CardDescription>
              Documento estruturado em markdown. As edições ficam salvas como
              versão atual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="sr-only">Conteúdo do relatório</Label>
            <Textarea
              rows={20}
              value={report}
              onChange={(e) => setReport(e.target.value)}
              placeholder={
                reportVersion === 0
                  ? "Nenhum relatório ainda. Você pode escrever manualmente aqui ou usar 'Regerar relatório'."
                  : ""
              }
              className="font-mono text-sm"
            />
            {consultation.template_id && (
              <div className="flex justify-start">
                <Button
                  variant="outline"
                  onClick={regenerateReport}
                  disabled={regenerating}
                  className="gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />
                  {regenerating ? "Regerando…" : "Regerar relatório a partir da transcrição"}
                </Button>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={saveReport} disabled={savingReport}>
                {savingReport ? "Salvando…" : "Salvar relatório"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </AppLayout>
  );
}
