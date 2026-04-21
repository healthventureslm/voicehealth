import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, Loader2, Keyboard, UserPlus, FileText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ReportTemplateDialog } from "@/components/ReportTemplateDialog";
import { ReportResult } from "@/components/ReportResult";
import { ClinicalDocumentCards, type ClinicalDocument } from "@/components/ClinicalDocumentCards";
import { TeleprompterPanel } from "@/components/consultation/TeleprompterPanel";
import { AudioRecorder } from "@/components/consultation/AudioRecorder";
import { PatientSectorSelector } from "@/components/consultation/PatientSectorSelector";
import { TranscriptionResult, type SessionTranscription } from "@/components/consultation/TranscriptionResult";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useScriptMatching, type ScriptField } from "@/hooks/useScriptMatching";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;
type Ward = Tables<"wards">;

type ProcessingStep = "idle" | "uploading" | "transcribing" | "analyzing" | "generating" | "editing" | "done";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  medico: "Médico",
  enfermeiro: "Enfermeiro(a)",
  tecnico: "Técnico(a)",
  farmaceutico: "Farmacêutico(a)",
  auditor: "Auditor(a)",
  fisioterapeuta: "Fisioterapeuta",
  nutricionista: "Nutricionista",
  fonoaudiologo: "Fonoaudiólogo(a)",
  psicologo: "Psicólogo(a)",
  assistente_social: "Assistente Social",
};

