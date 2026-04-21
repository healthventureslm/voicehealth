import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, AlertTriangle, Stethoscope, Pill, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";

type Consultation = Tables<"consultations">;
type ClinicalAlert = Tables<"clinical_alerts">;
type ReportTemplate = Tables<"report_templates">;
type Specialty = Tables<"medical_specialties">;

export default function ConsultationEdit() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [editedText, setEditedText] = useState("");
  const [alerts, setAlerts] = useState<ClinicalAlert[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [analyzingCDS, setAnalyzingCDS] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("consultations").select("*").eq("id", id).single(),
      supabase.from("clinical_alerts").select("*").eq("consultation_id", id).order("created_at"),
      supabase.from("report_templates").select("*").eq("is_active", true),
    ]).then(async ([consultRes, alertsRes, templatesRes]) => {
      if (consultRes.data) {
        setConsultation(consultRes.data);
        setEditedText(consultRes.data.edited_transcription || consultRes.data.raw_transcription || "");
        // Pre-select template if saved during recording
        if (consultRes.data.selected_template_id) {
          setSelectedTemplate(consultRes.data.selected_template_id);
        }
        // Load specialty if present
        if (consultRes.data.specialty_id) {
          const { data: spec } = await supabase.from("medical_specialties").select("*").eq("id", consultRes.data.specialty_id).single();
          if (spec) setSpecialty(spec);
        }
      }
      setAlerts(alertsRes.data || []);
      setTemplates(templatesRes.data || []);
    });
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    const { error } = await supabase
      .from("consultations")
      .update({ edited_transcription: editedText, status: "editing" })
      .eq("id", id);
    if (error) toast.error("Erro ao salvar");
    else toast.success("Transcrição salva!");
    setSaving(false);
  };

  const handleAnalyzeCDS = async () => {
    if (!id) return;
    setAnalyzingCDS(true);
    try {
      const { error } = await supabase.functions.invoke("clinical-decision", {
        body: { consultation_id: id, transcription: editedText },
      });
      if (error) throw error;

      const { data: newAlerts } = await supabase
        .from("clinical_alerts")
        .select("*")
        .eq("consultation_id", id)
        .order("created_at");
      setAlerts(newAlerts || []);
      toast.success("Análise clínica concluída!");
    } catch {
      toast.error("Erro na análise clínica");
    }
    setAnalyzingCDS(false);
  };

  const handleGenerateReport = async () => {
    if (!id) return;
    // If consultation has specialty, use ambulatory-report edge function
    if (specialty && consultation?.specialty_id) {
      setGenerating(true);
      try {
        const { data, error } = await supabase.functions.invoke("ambulatory-report", {
          body: { consultation_id: id, specialty_id: consultation.specialty_id, transcription: editedText },
        });
        if (error) throw error;
        toast.success("Relatório ambulatorial gerado!");
        navigate(`/consultations/${id}/report`);
      } catch {
        toast.error("Erro ao gerar relatório");
      }
      setGenerating(false);
      return;
    }
    // Otherwise use standard template-based report
    if (!selectedTemplate) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { consultation_id: id, template_id: selectedTemplate, transcription: editedText },
      });
      if (error) throw error;
      toast.success("Relatório gerado!");
      navigate(`/consultations/${id}/report`);
    } catch {
      toast.error("Erro ao gerar relatório");
    }
    setGenerating(false);
  };

  const alertIcon: Record<string, any> = {
    drug_interaction: Pill,
    differential_diagnosis: Stethoscope,
    protocol_suggestion: FileText,
  };

  const severityColor: Record<string, string> = {
    critical: "bg-red-500/20 text-red-300 border-red-500/40",
    warning: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    info: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  };

  if (!consultation) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Editar Transcrição</h1>
          <p className="text-muted-foreground">Revise e edite a transcrição do atendimento</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main editor */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Transcrição</CardTitle>
                <Button onClick={handleSave} disabled={saving} variant="outline" className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar
                </Button>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  placeholder="A transcrição aparecerá aqui..."
                />
              </CardContent>
            </Card>

            {/* Generate report */}
            <Card>
              <CardHeader><CardTitle>Gerar Relatório Clínico</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {specialty ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <Stethoscope className="w-5 h-5 text-primary flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm">Ambulatório - {specialty.name}</p>
                        <p className="text-xs text-muted-foreground">Relatório será gerado com prompt específico da especialidade + RAG</p>
                      </div>
                    </div>
                    <Button onClick={handleGenerateReport} disabled={generating} className="gap-2 w-full sm:w-auto">
                      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      Gerar Relatório de {specialty.name}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione o tipo de relatório" /></SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleGenerateReport} disabled={generating || !selectedTemplate} className="gap-2">
                      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      Gerar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: Clinical Decision Support */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Auxílio à Decisão Clínica</CardTitle>
                <Button onClick={handleAnalyzeCDS} disabled={analyzingCDS} size="sm" variant="outline" className="gap-1">
                  {analyzingCDS ? <Loader2 className="w-3 h-3 animate-spin" /> : <Stethoscope className="w-3 h-3" />}
                  Analisar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Clique em "Analisar" para obter alertas e sugestões clínicas.
                  </p>
                ) : (
                  alerts.map((alert) => {
                    const Icon = alertIcon[alert.alert_type] || AlertTriangle;
                    return (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border ${severityColor[alert.severity]}`}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{alert.title}</p>
                            <p className="text-xs mt-1 opacity-80">{alert.description}</p>
                            <Badge variant="outline" className="mt-2 text-xs">
                              {alert.alert_type === "drug_interaction" ? "Interação Medicamentosa" :
                               alert.alert_type === "differential_diagnosis" ? "Diagnóstico Diferencial" :
                               "Protocolo Sugerido"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
