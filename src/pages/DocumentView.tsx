import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateClinicalReport } from "@/hooks/queries";
import { StructuredReportView } from "@/components/templates/StructuredReportView";
import type { TemplateSchema } from "@/templates/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Mic, Download, Save } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { exportReportPdf } from "@/lib/exportReportPdf";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Visualização de um clinical_report gerado de notas (sem consultation_id).
 * Mostra: conteúdo markdown + lista de notas-fonte com link.
 */
export default function DocumentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinical_reports")
        .select(`
          id, patient_id, consultation_id, source_consultation_ids,
          template_id, version, content, format, filled_data, generated_at, generated_by,
          patient:patients(id, full_name, medical_record, bed, hospital_id, hospital:hospitals(id, name, logo_url)),
          template:report_templates(id, name, schema)
        `)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const updateReport = useUpdateClinicalReport();
  const [structuredDraft, setStructuredDraft] = useState<Record<string, Record<string, unknown>>>({});
  const [isDirty, setIsDirty] = useState(false);

  const templateSchema = (doc?.template as any)?.schema as TemplateSchema | null | undefined;
  const isStructured =
    !!templateSchema &&
    !!doc?.filled_data &&
    doc?.format === "structured";

  // Sincroniza buffer ao trocar de documento ou após salvar.
  useEffect(() => {
    if (isStructured && doc?.filled_data) {
      setStructuredDraft(doc.filled_data as Record<string, Record<string, unknown>>);
      setIsDirty(false);
    }
  }, [doc?.id, doc?.filled_data, isStructured]);

  const { data: sourceNotes } = useQuery({
    queryKey: ["document_sources", id],
    enabled: !!doc && !!doc.source_consultation_ids?.length,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select("id, created_at, edited_transcription, raw_transcription, audio_duration_seconds")
        .in("id", doc!.source_consultation_ids)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <PageContainer width="narrow">Carregando…</PageContainer>
      </AppLayout>
    );
  }

  if (!doc) {
    return (
      <AppLayout>
        <PageContainer width="narrow">
          <p>Documento não encontrado ou sem permissão.</p>
        </PageContainer>
      </AppLayout>
    );
  }

  const patient: any = doc.patient;
  const templateName = doc.template?.name ?? "Documento clínico";

  async function handleSaveStructured() {
    if (!doc) return;
    try {
      await updateReport.mutateAsync({
        id: doc.id,
        patch: { filled_data: structuredDraft as never },
      });
      setIsDirty(false);
      toast.success("Alterações salvas");
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e?.message ?? e}`);
    }
  }

  async function handleExportPdf() {
    if (!doc) return;
    try {
      await exportReportPdf({
        consultation: {
          id: doc.id,
          created_at: doc.generated_at,
          patient: {
            full_name: patient?.full_name,
            medical_record: patient?.medical_record,
            bed: patient?.bed,
          },
          ward: null,
        },
        reportContent: doc.content,
        reportVersion: doc.version,
        reportFormat: doc.format,
        professionalName: profile?.full_name ?? undefined,
        hospitalName: patient?.hospital?.name ?? undefined,
        hospitalLogoUrl: patient?.hospital?.logo_url ?? undefined,
        documentTitle: templateName,
        reportTitle: templateName,
        filenamePrefix: "documento",
      });
      toast.success("PDF gerado");
    } catch (e: any) {
      toast.error(`Falha ao exportar: ${e?.message ?? e}`);
    }
  }

  return (
    <AppLayout>
      <PageContainer width="narrow">
        <PageHeader
          back
          title={doc.template?.name ?? "Documento"}
          subtitle={
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <span>Paciente: <strong>{patient?.full_name ?? "—"}</strong></span>
              <span>· {new Date(doc.generated_at).toLocaleString("pt-BR")}</span>
              <span>· Gerado de {doc.source_consultation_ids?.length ?? 0} gravaç{(doc.source_consultation_ids?.length ?? 0) === 1 ? "ão" : "ões"}</span>
            </span>
          }
          actions={
            <Button variant="outline" onClick={handleExportPdf} className="gap-2">
              <Download className="w-4 h-4" /> PDF
            </Button>
          }
        />

        {isStructured && templateSchema ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="heading-section flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {templateSchema.name}
              </h2>
              <Button
                onClick={handleSaveStructured}
                disabled={!isDirty || updateReport.isPending}
                size="sm"
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                {isDirty ? "Salvar alterações" : "Salvo"}
              </Button>
            </div>
            <StructuredReportView
              schema={templateSchema}
              value={structuredDraft}
              onChange={(next) => {
                setStructuredDraft(next);
                setIsDirty(true);
              }}
            />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="heading-section flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Documento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <article className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{doc.content}</ReactMarkdown>
              </article>
            </CardContent>
          </Card>
        )}

        {(sourceNotes ?? []).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="heading-section flex items-center gap-2">
                <Mic className="w-5 h-5 text-primary" />
                Gravações usadas como fonte
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(sourceNotes ?? []).map((n) => (
                <div
                  key={n.id}
                  className="p-3 border rounded-md hover:bg-accent/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/consultations/${n.id}/report`)}
                >
                  <div className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("pt-BR")}
                    {n.audio_duration_seconds != null && (
                      <span> · {Math.round(n.audio_duration_seconds)}s</span>
                    )}
                  </div>
                  <p className="text-sm mt-1 line-clamp-2">
                    {(n.edited_transcription ?? n.raw_transcription ?? "").trim()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </PageContainer>
    </AppLayout>
  );
}