export default function NewConsultation() {
  const { user, profile, roles } = useAuth();
  const [searchParams] = useSearchParams();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedWard, setSelectedWard] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("idle");
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [clinicalDocuments, setClinicalDocuments] = useState<ClinicalDocument[]>([]);
  const [transcriptionContent, setTranscriptionContent] = useState<string | null>(null);
  const [departmentInfo, setDepartmentInfo] = useState<{ name: string; hospital_name?: string } | null>(null);
  const [captureMode, setCaptureMode] = useState<"audio" | "manual">("audio");
  const [manualTranscription, setManualTranscription] = useState("");
  const [submitMode, setSubmitMode] = useState<"audio" | "manual">("audio");
  const [showFallbackHint, setShowFallbackHint] = useState(false);
  const [sessionTranscriptions, setSessionTranscriptions] = useState<SessionTranscription[]>([]);
  const [consolidatedMode, setConsolidatedMode] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Teleprompter / Script state ──────────────────────────────────────────
  const [activeScript, setActiveScript] = useState<{ id: string; name: string; fields: ScriptField[] } | null>(null);
  const speechRecognition = useSpeechRecognition();
  const scriptFields = useScriptMatching(activeScript?.fields ?? null, speechRecognition.fullTranscript);

  useEffect(() => {
    const fetchAll = async () => {
      const [pRes, wRes] = await Promise.all([
        supabase.from("patients").select("*").order("full_name"),
        supabase.from("wards").select("*").eq("is_active", true).order("name"),
      ]);
      setPatients(pRes.data || []);
      setWards(wRes.data || []);

      const preselect = searchParams.get("patient");
      if (preselect) {
        setSelectedPatient(preselect);
        const p = pRes.data?.find((x) => x.id === preselect);
        if (p && p.current_ward_id) setSelectedWard(p.current_ward_id);
      }

      if (profile?.department_id) {
        const { data: dept } = await supabase.from("departments").select("name, hospital_name").eq("id", profile.department_id).single();
        if (dept) setDepartmentInfo(dept as any);
      }
    };
    fetchAll();
  }, [profile?.department_id]);

  useEffect(() => {
    if (selectedPatient) {
      const p = patients.find((x) => x.id === selectedPatient);
      if (p && p.current_ward_id) setSelectedWard(p.current_ward_id);
    }
  }, [selectedPatient, patients]);

  // Derive sector from ward name (best-effort)
  const detectedSector = (() => {
    const wardName = (wards.find((w) => w.id === selectedWard)?.name || "").toLowerCase();
    if (wardName.includes("uti") || wardName.includes("terapia intensiva")) return "uti";
    if (wardName.includes("emerg") || wardName.includes("pronto")) return "emergencia";
    if (wardName.includes("ambulat") || wardName.includes("consult")) return "ambulatorio";
    if (selectedWard) return "enfermaria";
    return null;
  })();

  // Load matching active script whenever the detected sector changes
  useEffect(() => {
    if (!detectedSector) { setActiveScript(null); return; }
    supabase
      .from("consultation_scripts" as any)
      .select("id, name, fields")
      .eq("is_active", true)
      .or(`sector.eq.${detectedSector},sector.is.null`)
      .order("sector", { ascending: false }) // sector-specific before generic
      .limit(1)
      .then(({ data }) => {
        const row = (data as any[])?.[0];
        if (row?.fields?.length) {
          setActiveScript({ id: row.id, name: row.name, fields: row.fields });
        } else {
          setActiveScript(null);
        }
      });
  }, [detectedSector]);

  const startRecording = async () => {
    try {
      if (navigator.permissions) {
        try {
          const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
          if (status.state === "denied") {
            toast.error("Microfone bloqueado. Habilite nas configurações do navegador.");
            return;
          }
        } catch { /* permissions API may not support microphone query */ }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : undefined;
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const finalType = mimeType || "audio/webm";
        setAudioBlob(new Blob(chunksRef.current, { type: finalType }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start(250);
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      // Start live speech recognition for teleprompter (if script is active)
      if (activeScript && speechRecognition.isSupported) {
        speechRecognition.reset();
        speechRecognition.start();
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        toast.error("Permissão negada. Permita o microfone nas configurações do navegador.");
      } else if (err.name === "NotFoundError") {
        toast.error("Nenhum microfone encontrado no dispositivo.");
      } else if (err.name === "NotReadableError") {
        toast.error("Microfone em uso por outro aplicativo.");
      } else {
        toast.error("Não foi possível acessar o microfone: " + (err.message || "Erro desconhecido"));
      }
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    speechRecognition.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleOpenTemplateDialog = (mode: "audio" | "manual") => {
    if (!selectedPatient) {
      toast.error("Selecione um paciente");
      return;
    }
    if (mode === "audio" && !audioBlob) {
      toast.error("Grave o áudio primeiro");
      return;
    }
    if (mode === "manual" && !manualTranscription.trim()) {
      toast.error("Digite ou cole a transcrição");
      return;
    }
    setSubmitMode(mode);
    setShowTemplateDialog(true);
  };

  const handleTranscribeOnly = async (mode: "audio" | "manual") => {
    if (!selectedPatient) { toast.error("Selecione um paciente"); return; }
    if (!user || !profile?.department_id) return;

    if (mode === "audio") {
      if (!audioBlob) { toast.error("Grave o áudio primeiro"); return; }
      setProcessingStep("uploading");
      try {
        const fileName = `${user.id}/${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage.from("audio-recordings").upload(fileName, audioBlob);
        if (uploadError) throw uploadError;

        setProcessingStep("transcribing");
        const insertData: any = {
          patient_id: selectedPatient,
          department_id: profile.department_id,
          professional_id: user.id,
          audio_url: fileName,
          status: "transcribing",
        };
        if (selectedWard) insertData.ward_id = selectedWard;

        const { data: consultation, error: consultError } = await supabase
          .from("consultations").insert(insertData).select().single();
        if (consultError) throw consultError;

        const { data: funcData, error: funcError } = await supabase.functions.invoke("transcribe-audio", {
          body: { consultation_id: consultation.id, audio_path: fileName, sector: detectedSector ?? undefined },
        });

        if (funcError) { toast.error("Erro: " + funcError.message); setProcessingStep("idle"); return; }
        if (funcData?.fallback) {
          toast.error("Transcrição automática indisponível. Use a aba 'Transcrição Manual'.");
          setProcessingStep("idle");
          setCaptureMode("manual");
          setShowFallbackHint(true);
          return;
        }

        setTranscriptionContent(funcData?.transcription || null);
        setProcessingStep("done");
        toast.success("Transcrição salva! Você pode gerar o relatório depois pelo histórico do paciente.");
      } catch (err: any) {
        toast.error(err.message || "Erro ao processar");
        setProcessingStep("idle");
      }
    } else {
      // Manual transcribe-only
      setProcessingStep("generating");
      try {
        const insertData: any = {
          patient_id: selectedPatient,
          department_id: profile.department_id,
          professional_id: user.id,
          status: "transcribed",
          raw_transcription: manualTranscription.trim(),
          edited_transcription: manualTranscription.trim(),
        };
        if (selectedWard) insertData.ward_id = selectedWard;

        await supabase.from("consultations").insert(insertData);
        setTranscriptionContent(manualTranscription.trim());
        setProcessingStep("done");
        toast.success("Transcrição salva! Gere o relatório consolidado pelo histórico do paciente.");
      } catch (err: any) {
        toast.error(err.message || "Erro ao salvar");
        setProcessingStep("idle");
      }
    }
  };

  // Analyze intents and generate documents from transcription
  const analyzeAndGenerateDocuments = async (consultationId: string, transcriptionText: string) => {
    setProcessingStep("analyzing");
    try {
      const { data: intentData, error: intentError } = await supabase.functions.invoke("analyze-clinical-intents", {
        body: { transcription: transcriptionText, user_roles: roles },
      });

      if (intentError) throw intentError;

      const intents = intentData?.intents || [];
      if (intents.length === 0) {
        return false; // No intents detected, fall back to normal report
      }

      setProcessingStep("generating");
      const { data: docData, error: docError } = await supabase.functions.invoke("generate-clinical-documents", {
        body: {
          consultation_id: consultationId,
          patient_id: selectedPatient,
          intents,
          transcription: transcriptionText,
        },
      });

      if (docError) throw docError;

      if (docData?.documents?.length > 0) {
        setClinicalDocuments(docData.documents);
        setTranscriptionContent(transcriptionText);
        setProcessingStep("done");
        toast.success(`${docData.documents.length} documento(s) clínico(s) gerado(s)!`);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error("Intent analysis error:", err);
      return false; // Fall back to normal report on error
    }
  };

  const handleSubmitWithTemplate = async (templateIds: string[]) => {
    const templateId = templateIds[0];
    if (!templateId || !selectedPatient || !user || !profile?.department_id) return;

    setShowTemplateDialog(false);

    if (submitMode === "manual") {
      await handleManualSubmit(templateId);
    } else {
      await handleAudioSubmit(templateId);
    }
  };

  const handleAudioSubmit = async (templateId: string) => {
    if (!audioBlob || !user || !profile?.department_id) return;

    setProcessingStep("uploading");
    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage.from("audio-recordings").upload(fileName, audioBlob);
      if (uploadError) throw uploadError;

      setProcessingStep("transcribing");

      const insertData: any = {
        patient_id: selectedPatient,
        department_id: profile.department_id,
        professional_id: user.id,
        audio_url: fileName,
        status: "transcribing",
        selected_template_id: templateId,
      };
      if (selectedWard) insertData.ward_id = selectedWard;

      const { data: consultation, error: consultError } = await supabase
        .from("consultations").insert(insertData).select().single();
      if (consultError) throw consultError;

      const { data: funcData, error: funcError } = await supabase.functions.invoke("transcribe-audio", {
        body: { consultation_id: consultation.id, audio_path: fileName, template_id: templateId, sector: detectedSector ?? undefined },
      });

      if (funcError) { toast.error("Erro: " + funcError.message); setProcessingStep("idle"); return; }
      if (funcData?.fallback) {
        toast.error("Transcrição automática indisponível. Use a aba 'Transcrição Manual'.");
        setProcessingStep("idle");
        setCaptureMode("manual");
        setShowFallbackHint(true);
        return;
      }

      const transcription = funcData?.transcription || funcData?.report || "";
      if (transcription) {
        // Try intent-based document generation first
        const intentSuccess = await analyzeAndGenerateDocuments(consultation.id, transcription);
        if (!intentSuccess) {
          // Fallback: use existing report if available, or just show transcription
          if (funcData?.report) {
            setReportContent(funcData.report);
            setTranscriptionContent(funcData.transcription || null);
          } else {
            setTranscriptionContent(transcription);
          }
          setProcessingStep("done");
          toast.success(funcData?.report ? "Relatório gerado!" : "Transcrição concluída.");
        }
      } else {
        toast.error("Resposta inesperada");
        setProcessingStep("idle");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar");
      setProcessingStep("idle");
    }
  };

  const handleManualSubmit = async (templateId: string) => {
    if (!user || !profile?.department_id || !manualTranscription.trim()) return;

    setProcessingStep("generating");
    try {
      const insertData: any = {
        patient_id: selectedPatient,
        department_id: profile.department_id,
        professional_id: user.id,
        status: "transcribed",
        selected_template_id: templateId,
        raw_transcription: manualTranscription.trim(),
        edited_transcription: manualTranscription.trim(),
      };
      if (selectedWard) insertData.ward_id = selectedWard;

      const { data: consultation, error: consultError } = await supabase
        .from("consultations").insert(insertData).select().single();
      if (consultError) throw consultError;

      // Try intent-based document generation first
      const intentSuccess = await analyzeAndGenerateDocuments(consultation.id, manualTranscription.trim());
      if (!intentSuccess) {
        // Fallback to normal report generation
        const { data: reportData, error: reportError } = await supabase.functions.invoke("generate-report", {
          body: { consultation_id: consultation.id, template_id: templateId, transcription: manualTranscription.trim() },
        });

        if (reportError) { toast.error("Erro ao gerar relatório: " + reportError.message); setProcessingStep("idle"); return; }

        if (reportData?.content) {
          setReportContent(reportData.content);
          setTranscriptionContent(manualTranscription.trim());
          setProcessingStep("done");
          toast.success("Relatório gerado com sucesso!");
        } else {
          toast.error(reportData?.error || "Erro ao gerar relatório");
          setProcessingStep("idle");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar");
      setProcessingStep("idle");
    }
  };

  // Fetch patient's recent transcriptions from DB
  const fetchPatientTranscriptions = useCallback(async (patientId: string) => {
    const { data } = await supabase
      .from("consultations")
      .select("id, raw_transcription, edited_transcription, ai_summary, created_at, status")
      .eq("patient_id", patientId)
      .neq("status", "recording")
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setSessionTranscriptions(
        data
          .filter((c) => c.edited_transcription || c.raw_transcription)
          .map((c) => ({
            id: c.id,
            text: c.edited_transcription || c.raw_transcription || "",
            created_at: c.created_at,
            selected: true,
          }))
      );
    }
  }, []);

  // When patient changes, load their transcriptions
  useEffect(() => {
    if (selectedPatient) {
      fetchPatientTranscriptions(selectedPatient);
    } else {
      setSessionTranscriptions([]);
    }
  }, [selectedPatient, fetchPatientTranscriptions]);

  const handleContinueWithPatient = () => {
    setAudioBlob(null);
    setDuration(0);
    setProcessingStep("idle");
    setReportContent(null);
    setClinicalDocuments([]);
    setTranscriptionContent(null);
    setManualTranscription("");
    setCaptureMode("audio");
    setShowFallbackHint(false);
    if (selectedPatient) fetchPatientTranscriptions(selectedPatient);
  };

  const handleNewPatient = () => {
    setAudioBlob(null);
    setDuration(0);
    setProcessingStep("idle");
    setReportContent(null);
    setClinicalDocuments([]);
    setTranscriptionContent(null);
    setSelectedPatient("");
    setSelectedWard("");
    setManualTranscription("");
    setCaptureMode("audio");
    setShowFallbackHint(false);
    setSessionTranscriptions([]);
    setConsolidatedMode(false);
  };

  const toggleTranscriptionSelection = (id: string) => {
    setSessionTranscriptions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleConsolidatedReport = () => {
    const selected = sessionTranscriptions.filter((t) => t.selected);
    if (selected.length < 2) {
      toast.error("Selecione pelo menos 2 transcrições para consolidar");
      return;
    }
    setConsolidatedMode(true);
    setShowTemplateDialog(true);
  };

  const handleConsolidatedSubmit = async (templateIds: string[]) => {
    const templateId = templateIds[0];
    if (!templateId) return;
    setShowTemplateDialog(false);
    setConsolidatedMode(false);
    setProcessingStep("generating");

    const selected = sessionTranscriptions
      .filter((t) => t.selected)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const transcriptions = selected.map((t, i) => ({
      text: t.text,
      date: new Date(t.created_at).toLocaleString("pt-BR"),
      index: i + 1,
    }));

    const lastId = selected[selected.length - 1].id;

    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { consultation_id: lastId, template_id: templateId, transcriptions },
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); setProcessingStep("idle"); return; }

      setReportContent(data?.content || null);
      setTranscriptionContent(selected.map((t) => t.text).join("\n\n---\n\n"));
      setProcessingStep("done");
      toast.success("Relatório consolidado gerado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar relatório");
      setProcessingStep("idle");
    }
  };

  // Keep old handleNewRecording as alias
  const handleNewRecording = handleNewPatient;

  const stepLabels: Record<ProcessingStep, string> = {
    idle: "", uploading: "Enviando áudio...", transcribing: "Transcrevendo áudio...", analyzing: "Analisando intenções clínicas...", generating: "Gerando documentos...", editing: "", done: "",
  };

  const isProcessing = processingStep !== "idle" && processingStep !== "done" && processingStep !== "editing";
  const selectedPatientObj = patients.find((p) => p.id === selectedPatient);
  const selectedWardObj = wards.find((w) => w.id === selectedWard);
  const primaryRole = roles[0];

  const reportMetadata = {
    hospitalName: departmentInfo?.hospital_name || departmentInfo?.name,
    professionalName: profile?.full_name || undefined,
    professionalRole: (profile as any)?.professional_role || (primaryRole ? ROLE_LABELS[primaryRole] || primaryRole : undefined),
    professionalRegistry: (profile as any)?.professional_registry || undefined,
    professionalRegistryType: (profile as any)?.professional_registry_type || undefined,
    patientName: selectedPatientObj?.full_name,
    medicalRecord: selectedPatientObj?.medical_record || undefined,
    bed: selectedPatientObj?.bed || undefined,
    wardName: selectedWardObj?.name,
    date: new Date().toLocaleString("pt-BR"),
  };

  return (
    <AppLayout>
      <div className={`p-6 lg:p-8 mx-auto transition-all duration-300 ${activeScript && isRecording ? "max-w-5xl" : "max-w-2xl"}`}>
      <div className={`${activeScript && isRecording ? "grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start" : "space-y-6"}`}><div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nova Gravação</h1>
          <p className="text-muted-foreground">Grave o atendimento para transcrição automática</p>
        </div>

        {processingStep === "done" && (
          clinicalDocuments.length > 0 ? (
            <ClinicalDocumentCards
              documents={clinicalDocuments}
              onContinue={handleContinueWithPatient}
              onNewPatient={handleNewPatient}
            />
          ) : (
            <ReportResult
              report={reportContent || transcriptionContent || "Nenhum conteúdo gerado."}
              transcription={reportContent ? transcriptionContent || undefined : undefined}
              onNewRecording={handleNewRecording}
              metadata={reportMetadata}
            />
          )
        )}

        {/* Post-generation action buttons */}
        {processingStep === "done" && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4 space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                Você pode gerar mais relatórios com esta transcrição, gravar mais para este paciente ou iniciar um novo atendimento.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button onClick={() => {
                  setSubmitMode(transcriptionContent ? "manual" : "audio");
                  setShowTemplateDialog(true);
                }} className="gap-2">
                  <FileText className="w-4 h-4" /> Gerar Mais Relatórios
                </Button>
                <Button variant="outline" onClick={handleContinueWithPatient} className="gap-2">
                  <Mic className="w-4 h-4" /> Gravar Mais
                </Button>
                <Button variant="outline" onClick={() => {
                  setManualTranscription(transcriptionContent || "");
                  setProcessingStep("editing");
                }} className="gap-2">
                  <Pencil className="w-4 h-4" /> Editar Transcrição
                </Button>
                <Button variant="ghost" onClick={handleNewPatient} className="gap-2">
                  <UserPlus className="w-4 h-4" /> Novo Paciente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {processingStep === "editing" && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Pencil className="w-5 h-5" /> Editar Transcrição</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                className="min-h-[200px]"
                value={manualTranscription}
                onChange={(e) => setManualTranscription(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setProcessingStep("done")}>Cancelar</Button>
                <Button onClick={() => {
                  setTranscriptionContent(manualTranscription.trim());
                  setSubmitMode("manual");
                  setShowTemplateDialog(true);
                }} className="gap-2">
                  <FileText className="w-4 h-4" /> Gerar Relatório com Texto Editado
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isProcessing && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-lg font-medium text-foreground">{stepLabels[processingStep]}</p>
              <p className="text-sm text-muted-foreground">Aguarde, isso pode levar alguns segundos...</p>
            </CardContent>
          </Card>
        )}

        {processingStep === "idle" && (
          <>
            <PatientSectorSelector
              patients={patients}
              wards={wards}
              selectedPatient={selectedPatient}
              selectedWard={selectedWard}
              onPatientChange={setSelectedPatient}
              onWardChange={setSelectedWard}
            />

            {/* Mini-histórico de transcrições acumuladas */}
            <TranscriptionResult
              sessionTranscriptions={sessionTranscriptions}
              onToggleSelection={toggleTranscriptionSelection}
              onConsolidatedReport={handleConsolidatedReport}
            />

            <Card>
              <CardHeader><CardTitle>Captura do Atendimento</CardTitle></CardHeader>
              <CardContent>
                <Tabs value={captureMode} onValueChange={(v) => setCaptureMode(v as "audio" | "manual")}>
                  <TabsList className="w-full">
                    <TabsTrigger value="audio" className="flex-1 gap-2">
                      <Mic className="w-4 h-4" /> Gravação de Áudio
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="flex-1 gap-2">
                      <Keyboard className="w-4 h-4" /> Transcrição Manual
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="audio">
                    <AudioRecorder
                      isRecording={isRecording}
                      duration={duration}
                      audioBlob={audioBlob}
                      onStart={startRecording}
                      onStop={stopRecording}
                      onRecordingComplete={handleOpenTemplateDialog}
                      onTranscribeOnly={handleTranscribeOnly}
                      onReset={() => { setAudioBlob(null); setDuration(0); }}
                    />
                  </TabsContent>

                  <TabsContent value="manual" className="space-y-4 py-4">
                    {showFallbackHint && (
                      <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
                        ⚠️ O serviço de transcrição automática está temporariamente indisponível. Digite ou cole a transcrição abaixo para continuar.
                      </div>
                    )}
                    <Textarea
                      placeholder="Digite ou cole a transcrição do atendimento aqui..."
                      className="min-h-[200px]"
                      value={manualTranscription}
                      onChange={(e) => setManualTranscription(e.target.value)}
                    />
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {manualTranscription.length} caracteres
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleTranscribeOnly("manual")}
                          disabled={!manualTranscription.trim()}
                        >
                          Apenas Salvar
                        </Button>
                        <Button
                          onClick={() => handleOpenTemplateDialog("manual")}
                          disabled={!manualTranscription.trim()}
                          className="gap-2"
                        >
                          Salvar + Relatório
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </div>{/* /space-y-6 content column */}

      {/* Teleprompter — right column in grid mode, hidden otherwise */}
      {activeScript && (
        <div className={`${isRecording ? "block" : "hidden lg:block"} sticky top-6`}>
          <TeleprompterPanel
            scriptName={activeScript.name}
            fields={scriptFields}
            isListening={speechRecognition.isListening}
          />
        </div>
      )}
      </div>{/* /grid or space-y wrapper */}
      </div>{/* /outer padding container */}

      <ReportTemplateDialog
        open={showTemplateDialog}
        onClose={() => { setShowTemplateDialog(false); setConsolidatedMode(false); }}
        onSubmit={consolidatedMode ? handleConsolidatedSubmit : handleSubmitWithTemplate}
        isSubmitting={false}
      />
    </AppLayout>
  );
}
