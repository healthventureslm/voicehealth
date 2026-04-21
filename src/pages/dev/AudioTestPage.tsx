/**
 * Audio Simulation Test Page — DEV ONLY
 *
 * Accessible at /dev/audio-test in development builds.
 * Guard: this component redirects to /dashboard in production.
 *
 * Features:
 * - Select one of 12 clinical scenarios
 * - Toggle accurate vs noisy transcription mode
 * - View mock transcription text
 * - Analyze intents (mock — no API call)
 * - Generate real documents (calls edge functions)
 * - Test check-completeness for missing fields
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Play, Zap, AlertTriangle, CheckCircle2,
  FlaskConical, Radio, FileText, HelpCircle
} from "lucide-react";
import {
  listScenarios,
  getMockTranscription,
  getMockExpectedIntents,
  getMockExpectedMissingFields,
  type ScenarioOption,
  type TranscriptionMode,
} from "@/lib/mocks/transcriptionMock";

// Guard: dev-only
if (!import.meta.env.DEV) {
  // Redirect handled in component body
}

const SECTOR_LABEL: Record<string, string> = {
  uti: "UTI",
  emergencia: "Emergência",
  enfermaria: "Enfermaria",
  ambulatorio: "Ambulatório",
};

const SECTOR_COLOR: Record<string, string> = {
  uti: "bg-destructive/10 text-destructive border-destructive/30",
  emergencia: "bg-warning/10 text-warning border-warning/30",
  enfermaria: "bg-primary/10 text-primary border-primary/30",
  ambulatorio: "bg-secondary/10 text-secondary border-secondary/30",
};

const COMPLEXITY_COLOR: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  med: "bg-warning/10 text-warning",
  low: "bg-secondary/10 text-secondary",
};

export default function AudioTestPage() {
  const navigate = useNavigate();

  // Redirect in prod
  if (!import.meta.env.DEV) {
    navigate("/dashboard");
    return null;
  }

  const scenarios = listScenarios();
  const [selectedId, setSelectedId] = useState<string>(scenarios[0]?.id ?? "");
  const [mode, setMode] = useState<TranscriptionMode>("accurate");
  const [transcription, setTranscription] = useState<string | null>(null);
  const [detectedIntents, setDetectedIntents] = useState<string[] | null>(null);
  const [missingFields, setMissingFields] = useState<any[] | null>(null);
  const [generatedDocs, setGeneratedDocs] = useState<any[] | null>(null);
  const [loadingIntents, setLoadingIntents] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingCompleteness, setLoadingCompleteness] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedScenario = scenarios.find((s) => s.id === selectedId);
  const expectedIntents = selectedId ? getMockExpectedIntents(selectedId) : [];
  const expectedMissing = selectedId ? getMockExpectedMissingFields(selectedId) : [];

  const handleSimulateTranscription = () => {
    setError(null);
    setDetectedIntents(null);
    setMissingFields(null);
    setGeneratedDocs(null);
    const text = getMockTranscription(selectedId, mode);
    setTranscription(text);
  };

  const handleAnalyzeIntents = async () => {
    if (!transcription) return;
    setLoadingIntents(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("analyze-clinical-intents", {
        body: { transcription, user_roles: ["medico", "enfermeiro", "admin"] },
      });
      if (fnError) throw fnError;
      setDetectedIntents((data?.intents || []).map((i: any) => i.type));
    } catch (err: any) {
      setError(err?.message || "Erro ao analisar intenções");
    }
    setLoadingIntents(false);
  };

  const handleCheckCompleteness = async () => {
    if (!transcription || !detectedIntents?.length) return;
    setLoadingCompleteness(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("check-completeness", {
        body: {
          transcription,
          intent_types: detectedIntents,
          sector: selectedScenario?.sector,
        },
      });
      if (fnError) throw fnError;
      setMissingFields(data?.missing_fields || []);
    } catch (err: any) {
      setError(err?.message || "Erro ao verificar completude");
    }
    setLoadingCompleteness(false);
  };

  const handleGenerateDocs = async () => {
    if (!transcription || !detectedIntents?.length) return;
    setLoadingDocs(true);
    setError(null);
    try {
      // We need a fake consultation_id for the edge function; use a mock UUID
      const mockConsultationId = "00000000-0000-0000-0000-000000000001";
      const { data, error: fnError } = await supabase.functions.invoke("generate-clinical-documents", {
        body: {
          consultation_id: mockConsultationId,
          intents: detectedIntents.map((type) => ({ type, details: {}, raw_text: "" })),
          transcription,
        },
      });
      if (fnError) throw fnError;
      setGeneratedDocs(data?.documents || []);
    } catch (err: any) {
      setError(err?.message || "Erro ao gerar documentos");
    }
    setLoadingDocs(false);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Simulador de Áudio — DEV</h1>
            <p className="text-sm text-muted-foreground">
              Teste de transcrição simulada e geração de documentos clínicos
            </p>
          </div>
          <Badge variant="outline" className="ml-auto border-warning/50 text-warning">
            Apenas em desenvolvimento
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Scenario selection + transcription */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">1. Selecionar Cenário Clínico</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedId} onValueChange={(v) => {
                  setSelectedId(v);
                  setTranscription(null);
                  setDetectedIntents(null);
                  setMissingFields(null);
                  setGeneratedDocs(null);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cenário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(["uti", "emergencia", "enfermaria", "ambulatorio"] as const).map((sector) => (
                      <div key={sector}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {SECTOR_LABEL[sector]}
                        </div>
                        {scenarios
                          .filter((s) => s.sector === sector)
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.title}
                            </SelectItem>
                          ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>

                {selectedScenario && (
                  <div className="flex flex-wrap gap-2">
                    <Badge className={SECTOR_COLOR[selectedScenario.sector]} variant="outline">
                      {SECTOR_LABEL[selectedScenario.sector]}
                    </Badge>
                    <Badge className={COMPLEXITY_COLOR[selectedScenario.complexity]} variant="secondary">
                      {selectedScenario.complexity === "high"
                        ? "Alta complexidade"
                        : selectedScenario.complexity === "med"
                        ? "Média complexidade"
                        : "Baixa complexidade"}
                    </Badge>
                    <Badge variant="outline">{selectedScenario.specialty}</Badge>
                  </div>
                )}

                <Separator />

                <div className="flex items-center gap-3">
                  <Switch
                    id="noisy-mode"
                    checked={mode === "noisy"}
                    onCheckedChange={(v) => setMode(v ? "noisy" : "accurate")}
                  />
                  <Label htmlFor="noisy-mode" className="cursor-pointer">
                    <span className="font-medium">Modo ruidoso</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {mode === "noisy" ? "Simula erros reais de ASR" : "Transcrição limpa e precisa"}
                    </span>
                  </Label>
                  {mode === "noisy" && (
                    <Radio className="w-4 h-4 text-warning animate-pulse" />
                  )}
                </div>

                <Button
                  onClick={handleSimulateTranscription}
                  disabled={!selectedId}
                  className="w-full gap-2 gradient-primary border-0 text-white"
                >
                  <Play className="w-4 h-4" />
                  Simular Transcrição
                </Button>
              </CardContent>
            </Card>

            {/* Transcription result */}
            {transcription && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Transcrição Simulada</CardTitle>
                    <Badge variant={mode === "noisy" ? "destructive" : "secondary"}>
                      {mode === "noisy" ? "Ruidosa" : "Precisa"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs whitespace-pre-wrap bg-muted/40 rounded-lg p-3 max-h-64 overflow-y-auto font-sans leading-relaxed">
                    {transcription}
                  </pre>

                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">
                      Intenções esperadas neste cenário:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {expectedIntents.map((intent) => (
                        <Badge key={intent} variant="outline" className="text-xs">
                          {intent}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Analysis results */}
          <div className="space-y-4">
            {/* Intent analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">2. Analisar Intenções (API Real)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handleAnalyzeIntents}
                  disabled={!transcription || loadingIntents}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {loadingIntents ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  Analisar com IA
                </Button>

                {detectedIntents !== null && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Detectadas:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detectedIntents.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Nenhuma intenção detectada</span>
                      ) : (
                        detectedIntents.map((intent) => {
                          const expected = expectedIntents.includes(intent);
                          return (
                            <Badge
                              key={intent}
                              variant="outline"
                              className={`text-xs gap-1 ${expected ? "border-success/50 text-success" : "border-warning/50 text-warning"}`}
                            >
                              {expected ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <AlertTriangle className="w-3 h-3" />
                              )}
                              {intent}
                            </Badge>
                          );
                        })
                      )}
                    </div>

                    {/* Missed intents */}
                    {expectedIntents.filter((e) => !detectedIntents.includes(e)).length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-warning font-medium">Esperadas mas não detectadas:</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {expectedIntents
                            .filter((e) => !detectedIntents.includes(e))
                            .map((intent) => (
                              <Badge key={intent} variant="destructive" className="text-xs">
                                {intent}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Completeness check */}
            {detectedIntents !== null && detectedIntents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">3. Verificar Completude (Modo Guiado)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={handleCheckCompleteness}
                    disabled={loadingCompleteness}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    {loadingCompleteness ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <HelpCircle className="w-4 h-4" />
                    )}
                    Verificar campos ausentes
                  </Button>

                  {missingFields !== null && (
                    <div className="space-y-2">
                      {missingFields.length === 0 ? (
                        <div className="flex items-center gap-2 text-success text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          Todos os campos críticos foram preenchidos na transcrição
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-warning font-medium">
                            {missingFields.length} campo(s) ausente(s):
                          </p>
                          <div className="space-y-1.5">
                            {missingFields.map((f: any, i: number) => (
                              <div key={i} className="text-xs bg-warning/5 border border-warning/20 rounded-lg p-2">
                                <span className="font-medium text-warning">[{f.intent_type}] {f.field}:</span>
                                <span className="text-muted-foreground ml-1">{f.question}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Document generation */}
            {detectedIntents !== null && detectedIntents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">4. Gerar Documentos (API Real)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={handleGenerateDocs}
                    disabled={loadingDocs}
                    className="w-full gap-2 gradient-primary border-0 text-white"
                  >
                    {loadingDocs ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    Gerar {detectedIntents.length} documento(s)
                  </Button>

                  {generatedDocs !== null && (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {generatedDocs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum documento gerado</p>
                      ) : (
                        generatedDocs.map((doc: any, i: number) => (
                          <div key={i} className="border border-border/50 rounded-lg p-3 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">{doc.type}</Badge>
                              <span className="text-sm font-medium">{doc.title}</span>
                            </div>
                            <pre className="text-xs whitespace-pre-wrap text-muted-foreground max-h-40 overflow-y-auto">
                              {doc.content?.slice(0, 600)}{doc.content?.length > 600 ? "\n[...]" : ""}
                            </pre>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
