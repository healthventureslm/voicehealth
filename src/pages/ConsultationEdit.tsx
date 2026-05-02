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
  const { user } = useAuth();
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
        <PageContainer>Atendimento não encontrado.</PageContainer>
      </AppLayout>
    );
  }

  if (consultation.locked_at) {
    return (
      <AppLayout>
        <PageContainer>
          <PageHeader back title="Atendimento bloqueado" />
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <Lock className="w-8 h-8 text-muted-foreground mx-auto" />
              <div className="font-medium">Atendimento bloqueado</div>
              <div className="text-sm text-muted-foreground">
                Este atendimento foi bloqueado para edição (paciente transferido).
                Você ainda pode adicionar observações na tela de visualização.
              </div>
              <Button onClick={() => navigate(`/consultations/${id}/report`)}>
                Ir para visualização
              </Button>
            </CardContent>
          </Card>
        </PageContainer>
      </AppLayout>
    );
  }

  async function saveTranscript() {
    setSavingTranscript(true);
    try {
      await update.mutateAsync({
        id: id!,
        patch: { edited_transcription: transcript },
      });
      toast.success("Transcrição salva");
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
      toast.success(`Relatório salvo (v${nextVersion})`);
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
      toast.success(`Nova versão do relatório gerada (v${data.version})`);
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
        <PageHeader back title="Editar atendimento" />

        {/* TRANSCRIÇÃO */}
        <Card>
          <CardHeader>
            <CardTitle className="heading-section flex items-center gap-2">
              <Mic className="w-5 h-5 text-primary" />
              Transcrição
            </CardTitle>
            <CardDescription>
              Texto bruto do atendimento (origina o relatório). Editar aqui não muda
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
              <Button onClick={saveTranscript} disabled={savingTranscript || update.isPending}>
                {savingTranscript ? "Salvando…" : "Salvar transcrição"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* RELATÓRIO */}
        <Card>
          <CardHeader>
            <CardTitle className="heading-section flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Relatório clínico {reportVersion > 0 && <span className="text-muted-foreground text-sm font-normal">(v{reportVersion})</span>}
            </CardTitle>
            <CardDescription>
              Documento estruturado em markdown. Editar aqui cria automaticamente
              uma nova versão (versões antigas ficam preservadas no histórico).
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
            <div className="flex flex-wrap gap-2 justify-between">
              <Button
                variant="outline"
                onClick={regenerateReport}
                disabled={regenerating || !consultation.template_id}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />
                {regenerating ? "Regerando…" : "Regerar relatório a partir da transcrição"}
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => navigate(`/consultations/${id}/report`)}>
                  Voltar pra visualização
                </Button>
                <Button onClick={saveReport} disabled={savingReport}>
                  {savingReport ? "Salvando…" : `Salvar relatório (v${reportVersion + 1})`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </AppLayout>
  );
}
