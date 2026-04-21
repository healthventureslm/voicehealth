import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, Square, Loader2, Stethoscope, Keyboard } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { OfflineBanner } from "@/components/OfflineIndicator";
import { toast } from "sonner";
import { ReportTemplateDialog } from "@/components/ReportTemplateDialog";
import { ReportResult } from "@/components/ReportResult";
import { ClinicalDocumentCards, type ClinicalDocument } from "@/components/ClinicalDocumentCards";
import { TeleprompterPanel, checkPendingFields } from "@/components/consultation/TeleprompterPanel";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useScriptMatching, type ScriptField } from "@/hooks/useScriptMatching";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;
type Specialty = Tables<"medical_specialties">;

type ProcessingStep = "idle" | "uploading" | "transcribing" | "analyzing" | "generating" | "done";

export default function AmbulatoryNewConsultation() {
  const { user, profile, roles } = useAuth();
  const { isOnline, pendingCount, saveOffline } = useOfflineSync();
  const [searchParams] = useSearchParams();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState(searchParams.get("specialty") || "");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("idle");
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [clinicalDocuments, setClinicalDocuments] = useState<ClinicalDocument[]>([]);
  const [transcriptionContent, setTranscriptionContent] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<"audio" | "manual">("audio");
  const [manualTranscription, setManualTranscription] = useState("");
  const [submitMode, setSubmitMode] = useState<"audio" | "manual">("audio");
  const [showFallbackHint, setShowFallbackHint] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Teleprompter / Script state ──────────────────────────────────────────
  const [activeScript, setActiveScript] = useState<{ id: string; name: string; fields: ScriptField[] } | null>(null);
  const speechRecognition = useSpeechRecognition();
  const scriptFields = useScriptMatching(activeScript?.fields ?? null, speechRecognition.fullTranscript);

  useEffect(() => {
    Promise.all([
      supabase.from("patients").select("*").order("full_name"),
      supabase.from("medical_specialties").select("*").eq("is_active", true).order("name"),
    ]).then(([pRes, sRes]) => {
      setPatients(pRes.data || []);
      setSpecialties(sRes.data || []);
    });
  }, []);

  // Load ambulatory script on mount
  useEffect(() => {
    supabase
      .from("consultation_scripts" as any)
      .select("id, name, fields")
      .eq("is_active", true)
      .or("sector.eq.ambulatorio,sector.is.null")
      .order("sector", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const row = (data as any[])?.[0];
        if (row?.fields?.length) {
          setActiveScript({ id: row.id, name: row.name, fields: row.fields });
        } else {
          setActiveScript(null);
        }
      });
  }, []);

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
      // Start live speech recognition for teleprompter
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
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    speechRecognition.stop();
  };

  const [pendingFieldsConfirmed, setPendingFieldsConfirmed] = useState(false);

  const handleOpenTemplateDialog = (mode: "audio" | "manual") => {
    if (!selectedPatient || !selectedSpecialty) {
      toast.error("Selecione paciente e especialidade");
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
    // Check pending required fields from teleprompter
    if (activeScript && scriptFields.length > 0 && !pendingFieldsConfirmed) {
      const canProceed = checkPendingFields(scriptFields, (pendingLabels) => {
        toast.warning(`${pendingLabels.length} campo(s) obrigatório(s) pendente(s): ${pendingLabels.join(", ")}. Clique novamente para continuar mesmo assim.`, {
          duration: 6000,
        });
        setPendingFieldsConfirmed(true);
        // Auto-reset confirmation after 10 seconds
        setTimeout(() => setPendingFieldsConfirmed(false), 10000);
      });
      if (!canProceed) return;
    }
    setPendingFieldsConfirmed(false);
    setSubmitMode(mode);
    setShowTemplateDialog(true);
  };

  const analyzeAndGenerateDocuments = async (consultationId: string, transcriptionText: string) => {
    setProcessingStep("analyzing");
    try {
      const { data: intentData, error: intentError } = await supabase.functions.invoke("analyze-clinical-intents", {
        body: { transcription: transcriptionText, user_roles: roles },
      });
      if (intentError) throw intentError;
      const intents = intentData?.intents || [];
      if (intents.length === 0) return false;

      setProcessingStep("generating");
      const { data: docData, error: docError } = await supabase.functions.invoke("generate-clinical-documents", {
        body: { consultation_id: consultationId, patient_id: selectedPatient, intents, transcription: transcriptionText },
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
      return false;
    }
  };

  const handleSubmitWithTemplate = async (templateIds: string[]) => {
    const templateId = templateIds[0];
    if (!templateId || !selectedPatient || !selectedSpecialty || !user || !profile?.department_id) return;
    setShowTemplateDialog(false);
    if (submitMode === "manual") await handleManualSubmit(templateId);
    else await handleAudioSubmit(templateId);
  };

  const handleAudioSubmit = async (templateId: string) => {
    if (!audioBlob || !user || !profile?.department_id) return;

    if (!isOnline) {
      await saveOffline({
        audioBlob,
        patientId: selectedPatient,
        departmentId: profile.department_id,
        userId: user.id,
        specialtyId: selectedSpecialty,
        templateId,
      });
      handleNewRecording();
      return;
    }
    setProcessingStep("uploading");
    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage.from("audio-recordings").upload(fileName, audioBlob);
      if (uploadError) throw uploadError;

      setProcessingStep("transcribing");

      const { data: consultation, error: consultError } = await supabase
        .from("consultations")
        .insert({
          patient_id: selectedPatient,
          department_id: profile.department_id,
          professional_id: user.id,
          audio_url: fileName,
          status: "transcribing",
          specialty_id: selectedSpecialty,
          selected_template_id: templateId,
        })
        .select()
        .single();
      if (consultError) throw consultError;

      const { data: funcData, error: funcError } = await supabase.functions.invoke("transcribe-audio", {
        body: { consultation_id: consultation.id, audio_path: fileName, template_id: templateId },
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
        const intentSuccess = await analyzeAndGenerateDocuments(consultation.id, transcription);
        if (!intentSuccess) {
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
        toast.error("Resposta inesperada do servidor");
        setProcessingStep("idle");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar");
      setProcessingStep("idle");
    }
  };

  const handleManualSubmit = async (templateId: string) => {
    if (!user || !profile?.department_id || !manualTranscription.trim()) return;

    if (!isOnline) {
      await saveOffline({
        audioBlob: new Blob([], { type: "text/plain" }),
        patientId: selectedPatient,
        departmentId: profile.department_id,
        userId: user.id,
        specialtyId: selectedSpecialty,
        templateId,
        manualTranscription: manualTranscription.trim(),
      });
      handleNewRecording();
      return;
    }
    setProcessingStep("generating");
    try {
      const { data: consultation, error: consultError } = await supabase
        .from("consultations")
        .insert({
          patient_id: selectedPatient,
          department_id: profile.department_id,
          professional_id: user.id,
          status: "transcribed",
          specialty_id: selectedSpecialty,
          selected_template_id: templateId,
          raw_transcription: manualTranscription.trim(),
          edited_transcription: manualTranscription.trim(),
        })
        .select()
        .single();
      if (consultError) throw consultError;

      const intentSuccess = await analyzeAndGenerateDocuments(consultation.id, manualTranscription.trim());
      if (!intentSuccess) {
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

  const handleNewRecording = () => {
    setAudioBlob(null);
    setDuration(0);
    setProcessingStep("idle");
    setReportContent(null);
    setClinicalDocuments([]);
    setTranscriptionContent(null);
    setSelectedPatient("");
    setManualTranscription("");
    setCaptureMode("audio");
    setShowFallbackHint(false);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const selectedSpec = specialties.find((s) => s.id === selectedSpecialty);

  const stepLabels: Record<ProcessingStep, string> = {
    idle: "", uploading: "Enviando áudio...", transcribing: "Transcrevendo áudio...", analyzing: "Analisando intenções clínicas...", generating: "Gerando documentos...", done: "",
  };

  const isProcessing = processingStep !== "idle" && processingStep !== "done";

  return (
    <AppLayout>
      <div className={`p-4 md:p-6 lg:p-8 mx-auto transition-all duration-300 ${activeScript ? "max-w-5xl" : "max-w-2xl"}`}>
      <div className={`${activeScript ? "grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start" : ""}`}><div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Nova Consulta Ambulatorial</h1>
          <p className="text-muted-foreground text-sm">Selecione especialidade, paciente e grave o atendimento</p>
        </div>

        <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} />

        {processingStep === "done" ? (
          clinicalDocuments.length > 0 ? (
            <ClinicalDocumentCards
              documents={clinicalDocuments}
              onContinue={handleNewRecording}
              onNewPatient={handleNewRecording}
            />
          ) : (
            <ReportResult
              report={reportContent || transcriptionContent || "Nenhum conteúdo gerado."}
              transcription={reportContent ? transcriptionContent || undefined : undefined}
              onNewRecording={handleNewRecording}
              metadata={{
                professionalName: profile?.full_name || undefined,
                professionalRegistry: (profile as any)?.professional_registry || undefined,
                professionalRegistryType: (profile as any)?.professional_registry_type || undefined,
                date: new Date().toLocaleString("pt-BR"),
              }}
            />
          )
        ) : isProcessing ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-lg font-medium text-foreground">{stepLabels[processingStep]}</p>
              <p className="text-sm text-muted-foreground">Aguarde, isso pode levar alguns segundos...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Especialidade</CardTitle></CardHeader>
              <CardContent>
                <Label className="text-sm">Selecione a especialidade *</Label>
                <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                  <SelectTrigger><SelectValue placeholder="Escolha a especialidade" /></SelectTrigger>
                  <SelectContent>
                    {specialties.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSpec && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Stethoscope className="w-3 h-3" /> {selectedSpec.description}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Paciente</CardTitle></CardHeader>
              <CardContent>
                <Label className="text-sm">Selecione o paciente *</Label>
                <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                  <SelectTrigger><SelectValue placeholder="Escolha um paciente" /></SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name} {p.bed ? `• Leito ${p.bed}` : ""} {p.medical_record ? `• ${p.medical_record}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Captura do Atendimento</CardTitle></CardHeader>
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

                  <TabsContent value="audio" className="flex flex-col items-center gap-4 py-6">
                    <div className="text-4xl font-mono font-bold text-foreground">{formatTime(duration)}</div>
                    {!audioBlob ? (
                      <Button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`w-20 h-20 rounded-full ${isRecording ? "bg-destructive hover:bg-destructive/90" : "gradient-primary hover:opacity-90"} border-0`}
                        size="icon"
                      >
                        {isRecording ? <Square className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
                      </Button>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-success font-medium text-sm">✓ Áudio gravado ({formatTime(duration)})</p>
                        <div className="flex gap-3">
                          <Button variant="outline" size="sm" onClick={() => { setAudioBlob(null); setDuration(0); }}>Regravar</Button>
                          <Button size="sm" onClick={() => handleOpenTemplateDialog("audio")} className="gap-2">
                            Escolher Relatório e Enviar
                          </Button>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground text-center">
                      {isRecording ? "Gravando... Clique para parar." : audioBlob ? "" : "Clique para iniciar a gravação"}
                    </p>
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
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        {manualTranscription.length} caracteres
                      </span>
                      <Button
                        onClick={() => handleOpenTemplateDialog("manual")}
                        disabled={!manualTranscription.trim()}
                        className="gap-2"
                      >
                        Escolher Relatório e Enviar
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Teleprompter — right column in grid mode */}
      {activeScript && (
        <div className={`${isRecording ? "block" : "hidden lg:block"} sticky top-6`}>
          <TeleprompterPanel
            scriptName={activeScript.name}
            fields={scriptFields}
            isListening={speechRecognition.isListening}
          />
        </div>
      )}
      </div>
      </div>

      <ReportTemplateDialog
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        onSubmit={handleSubmitWithTemplate}
        isSubmitting={false}
      />
    </AppLayout>
  );
}
