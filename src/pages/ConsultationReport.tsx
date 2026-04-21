import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileText } from "lucide-react";
import { RefinementChat } from "@/components/consultation/RefinementChat";
import type { Tables } from "@/integrations/supabase/types";

type ClinicalReport = Tables<"clinical_reports">;

interface ProfessionalInfo {
  full_name: string | null;
  professional_registry: string | null;
  professional_registry_type: string | null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function generateHash(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function buildSignatureHtml(prof: ProfessionalInfo | null, hash: string): string {
  if (!prof?.professional_registry) return "";
  const now = new Date().toLocaleString("pt-BR");
  return `
    <div style="margin-top:40px;border-top:2px solid #0f172a;padding-top:16px;font-size:0.85em;color:#333;">
      <p style="margin:0;font-weight:600;">Assinado eletronicamente por:</p>
      <p style="margin:2px 0;">${escapeHtml(prof.full_name || "")}</p>
      <p style="margin:2px 0;font-weight:600;">${escapeHtml(prof.professional_registry)}</p>
      <p style="margin:8px 0 2px;font-size:0.85em;color:#555;">${escapeHtml(now)}</p>
      <p style="margin:8px 0 2px;font-size:0.8em;color:#777;">Código de verificação: <strong>${escapeHtml(hash)}</strong></p>
      <p style="margin:4px 0;font-size:0.75em;color:#999;">Documento com validade legal conforme Lei 14.063/2020 (assinatura eletrônica avançada)</p>
    </div>`;
}

export default function ConsultationReport() {
  const { id } = useParams<{ id: string }>();
  const [reports, setReports] = useState<ClinicalReport[]>([]);
  const [professionals, setProfessionals] = useState<Record<string, ProfessionalInfo>>({});
  const [loading, setLoading] = useState(true);
  // Local content state so RefinementChat can update UI without re-fetching
  const [reportContents, setReportContents] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    supabase.from("clinical_reports").select("*").eq("consultation_id", id).order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const reports = data || [];
        setReports(reports);

        // Fetch professional profiles for signature
        const userIds = [...new Set(reports.map((r) => r.generated_by).filter(Boolean))] as string[];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, professional_registry, professional_registry_type")
            .in("user_id", userIds);
          const map: Record<string, ProfessionalInfo> = {};
          (profiles || []).forEach((p: any) => { map[p.user_id] = p; });
          setProfessionals(map);
        }
        // Initialize local content map
        const initialContents: Record<string, string> = {};
        (data || []).forEach((r) => { initialContents[r.id] = r.content; });
        setReportContents(initialContents);

        setLoading(false);
      });
  }, [id]);

  const handleExportPDF = async (report: ClinicalReport) => {
    const prof = report.generated_by ? professionals[report.generated_by] || null : null;
    const hash = await generateHash(report.content);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Relatório Clínico</title>
      <style>body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;padding:40px;max-width:800px;margin:0 auto;line-height:1.6}
      h1{color:#0f172a;font-size:24px}pre{white-space:pre-wrap;font-family:inherit}
      @media print{body{padding:20px}}</style></head>
      <body><h1>Relatório Clínico - ${escapeHtml(report.template_type)}</h1>
      <p><small>Gerado em: ${escapeHtml(new Date(report.created_at).toLocaleString("pt-BR"))}</small></p>
      <hr><pre>${escapeHtml(report.content)}</pre>
      ${buildSignatureHtml(prof, hash)}
      </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios Clínicos</h1>
          <p className="text-muted-foreground">Relatórios gerados para este atendimento</p>
        </div>

        {reports.length === 0 ? (
          <Card className="text-center p-12">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum relatório gerado ainda</p>
          </Card>
        ) : (
          reports.map((report) => {
            const content = reportContents[report.id] ?? report.content;
            return (
              <div key={report.id} className="space-y-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>{report.template_type}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(report.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleExportPDF({ ...report, content })}
                    >
                      <Download className="w-4 h-4" /> Exportar PDF
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none bg-muted/30 rounded-lg p-4">
                      <pre className="whitespace-pre-wrap font-sans text-sm">{content}</pre>
                    </div>
                  </CardContent>
                </Card>

                <RefinementChat
                  reportId={report.id}
                  reportType={report.template_type}
                  currentContent={content}
                  onContentRefined={(newContent) =>
                    setReportContents((prev) => ({ ...prev, [report.id]: newContent }))
                  }
                />
              </div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}
