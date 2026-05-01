import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  usePatients, useCreateConsultation, useUpdateConsultation,
} from "@/hooks/queries";
import { AudioRecorder } from "@/components/consultation/AudioRecorder";
import { TemplatePicker } from "@/components/consultation/TemplatePicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

type ProcessingStep = "idle" | "uploading" | "transcribing" | "generating" | "done";

export default function NewConsultation() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, hospitalIds, roles } = useAuth();
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
          `Transcrição automática falhou: ${reason}. Você pode editar manualmente o atendimento.`,
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
      toast.success("Atendimento registrado");
      navigate(`/consultations/${consultation.id}/report`);
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
      toast.error("Escreva o conteúdo do atendimento");
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

      toast.success("Atendimento registrado");
      navigate(`/consultations/${consultation.id}/report`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? String(e));
      toast.error("Erro ao salvar atendimento");
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>

        <h1 className="heading-page">Novo atendimento</h1>

        <Card>
          <CardHeader>
            <CardTitle className="heading-card">Paciente & Template</CardTitle>
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
            />
          </CardContent>
        </Card>

        {selectedPatient && (
          <Card>
            <CardHeader>
              <CardTitle className="heading-card">Conteúdo do atendimento</CardTitle>
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
                    <AudioRecorder onComplete={handleAudioComplete} />
                  )}
                </TabsContent>

                <TabsContent value="manual" className="mt-4 space-y-3">
                  <Textarea
                    rows={8}
                    placeholder="Digite ou cole o texto do atendimento aqui..."
                    value={manualTranscript}
                    onChange={(e) => setManualTranscript(e.target.value)}
                  />
                  <Button
                    onClick={handleManualSubmit}
                    disabled={createConsultation.isPending}
                    className="gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Salvar atendimento
                  </Button>
                </TabsContent>
              </Tabs>

              {error && (
                <p className="text-sm text-destructive mt-3">{error}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
