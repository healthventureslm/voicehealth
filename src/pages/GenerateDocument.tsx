import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  usePatients, usePatientNotes,
} from "@/hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { TemplatePicker } from "@/components/consultation/TemplatePicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileSignature, Loader2, Mic } from "lucide-react";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

function truncate(s: string | null | undefined, max = 200) {
  if (!s) return "";
  const t = s.trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

export default function GenerateDocument() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { roles } = useAuth();
  const { data: patients } = usePatients();
  const qc = useQueryClient();

  const [selectedPatient, setSelectedPatient] = useState<string>(params.get("patient") ?? "");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const role: Enums<"app_role"> = (roles[0]?.role ?? "doctor") as Enums<"app_role">;

  const patient = useMemo(
    () => (patients ?? []).find((p) => p.id === selectedPatient),
    [patients, selectedPatient],
  );
  const wardType = patient?.current_ward?.ward_type as Enums<"ward_type"> | undefined;

  const { data: notes, isLoading: notesLoading } = usePatientNotes(selectedPatient || undefined);

  // Toda vez que muda paciente, marca todas as notas por padrão
  useEffect(() => {
    if (notes) setSelectedNoteIds(new Set(notes.map((n) => n.id)));
  }, [notes]);

  function toggleNote(id: string) {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerate() {
    if (!patient || !templateId) {
      toast.error("Selecione paciente e template");
      return;
    }
    if (selectedNoteIds.size === 0) {
      toast.error("Selecione ao menos uma nota");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-document", {
        body: {
          patient_id: patient.id,
          template_id: templateId,
          source_consultation_ids: Array.from(selectedNoteIds),
        },
      });
      if (error || data?.error) {
        throw new Error(data?.error ?? error?.message ?? "Falha ao gerar documento");
      }

      // A edge function já gravou o clinical_report. Só invalida cache.
      qc.invalidateQueries({ queryKey: ["patient_timeline", patient.id] });

      toast.success("Documento gerado");
      navigate(`/documents/${data.report_id}`);
    } catch (e: any) {
      console.error(e);
      toast.error(`Erro: ${e?.message ?? e}`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          back
          title="Gerar documento"
          subtitle="Use as notas registradas do paciente como fonte. A IA preenche o template a partir delas."
        />

        <Card>
          <CardHeader>
            <CardTitle className="heading-card">1. Paciente</CardTitle>
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
          </CardContent>
        </Card>

        {selectedPatient && (
          <Card>
            <CardHeader>
              <CardTitle className="heading-card">2. Template</CardTitle>
            </CardHeader>
            <CardContent>
              <TemplatePicker
                value={templateId}
                onChange={setTemplateId}
                wardType={wardType}
                role={role}
              />
            </CardContent>
          </Card>
        )}

        {selectedPatient && (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="heading-card">
                3. Notas a usar ({selectedNoteIds.size}/{notes?.length ?? 0})
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedNoteIds(new Set((notes ?? []).map((n) => n.id)))}
                  disabled={!notes || notes.length === 0}
                >
                  Marcar todas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedNoteIds(new Set())}
                  disabled={selectedNoteIds.size === 0}
                >
                  Desmarcar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {notesLoading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Carregando…</p>
              ) : (notes ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Este paciente ainda não tem notas. Volte e grave pelo menos uma.
                </p>
              ) : (
                (notes ?? []).map((n) => {
                  const checked = selectedNoteIds.has(n.id);
                  return (
                    <label
                      key={n.id}
                      className="flex items-start gap-3 p-3 border rounded-md hover:bg-accent/30 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleNote(n.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mic className="w-3 h-3" />
                          {new Date(n.created_at).toLocaleString("pt-BR")}
                          {n.audio_duration_seconds != null && (
                            <span>· {Math.round(n.audio_duration_seconds)}s</span>
                          )}
                        </div>
                        <p className="text-sm mt-1 line-clamp-2">
                          {truncate(n.edited_transcription ?? n.raw_transcription)}
                        </p>
                      </div>
                    </label>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

        {selectedPatient && (
          <div className="flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={!templateId || selectedNoteIds.size === 0 || generating}
              className="gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Gerando documento…
                </>
              ) : (
                <>
                  <FileSignature className="w-4 h-4" /> Gerar documento
                </>
              )}
            </Button>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
