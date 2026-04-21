import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, FileText, Mic, Stethoscope, Calendar, User, Layers, Plus } from "lucide-react";
import { toast } from "sonner";
import { ReportTemplateDialog } from "@/components/ReportTemplateDialog";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

interface ConsultationWithReport {
  id: string;
  status: string;
  created_at: string;
  raw_transcription: string | null;
  edited_transcription: string | null;
  clinical_reports: { id: string; template_type: string; content: string; created_at: string }[];
  clinical_alerts: { id: string; alert_type: string; title: string; severity: string }[];
}

export default function PatientHistory() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [consultations, setConsultations] = useState<ConsultationWithReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("patients").select("*").eq("id", id).single(),
      supabase
        .from("consultations")
        .select("id, status, created_at, raw_transcription, edited_transcription, clinical_reports(*), clinical_alerts(*)")
        .eq("patient_id", id)
        .order("created_at", { ascending: false }),
    ]).then(([patientRes, consultRes]) => {
      setPatient(patientRes.data);
      setConsultations((consultRes.data as any) || []);
      setLoading(false);
    });
  }, [id]);

  const toggleSelect = (cId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cId)) next.delete(cId);
      else next.add(cId);
      return next;
    });
  };

  const selectableConsultations = consultations.filter(
    (c) => (c.edited_transcription || c.raw_transcription) && c.status !== "recording"
  );

  const handleConsolidatedReport = async (templateIds: string[]) => {
    const templateId = templateIds[0];
    if (!templateId) return;
    setShowTemplateDialog(false);
    setGeneratingReport(true);

    const selected = consultations
      .filter((c) => selectedIds.has(c.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const transcriptions = selected.map((c, i) => ({
      text: c.edited_transcription || c.raw_transcription || "",
      date: new Date(c.created_at).toLocaleString("pt-BR"),
      index: i + 1,
    }));

    // Use the last consultation as the reference
    const lastConsultation = selected[selected.length - 1];

    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: {
          consultation_id: lastConsultation.id,
          template_id: templateId,
          transcriptions,
        },
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); setGeneratingReport(false); return; }

      toast.success("Relatório consolidado gerado com sucesso!");
      setSelectedIds(new Set());
      // Refresh consultations
      const { data: refreshed } = await supabase
        .from("consultations")
        .select("id, status, created_at, raw_transcription, edited_transcription, clinical_reports(*), clinical_alerts(*)")
        .eq("patient_id", id!)
        .order("created_at", { ascending: false });
      setConsultations((refreshed as any) || []);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar relatório consolidado");
    }
    setGeneratingReport(false);
  };

  const statusLabel: Record<string, string> = {
    recording: "Gravando",
    transcribing: "Transcrevendo",
    transcribed: "Transcrito",
    editing: "Em edição",
    completed: "Concluído",
  };

  const statusColor: Record<string, string> = {
    recording: "bg-warning/10 text-warning",
    transcribing: "bg-primary/10 text-primary",
    transcribed: "bg-blue-500/10 text-blue-600",
    editing: "bg-accent text-accent-foreground",
    completed: "bg-emerald-500/10 text-emerald-600",
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!patient) {
    return (
      <AppLayout>
        <div className="p-6 text-center text-muted-foreground">Paciente não encontrado.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/patients")} className="gap-2 mb-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>

        {/* Patient info */}
        <Card>
          <CardContent className="flex items-center gap-4 py-5">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight">{patient.full_name}</h1>
              <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                {patient.medical_record && <span>Prontuário: {patient.medical_record}</span>}
                {patient.bed && <span>Leito: {patient.bed}</span>}
                {patient.initials && <span>Iniciais: {patient.initials}</span>}
              </div>
            </div>
            <Badge variant="outline" className="text-sm">
              {consultations.length} atendimento{consultations.length !== 1 ? "s" : ""}
            </Badge>
          </CardContent>
        </Card>

        {/* Consolidated Report Action */}
        {selectedIds.size >= 2 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">{selectedIds.size} transcrições selecionadas</p>
                  <p className="text-xs text-muted-foreground">Gere um relatório unificado com todas as gravações</p>
                </div>
              </div>
              <Button
                onClick={() => setShowTemplateDialog(true)}
                disabled={generatingReport}
                className="gap-2"
              >
                {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Gerar Relatório Consolidado
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Histórico de Atendimentos
          </h2>
          {selectableConsultations.length >= 2 && selectedIds.size < 2 && (
            <p className="text-xs text-muted-foreground mb-3">
              💡 Selecione 2+ transcrições para gerar um relatório consolidado e economizar custos.
            </p>
          )}

          {consultations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum atendimento registrado para este paciente.
              </CardContent>
            </Card>
          ) : (
            <div className="relative space-y-0">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

              {consultations.map((c) => {
                const isExpanded = expandedId === c.id;
                const date = new Date(c.created_at);
                const hasTranscription = !!(c.edited_transcription || c.raw_transcription);
                const isSelectable = hasTranscription && c.status !== "recording";
                return (
                  <div key={c.id} className="relative pl-12 pb-6">
                    <div className="absolute left-3.5 top-2 w-3 h-3 rounded-full border-2 border-primary bg-background z-10" />

                    <Card
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    >
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isSelectable && (
                              <Checkbox
                                checked={selectedIds.has(c.id)}
                                onCheckedChange={() => toggleSelect(c.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            <Mic className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {date.toLocaleDateString("pt-BR")} às {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {c.clinical_reports.length > 0 && (
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <FileText className="w-3 h-3" /> {c.clinical_reports.length} relatório{c.clinical_reports.length > 1 ? "s" : ""}
                              </Badge>
                            )}
                            {c.clinical_alerts.filter(a => a.severity === "critical").length > 0 && (
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <Stethoscope className="w-3 h-3" /> Alerta
                              </Badge>
                            )}
                            <Badge className={statusColor[c.status] || "bg-muted text-muted-foreground"}>
                              {statusLabel[c.status] || c.status}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>

                      {isExpanded && (
                        <CardContent className="pt-0 px-4 pb-4 space-y-4">
                          {(c.edited_transcription || c.raw_transcription) && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Transcrição</p>
                              <p className="text-sm bg-muted/50 p-3 rounded-lg line-clamp-4">
                                {c.edited_transcription || c.raw_transcription}
                              </p>
                            </div>
                          )}

                          {c.clinical_reports.map((r) => (
                            <div key={r.id}>
                              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                                Relatório — {r.template_type}
                              </p>
                              <div className="text-sm bg-muted/50 p-3 rounded-lg whitespace-pre-wrap line-clamp-6">
                                {r.content}
                              </div>
                            </div>
                          ))}

                          {c.clinical_alerts.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Alertas Clínicos</p>
                              <div className="flex flex-wrap gap-2">
                                {c.clinical_alerts.map((a) => (
                                  <Badge
                                    key={a.id}
                                    variant={a.severity === "critical" ? "destructive" : "secondary"}
                                  >
                                    {a.title}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2 pt-2">
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/consultations/${c.id}/edit`); }}>
                              Editar
                            </Button>
                            {c.clinical_reports.length > 0 && (
                              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/consultations/${c.id}/report`); }}>
                                Ver Relatório
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              className="gap-1"
                              onClick={(e) => { e.stopPropagation(); navigate(`/consultations/new?patient=${id}`); }}
                            >
                              <Plus className="w-3 h-3" /> Complementar
                            </Button>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ReportTemplateDialog
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        onSubmit={handleConsolidatedReport}
        isSubmitting={generatingReport}
      />
    </AppLayout>
  );
}