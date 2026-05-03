import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Mic } from "lucide-react";
import ReactMarkdown from "react-markdown";

/**
 * Visualização de um clinical_report gerado de notas (sem consultation_id).
 * Mostra: conteúdo markdown + lista de notas-fonte com link.
 */
export default function DocumentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinical_reports")
        .select(`
          id, patient_id, consultation_id, source_consultation_ids,
          template_id, version, content, format, generated_at, generated_by,
          patient:patients(id, full_name, medical_record, bed),
          template:report_templates(id, name)
        `)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

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

  return (
    <AppLayout>
      <PageContainer width="narrow">
        <PageHeader
          back
          title={
            <span className="flex items-center gap-2 flex-wrap">
              {doc.template?.name ?? "Documento"}
              <Badge variant="outline" className="text-xs">v{doc.version}</Badge>
            </span>
          }
          subtitle={
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <span>Paciente: <strong>{patient?.full_name ?? "—"}</strong></span>
              <span>· {new Date(doc.generated_at).toLocaleString("pt-BR")}</span>
              <span>· Gerado de {doc.source_consultation_ids?.length ?? 0} nota{(doc.source_consultation_ids?.length ?? 0) === 1 ? "" : "s"}</span>
            </span>
          }
        />

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

        {(sourceNotes ?? []).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="heading-section flex items-center gap-2">
                <Mic className="w-5 h-5 text-primary" />
                Notas usadas como fonte
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
