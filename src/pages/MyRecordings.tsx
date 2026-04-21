import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Archive, ChevronRight, Search, FileText, Layers, Mic, Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ReportTemplateDialog } from "@/components/ReportTemplateDialog";

interface RecordingRow {
  id: string;
  patient_id: string;
  raw_transcription: string | null;
  edited_transcription: string | null;
  ai_summary: string | null;
  status: string;
  created_at: string;
  patients: { full_name: string; bed: string | null; medical_record: string | null } | null;
}

interface PatientGroup {
  patientId: string;
  patientName: string;
  bed: string | null;
  medicalRecord: string | null;
  recordings: RecordingRow[];
}

export default function MyRecordings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("consultations")
      .select("id, patient_id, raw_transcription, edited_transcription, ai_summary, status, created_at, patients(full_name, bed, medical_record)")
      .eq("professional_id", user.id)
      .neq("status", "recording")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error(error); toast.error("Erro ao carregar gravações"); }
        setRecordings((data as any[]) || []);
        setLoading(false);
        // Auto-expand first 3 patients
        const patientIds = new Set<string>();
        ((data as any[]) || []).forEach((r: RecordingRow) => {
          if (patientIds.size < 3) patientIds.add(r.patient_id);
        });
        setExpandedPatients(patientIds);
      });
  }, [user]);

  const groups = useMemo(() => {
    const map = new Map<string, PatientGroup>();
    const q = search.toLowerCase();
    for (const r of recordings) {
      const text = r.edited_transcription || r.raw_transcription || "";
      const name = r.patients?.full_name || "";
      if (q && !name.toLowerCase().includes(q) && !text.toLowerCase().includes(q) && !(r.ai_summary || "").toLowerCase().includes(q)) continue;
      if (!map.has(r.patient_id)) {
        map.set(r.patient_id, {
          patientId: r.patient_id,
          patientName: name,
          bed: r.patients?.bed || null,
          medicalRecord: r.patients?.medical_record || null,
          recordings: [],
        });
      }
      map.get(r.patient_id)!.recordings.push(r);
    }
    return Array.from(map.values()).sort((a, b) => {
      const aDate = a.recordings[0]?.created_at || "";
      const bDate = b.recordings[0]?.created_at || "";
      return bDate.localeCompare(aDate);
    });
  }, [recordings, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const togglePatientExpand = (pid: string) => {
    setExpandedPatients((prev) => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  };

  const selectAllInGroup = (group: PatientGroup, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      group.recordings.forEach((r) => checked ? next.add(r.id) : next.delete(r.id));
      return next;
    });
  };

  const selectedCount = selectedIds.size;

  const handleConsolidatedReport = () => {
    if (selectedCount < 1) { toast.error("Selecione pelo menos 1 gravação"); return; }
    setShowTemplateDialog(true);
  };

  const handleSubmit = async (templateIds: string[]) => {
    const templateId = templateIds[0];
    if (!templateId) return;
    setShowTemplateDialog(false);
    setIsGenerating(true);

    const selected = recordings
      .filter((r) => selectedIds.has(r.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const transcriptions = selected.map((t, i) => ({
      text: t.edited_transcription || t.raw_transcription || "",
      date: new Date(t.created_at).toLocaleString("pt-BR"),
      index: i + 1,
    }));

    const lastId = selected[selected.length - 1].id;

    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { consultation_id: lastId, template_id: templateId, transcriptions },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Relatório gerado com sucesso!");
      navigate(`/consultations/${lastId}/report`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar relatório");
    } finally {
      setIsGenerating(false);
    }
  };

  const getSummary = (r: RecordingRow) => {
    if (r.ai_summary) return r.ai_summary;
    const text = r.edited_transcription || r.raw_transcription || "";
    return text.length > 120 ? text.slice(0, 120) + "…" : text;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Archive className="w-8 h-8 text-primary" />
              Minhas Gravações
            </h1>
            <p className="text-muted-foreground">Visualize, selecione e gere relatórios consolidados</p>
          </div>
          <Button onClick={() => navigate("/consultations/new")} className="gap-2">
            <Mic className="w-4 h-4" /> Nova Gravação
          </Button>
        </div>

        {/* Search + Actions bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por paciente ou conteúdo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          {selectedCount > 0 && (
            <Button onClick={handleConsolidatedReport} className="gap-2" disabled={isGenerating}>
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              Gerar Relatório ({selectedCount})
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : groups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {search ? `Nenhuma gravação encontrada para "${search}"` : "Nenhuma gravação encontrada. Comece gravando um atendimento!"}
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-280px)]">
            <div className="space-y-3 pr-2">
              {groups.map((group) => {
                const isExpanded = expandedPatients.has(group.patientId);
                const isSeries = group.recordings.length > 1;
                const groupSelected = group.recordings.filter((r) => selectedIds.has(r.id)).length;
                const allSelected = groupSelected === group.recordings.length;

                return (
                  <Card key={group.patientId} className={cn("transition-all", groupSelected > 0 && "ring-1 ring-primary/40")}>
                    <Collapsible open={isExpanded} onOpenChange={() => togglePatientExpand(group.patientId)}>
                      <CollapsibleTrigger className="w-full">
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={(checked) => { selectAllInGroup(group, !!checked); }}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5"
                            />
                            <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                            <div className="flex-1 text-left min-w-0">
                              <CardTitle className="text-sm font-semibold">{group.patientName}</CardTitle>
                              <p className="text-xs text-muted-foreground">
                                {group.medicalRecord && `${group.medicalRecord} • `}
                                {group.bed && `Leito ${group.bed} • `}
                                {group.recordings.length} gravação(ões)
                              </p>
                            </div>
                            {isSeries ? (
                              <Badge variant="default" className="text-[10px] px-2 py-0.5">Série ({group.recordings.length})</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] px-2 py-0.5">Única</Badge>
                            )}
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-2 pb-3">
                          {group.recordings.map((r) => {
                            const isSelected = selectedIds.has(r.id);
                            return (
                              <button
                                key={r.id}
                                onClick={() => toggleSelect(r.id)}
                                className={cn(
                                  "w-full text-left p-3 rounded-lg border transition-all",
                                  isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/30 hover:bg-muted/40"
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleSelect(r.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Calendar className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                                      <Badge variant={r.status === "completed" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                        {r.status === "completed" ? "Completa" : r.status === "transcribed" ? "Transcrita" : r.status}
                                      </Badge>
                                      {r.ai_summary && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary border-primary/30">IA</Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{getSummary(r)}</p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      <ReportTemplateDialog
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        onSubmit={handleSubmit}
        isSubmitting={isGenerating}
        selectedRecordingsCount={selectedCount}
      />
    </AppLayout>
  );
}
