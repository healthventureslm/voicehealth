import jsPDF from "jspdf";

interface ConsultationLite {
  id: string;
  created_at: string;
  completed_at?: string | null;
  status?: string;
  ward?: { name?: string } | null;
  patient?: { full_name?: string; medical_record?: string | null; bed?: string | null } | null;
}

interface AddendumLite {
  content: string;
  created_at: string;
  author_role_at_time: string;
  author?: { full_name?: string } | null;
}

interface ExportOpts {
  consultation: ConsultationLite;
  reportContent: string;
  reportVersion: number;
  reportFormat?: string;
  addenda?: AddendumLite[];
  professionalName?: string;
  hospitalName?: string;
  /** Título do bloco principal — default "Atendimento clínico". */
  documentTitle?: string;
  /** Título do conteúdo — default "Relatório clínico (vN)". */
  reportTitle?: string;
  /** Prefixo do nome do arquivo — default "atendimento". */
  filenamePrefix?: string;
}

/**
 * Gera PDF clínico simples — tipografia Inter (default jsPDF), título Times-like.
 * Faz wrap de texto, cabeçalho com paciente + setor, addenda no final, footer com página.
 */
export function exportReportPdf(opts: ExportOpts) {
  const {
    consultation,
    reportContent,
    reportVersion,
    addenda = [],
    professionalName,
    hospitalName,
    documentTitle = "Atendimento clínico",
    reportTitle,
    filenamePrefix = "atendimento",
  } = opts;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helpers
  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, fontSize: number, fontStyle: "normal" | "bold" | "italic" = "normal") => {
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth) as string[];
    const lineHeight = fontSize * 1.4;
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
  };

  const hr = () => {
    ensureSpace(8);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;
  };

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("VoiceHealth", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("— by Health Ventures", margin + 95, y);
  doc.setTextColor(0);
  y += 24;

  if (hospitalName) {
    doc.setFontSize(10);
    doc.text(hospitalName, margin, y);
    y += 14;
  }

  hr();

  // Bloco do paciente
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(documentTitle, margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const p = consultation.patient ?? {};
  const meta = [
    ["Paciente", p.full_name ?? "—"],
    ["Prontuário", p.medical_record ?? "—"],
    ["Leito", p.bed ?? "—"],
    ["Setor", consultation.ward?.name ?? "—"],
    ["Data", new Date(consultation.created_at).toLocaleString("pt-BR")],
    ["Profissional", professionalName ?? "—"],
  ];
  for (const [label, value] of meta) {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 80, y);
    y += 14;
  }

  y += 4;
  hr();

  // Relatório
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(reportTitle ?? `Relatório clínico (v${reportVersion})`, margin, y);
  y += 18;

  // Conversão básica de markdown — remove ** ## etc, mantém quebras
  const cleaned = reportContent
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  writeWrapped(cleaned, 10);

  // Addenda
  if (addenda.length > 0) {
    y += 12;
    hr();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Observações posteriores (adendos)", margin, y);
    y += 18;

    for (const a of addenda) {
      ensureSpace(40);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(110);
      doc.text(
        `${a.author?.full_name ?? "—"} · ${a.author_role_at_time} · ${new Date(a.created_at).toLocaleString("pt-BR")}`,
        margin,
        y,
      );
      y += 12;
      doc.setTextColor(0);
      writeWrapped(a.content, 10);
      y += 6;
    }
  }

  // Footer com paginação + assinatura digital
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    const footer = `Documento gerado por VoiceHealth · ${new Date().toLocaleString("pt-BR")}  ·  página ${i}/${pageCount}`;
    doc.text(footer, pageWidth / 2, pageHeight - 24, { align: "center" });
  }

  // Salva
  const filename = `${filenamePrefix}_${(p.full_name ?? "paciente").replace(/\s+/g, "_")}_${new Date(consultation.created_at).toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
