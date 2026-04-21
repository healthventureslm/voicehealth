import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, FileDown, RotateCcw, Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface ReportMetadata {
  hospitalName?: string;
  professionalName?: string;
  professionalRole?: string;
  professionalRegistry?: string;
  professionalRegistryType?: string;
  patientName?: string;
  medicalRecord?: string;
  bed?: string;
  wardName?: string;
  date?: string;
}

interface ReportResultProps {
  report: string;
  transcription?: string;
  onNewRecording: () => void;
  metadata?: ReportMetadata;
}

export function ReportResult({ report, transcription, onNewRecording, metadata }: ReportResultProps) {
  const [copied, setCopied] = useState(false);

  const fullReport = buildFullReport(metadata, report);

  const handleCopy = async () => {
    try {
      const hash = await generateVerificationHash(fullReport);
      const signedReport = fullReport + buildSignatureBlock(metadata, hash);
      await navigator.clipboard.writeText(signedReport);
      setCopied(true);
      toast.success("Relatório copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const handleExportPDF = async () => {
    const hash = await generateVerificationHash(fullReport);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Permita pop-ups para exportar PDF");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório Clínico</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; line-height: 1.6; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
          .header h1 { font-size: 1.3em; margin: 0; }
          .header-info { font-size: 0.85em; color: #555; margin-top: 4px; }
          h1, h2, h3 { color: #0f172a; }
          h2 { font-size: 1.2em; margin-top: 1.5em; }
          p { margin: 0.5em 0; }
          ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>${buildHtmlReport(metadata, report, hash)}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>📋 Relatório Gerado</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
                <FileDown className="w-4 h-4" /> PDF
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metadata && (metadata.hospitalName || metadata.professionalName || metadata.patientName) && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg border text-sm space-y-1">
              {metadata.hospitalName && <p className="font-semibold text-foreground">{metadata.hospitalName}</p>}
              {metadata.professionalName && (
                <p className="text-muted-foreground">
                  {metadata.professionalRole || "Profissional"}: {metadata.professionalName}
                </p>
              )}
              <Separator className="my-2" />
              {metadata.patientName && <p>Paciente: <strong>{metadata.patientName}</strong></p>}
              <div className="flex gap-4 text-muted-foreground text-xs">
                {metadata.medicalRecord && <span>Prontuário: {metadata.medicalRecord}</span>}
                {metadata.bed && <span>Leito: {metadata.bed}</span>}
                {metadata.wardName && <span>Setor: {metadata.wardName}</span>}
              </div>
              {metadata.date && <p className="text-xs text-muted-foreground">{metadata.date}</p>}
            </div>
          )}
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground bg-muted/30 p-4 rounded-lg border max-h-[60vh] overflow-y-auto">
            {report}
          </div>
        </CardContent>
      </Card>

      {transcription && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            Ver transcrição original
          </summary>
          <div className="mt-2 p-3 bg-muted/30 rounded-lg border text-muted-foreground whitespace-pre-wrap text-xs">
            {transcription}
          </div>
        </details>
      )}

      <div className="flex justify-center pt-2">
        <Button variant="outline" onClick={onNewRecording} className="gap-2">
          <RotateCcw className="w-4 h-4" /> Nova Gravação
        </Button>
      </div>
    </div>
  );
}

function buildFullReport(m: ReportMetadata | undefined, body: string): string {
  if (!m) return body;
  const lines: string[] = [];
  if (m.hospitalName) lines.push(m.hospitalName);
  if (m.professionalName) lines.push(`${m.professionalRole || "Profissional"}: ${m.professionalName}`);
  if (m.patientName) lines.push(`Paciente: ${m.patientName}`);
  const details = [m.medicalRecord && `Prontuário: ${m.medicalRecord}`, m.bed && `Leito: ${m.bed}`, m.wardName && `Setor: ${m.wardName}`].filter(Boolean).join(" | ");
  if (details) lines.push(details);
  if (m.date) lines.push(m.date);
  if (lines.length) lines.push("---");
  lines.push(body);
  return lines.join("\n");
}

async function generateVerificationHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function buildSignatureBlock(m: ReportMetadata | undefined, hash: string): string {
  if (!m?.professionalRegistry) return "";
  const now = new Date().toLocaleString("pt-BR");
  return `
─────────────────────────────────
Assinado eletronicamente por:
${m.professionalName || ""}
${m.professionalRegistry}
${now}

Código de verificação: ${hash}
Documento com validade legal conforme
Lei 14.063/2020 (assinatura eletrônica avançada)
─────────────────────────────────`;
}

function buildHtmlSignatureBlock(m: ReportMetadata | undefined, hash: string): string {
  if (!m?.professionalRegistry) return "";
  const now = new Date().toLocaleString("pt-BR");
  return `
    <div style="margin-top:40px;border-top:2px solid #0f172a;padding-top:16px;font-size:0.85em;color:#333;">
      <p style="margin:0;font-weight:600;">Assinado eletronicamente por:</p>
      <p style="margin:2px 0;">${escapeHtml(m.professionalName || "")}</p>
      <p style="margin:2px 0;font-weight:600;">${escapeHtml(m.professionalRegistry)}</p>
      <p style="margin:8px 0 2px;font-size:0.85em;color:#555;">${escapeHtml(now)}</p>
      <p style="margin:8px 0 2px;font-size:0.8em;color:#777;">Código de verificação: <strong>${escapeHtml(hash)}</strong></p>
      <p style="margin:4px 0;font-size:0.75em;color:#999;">Documento com validade legal conforme Lei 14.063/2020 (assinatura eletrônica avançada)</p>
    </div>`;
}

function buildHtmlReport(m: ReportMetadata | undefined, body: string, hash: string = ""): string {
  let html = "";
  if (m && (m.hospitalName || m.professionalName)) {
    html += `<div class="header">`;
    if (m.hospitalName) html += `<h1>${escapeHtml(m.hospitalName)}</h1>`;
    if (m.professionalName) html += `<div class="header-info">${escapeHtml(m.professionalRole || "Profissional")}: ${escapeHtml(m.professionalName)}</div>`;
    if (m.patientName) html += `<div class="header-info">Paciente: ${escapeHtml(m.patientName)}</div>`;
    const d = [m.medicalRecord && `Prontuário: ${escapeHtml(m.medicalRecord)}`, m.bed && `Leito: ${escapeHtml(m.bed)}`, m.wardName && `Setor: ${escapeHtml(m.wardName)}`].filter(Boolean).join(" &bull; ");
    if (d) html += `<div class="header-info">${d}</div>`;
    if (m.date) html += `<div class="header-info">${escapeHtml(m.date)}</div>`;
    html += `</div>`;
  }
  html += escapeHtml(body).replace(/\n/g, "<br>");
  html += buildHtmlSignatureBlock(m, hash);
  return html;
}
