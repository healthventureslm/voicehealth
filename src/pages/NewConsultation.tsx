import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  usePatients, useCreateConsultation, useUpdateConsultation,
  useConsultationScripts, useTemplates, usePatientTranscriptHistory,
} from "@/hooks/queries";
import { AudioRecorder, type RecordingState } from "@/components/consultation/AudioRecorder";
import { TemplatePicker } from "@/components/consultation/TemplatePicker";
import { TeleprompterPanel } from "@/components/consultation/TeleprompterPanel";
import { LiveTranscriptView } from "@/components/consultation/LiveTranscriptView";
import { useRealtimeTranscription } from "@/hooks/useRealtimeTranscription";
import { useScriptMatching } from "@/hooks/useScriptMatching";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

type ProcessingStep = "idle" | "uploading" | "transcribing" | "generating" | "done";

export default function NewConsultation() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, hospitalIds, roles, wardIds, isSuperAdmin } = useAuth();
  const { data: patients } = usePatients();
  const createConsultation = useCreateConsultation();
  const updateConsultation = useUpdateConsultation();

  const [selectedPatient, setSelectedPatient] = useState<string>(params.get("patient") ?? "");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [manualTranscript, setManualTranscript] = useState("");
  const [step, setStep] = useState<ProcessingStep>("idle");
  const [error, setError] = useState<string | null>(null);

  const role: Enums<"app_role"> = (roles[0]?.role ?? "doctor") as Enums<"app_role">;

  const patient = useMemo(
    () => (patients ?? []).find((p) => p.id === selectedPatient),
    [patients, selectedPatient],
  );

  const wardType = patient?.current_ward?.ward_type as Enums<"ward_type"> | undefined;
  const wardId = patient?.current_ward?.id ?? null;
  const hospitalId = hospitalIds[0];

  // Pode atender? Mesma regra da PatientHistory (super, hospital_admin, ou ward atribuído)
  const canAttendPatient = useMemo(() => {
    if (!patient || !wardId) return false;
    if (isSuperAdmin) return true;
    const isHospitalAdmin = roles.some(
      (r) => r.role === "hospital_admin" && r.hospital_id === patient.hospital_id,
    );
    if (isHospitalAdmin) return true;
    return wardIds.includes(wardId);
  }, [patient, wardId, isSuperAdmin, roles, wardIds]);

  // Pre-select se vier ?patient=
  useEffect(() => {
    const fromParams = params.get("patient");
    if (fromParams && patients?.some((p) => p.id === fromParams)) {
      setSelectedPatient(fromParams);
    }
  }, [params, patients]);

  async function uploadAudio(blob: Blob): Promise<string | null> {
    if (!user || !hospitalId) return null;
    const ts = Date.now();
    const path = `${hospitalId}/${wardId ?? "no-ward"}/${user.id}/${ts}.webm`;
    const { error } = await supabase.storage
      .from("audio-recordings")
      .upload(path, blob, { contentType: blob.type || "audio/webm" });
    if (error) {
      console.error("upload error", error);
      throw error;
    }
    return path;
  }

  async function handleAudioComplete(blob: Blob, durationSeconds: number) {
    if (!user || !patient || !wardId || !hospitalId) {
      setError("Selecione um paciente válido com setor.");
      return;
    }
    setError(null);
    setStep("uploading");
    try {
      const audioPath = await uploadAudio(blob);

      // 1) Cria consulta status=transcribing
      const consultation = await createConsultation.mutateAsync({
        hospital_id: hospitalId,
        patient_id: patient.id,
        ward_id: wardId,
        professional_id: user.id,
        template_id: templateId,
        audio_url: audioPath,
        audio_duration_seconds: durationSeconds,
        status: "transcribing",
      });

      setStep("transcribing");

      // 2) Chama edge function transcribe-audio
      const { data: trData, error: trErr } = await supabase.functions.invoke("transcribe-audio", {
        body: { consultation_id: consultation.id, audio_path: audioPath },
      });

      // Detecta TODOS os tipos de falha:
      //  - erro HTTP da function
      //  - resposta com campo `error`
      //  - transcription faltando ou vazia
      const transcription: string = trData?.transcription?.trim() ?? "";
      const hasError = !!trErr || !!trData?.error || !transcription;

      if (hasError) {
        const reason =
          trData?.error ??
          trErr?.message ??
          "Áudio não pôde ser transcrito (vazio ou inaudível).";
        console.error("[transcribe-audio] falhou:", reason, trData);
        await updateConsultation.mutateAsync({
          id: consultation.id,
          patch: { status: "editing" },
        });
        toast.warning(
          `Transcrição automática falhou: ${reason}. Você pode editar manualmente a gravação.`,
        );
        setStep("idle");
        navigate(`/consultations/${consultation.id}/edit`);
        return;
      }

      await updateConsultation.mutateAsync({
        id: consultation.id,
        patch: {
          raw_transcription: transcription,
          edited_transcription: transcription,
          status: "transcribed",
        },
      });

      // 3) Chama generate-report (se template)
      if (templateId) {
        setStep("generating");
        const { error: grErr } = await supabase.functions.invoke("generate-report", {
          body: {
            consultation_id: consultation.id,
            template_id: templateId,
            transcription,
          },
        });
        if (grErr) {
          toast.warning("Não foi possível gerar relatório automaticamente.");
        }
      }

      await updateConsultation.mutateAsync({
        id: consultation.id,
        patch: { status: "completed", completed_at: new Date().toISOString() },
      });

      setStep("done");
      if (templateId) {
        toast.success("Gravação registrada");
        navigate(`/consultations/${consultation.id}/report`);
      } else {
        toast.success("Gravação salva");
        navigate(`/patients/${patient.id}/history`);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? String(e));
      setStep("idle");
      toast.error("Erro ao processar gravação");
    }
  }

  async function handleManualSubmit() {
    if (!user || !patient || !wardId || !hospitalId) {
      setError("Selecione um paciente válido com setor.");
      return;
    }
    if (!manualTranscript.trim()) {
      toast.error("Escreva o conteúdo da gravação");
      return;
    }
    try {
      const consultation = await createConsultation.mutateAsync({
        hospital_id: hospitalId,
        patient_id: patient.id,
        ward_id: wardId,
        professional_id: user.id,
        template_id: templateId,
        edited_transcription: manualTranscript.trim(),
        raw_transcription: manualTranscript.trim(),
        status: "transcribed",
      });

      if (templateId) {
        setStep("generating");
        await supabase.functions.invoke("generate-report", {
          body: {
            consultation_id: consultation.id,
            template_id: templateId,
            transcription: manualTranscript.trim(),
          },
        });
      }

      await updateConsultation.mutateAsync({
        id: consultation.id,
        patch: { status: "completed", completed_at: new Date().toISOString() },
      });

      if (templateId) {
        toast.success("Gravação registrada");
        navigate(`/consultations/${consultation.id}/report`);
      } else {
        toast.success("Gravação salva");
        navigate(`/patients/${patient.id}/history`);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? String(e));
      toast.error("Erro ao salvar gravação");
    }
  }


  // Roteiro/teleprompter — pareia com o template selecionado (por nome)
  const { data: templates } = useTemplates({ wardType, role });
  const selectedTemplate = useMemo(
    () => (templates ?? []).find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );
  const { data: scripts } = useConsultationScripts({
    wardType,
    templateName: selectedTemplate?.name,
  });
  const activeScript = useMemo(() => {
    if (!selectedTemplate || !scripts || scripts.length === 0) return null;
    // Match exato por nome (pareamento 1:1 com template)
    return scripts.find((s) => s.name === selectedTemplate.name) ?? null;
  }, [selectedTemplate, scripts]);

  // Transcrição em tempo real (Web Speech API) — só pra UX, não substitui Whisper
  const {
    transcript: liveTranscript,
    interimTranscript,
    isListening,
    isSupported: speechSupported,
    start: startListening,
    stop: stopListening,
    reset: resetTranscript,
  } = useRealtimeTranscription("pt-BR");

  // Histórico de transcrições do paciente — pré-marca pontos já cobertos
  // em gravações anteriores, evitando que o profissional repita info.
  const { data: history } = usePatientTranscriptHistory(selectedPatient || null);
  const historyTranscript = history?.combined ?? "";
  const historyCount = history?.consultationCount ?? 0;

  const matchedFields = useScriptMatching(
    activeScript?.fields ?? null,
    `${historyTranscript} ${liveTranscript} ${interimTranscript}`,
  );

  // Conta quantos pontos JÁ estavam cobertos só pelo histórico (sem fala atual).
  // Usado pra mostrar pré-marcação como hint no teleprompter.
  const historyOnlyCovered = useScriptMatching(
    activeScript?.fields ?? null,
    historyTranscript,
  );
  const historyCoveredCount = historyOnlyCovered.filter((f) => f.covered).length;

  // Diálogo de pontos obrigatórios faltando — bloqueia "Usar esta gravação"
  // quando há requireds não cobertos. Promise resolve true = finalizar mesmo
  // assim, false = voltar e continuar gravando.
  const [missingPoints, setMissingPoints] = useState<string[]>([]);
  const [missingDialogOpen, setMissingDialogOpen] = useState(false);
  const [resolveMissing, setResolveMissing] = useState<((v: boolean) => void) | null>(null);

  function validateBeforeFinalize(): boolean | Promise<boolean> {
    if (!activeScript) return true;
    const missing = matchedFields
      .filter((f) => f.required && !f.covered)
      .map((f) => f.label);
    if (missing.length === 0) return true;
    return new Promise<boolean>((resolve) => {
      setMissingPoints(missing);
      setResolveMissing(() => resolve);
      setMissingDialogOpen(true);
    });
  }

  function answerMissingDialog(proceed: boolean) {
    setMissingDialogOpen(false);
    resolveMissing?.(proceed);
    setResolveMissing(null);
  }

  // Liga/desliga reconhecimento conforme estado da gravação.
  // Reseta o transcript SÓ quando começa uma gravação nova (idle → recording).
  // Em pause/reviewing → recording é retomada: preserva o texto pra que
  // os pontos já marcados no teleprompter continuem marcados.
  const prevRecorderStateRef = useRef<RecordingState>("idle");
  function handleRecordingStateChange(s: RecordingState) {
    const prev = prevRecorderStateRef.current;
    prevRecorderStateRef.current = s;
    if (!activeScript || !speechSupported) return;
    if (s === "recording") {
      if (!isListening) {
        if (prev === "idle") resetTranscript();
        startListening();
      }
    } else if (s === "paused" || s === "stopped" || s === "reviewing" || s === "idle") {
      if (isListening) stopListening();
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          back
          title="Nova gravação"
          subtitle="Selecione o paciente e o template do documento que vai gerar — o teleprompter mostra o que precisa ser falado."
        />

        <Card>
          <CardHeader>
            <CardTitle className="heading-card">Paciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Paciente *</Label>
              <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(patients ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                      {p.bed && ` · Leito ${p.bed}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => navigate("/patients?new=1")}
                className="text-xs mt-1.5 inline-flex items-center gap-1 text-enf hover:text-enf-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enf rounded"
              >
                <span aria-hidden>+</span> Cadastrar novo paciente
              </button>
              {patient?.current_ward && (
                <p className="text-xs text-muted-foreground mt-1">
                  Setor atual: {patient.current_ward.name}
                </p>
              )}
            </div>

            <TemplatePicker
              value={templateId}
              onChange={setTemplateId}
              wardType={wardType}
              role={role}
              required
            />
            <p className="text-xs text-muted-foreground -mt-1">
              Define o documento que vai ser gerado a partir desta gravação.
            </p>
          </CardContent>
        </Card>

        {selectedPatient && !canAttendPatient && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-4 text-sm">
              Você não está atribuído ao setor onde este paciente está
              {patient?.current_ward?.name && (
                <> (<strong>{patient.current_ward.name}</strong>)</>
              )}
              . Não é possível registrar uma nova gravação.
              Peça ao admin do hospital pra atribuir este setor a você
              em <code>/admin/users</code>, ou selecione outro paciente.
            </CardContent>
          </Card>
        )}

        {selectedPatient && canAttendPatient && !templateId && (
          <Card className="border-dashed">
            <CardContent className="py-6 text-sm text-muted-foreground text-center">
              Selecione um <strong>template</strong> acima pra começar a gravação.
              O roteiro do teleprompter aparece de acordo com o template escolhido.
            </CardContent>
          </Card>
        )}

        {selectedPatient && canAttendPatient && templateId && (
          <Card>
            <CardHeader>
              <CardTitle className="heading-card">
                Conteúdo da gravação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="audio" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="audio">Gravação de áudio</TabsTrigger>
                  <TabsTrigger value="manual">Texto manual</TabsTrigger>
                </TabsList>

                <TabsContent value="audio" className="mt-4">
                  {step !== "idle" && step !== "done" ? (
                    <div className="border rounded-lg p-6 flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-sm">
                        {step === "uploading" && "Enviando áudio…"}
                        {step === "transcribing" && "Transcrevendo…"}
                        {step === "generating" && "Gerando relatório…"}
                      </span>
                    </div>
                  ) : (
                    <div
                      className={
                        activeScript
                          ? "grid gap-4 lg:grid-cols-[1fr_360px]"
                          : ""
                      }
                    >
                      <div className="flex flex-col gap-3 min-h-0">
                        <AudioRecorder
                          onComplete={handleAudioComplete}
                          onStateChange={handleRecordingStateChange}
                          validateBeforeFinalize={validateBeforeFinalize}
                        />
                        {speechSupported && activeScript && (
                          <LiveTranscriptView
                            transcript={liveTranscript}
                            interimTranscript={interimTranscript}
                            isListening={isListening}
                          />
                        )}
                      </div>
                      {activeScript && (
                        <div className="space-y-2">
                          <TeleprompterPanel
                            scriptName={activeScript.name}
                            fields={matchedFields}
                            isListening={isListening}
                            historyConsultationCount={historyCount}
                            historyCoveredCount={historyCoveredCount}
                          />
                          {!speechSupported && (
                            <p className="text-xs text-muted-foreground px-1">
                              Transcrição em tempo real indisponível neste navegador.
                              Use Chrome ou Edge para ver os pontos sendo riscados conforme você fala.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="manual" className="mt-4 space-y-3">
                  <Textarea
                    rows={8}
                    placeholder="Digite ou cole o texto da gravação aqui..."
                    value={manualTranscript}
                    onChange={(e) => setManualTranscript(e.target.value)}
                  />
                  <Button
                    onClick={handleManualSubmit}
                    disabled={createConsultation.isPending}
                    className="gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Salvar gravação
                  </Button>
                </TabsContent>
              </Tabs>

              {error && (
                <p className="text-sm text-destructive mt-3">{error}</p>
              )}
            </CardContent>
          </Card>
        )}

        <AlertDialog
          open={missingDialogOpen}
          onOpenChange={(o) => {
            if (!o) answerMissingDialog(false);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Pontos obrigatórios não cobertos
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    {missingPoints.length === 1
                      ? "Um ponto obrigatório do roteiro ainda precisa ser mencionado antes de finalizar:"
                      : `${missingPoints.length} pontos obrigatórios do roteiro ainda precisam ser mencionados antes de finalizar:`}
                  </p>
                  <ul className="space-y-1 text-sm border-l-2 border-warning pl-3">
                    {missingPoints.map((label) => (
                      <li key={label} className="text-foreground">
                        {label}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    O recomendado é voltar e cobrir esses pontos — o teleprompter
                    marca cada um conforme você fala. Você também pode finalizar
                    assim mesmo, se for o caso.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-between gap-2">
              <AlertDialogCancel
                onClick={() => answerMissingDialog(true)}
                className="mt-0"
              >
                Finalizar mesmo assim
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => answerMissingDialog(false)}>
                Voltar e gravar mais
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </AppLayout>
  );
}
