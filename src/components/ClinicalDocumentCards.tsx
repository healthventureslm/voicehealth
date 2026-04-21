import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, Pill, Building2, ArrowRightLeft, LogOut, AlertTriangle,
  Copy, FileDown, Trash2, Pencil, Check, X, RotateCcw, Plus, UserPlus,
  Stethoscope, Heart, Utensils, Activity, Ear, Brain, Users
} from "lucide-react";
import { toast } from "sonner";

export interface ClinicalDocument {
  id: string;
  type: string;
  title: string;
  content: string;
  details?: Record<string, any>;
  is_controlled?: boolean;
  suggest_dose?: boolean;
}

interface ClinicalDocumentCardsProps {
  documents: ClinicalDocument[];
  onContinue: () => void;
  onNewPatient: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  exam_request: <FileText className="w-5 h-5" />,
  prescription: <Pill className="w-5 h-5" />,
  hospitalization: <Building2 className="w-5 h-5" />,
  high_cost_med: <AlertTriangle className="w-5 h-5" />,
  transfer: <ArrowRightLeft className="w-5 h-5" />,
  discharge: <LogOut className="w-5 h-5" />,
  nursing_note: <Stethoscope className="w-5 h-5" />,
  nursing_evolution: <Heart className="w-5 h-5" />,
  vital_signs: <Activity className="w-5 h-5" />,
  diet_prescription: <Utensils className="w-5 h-5" />,
  rehab_evolution: <Activity className="w-5 h-5" />,
  speech_eval: <Ear className="w-5 h-5" />,
  psych_eval: <Brain className="w-5 h-5" />,
  social_report: <Users className="w-5 h-5" />,
};

const COLOR_MAP: Record<string, string> = {
  exam_request: "border-blue-500/30 bg-blue-500/5",
  prescription: "border-green-500/30 bg-green-500/5",
  hospitalization: "border-orange-500/30 bg-orange-500/5",
  high_cost_med: "border-red-500/30 bg-red-500/5",
  transfer: "border-purple-500/30 bg-purple-500/5",
  discharge: "border-teal-500/30 bg-teal-500/5",
  nursing_note: "border-pink-500/30 bg-pink-500/5",
  nursing_evolution: "border-rose-500/30 bg-rose-500/5",
  vital_signs: "border-cyan-500/30 bg-cyan-500/5",
  diet_prescription: "border-amber-500/30 bg-amber-500/5",
  rehab_evolution: "border-lime-500/30 bg-lime-500/5",
  speech_eval: "border-indigo-500/30 bg-indigo-500/5",
  psych_eval: "border-violet-500/30 bg-violet-500/5",
  social_report: "border-sky-500/30 bg-sky-500/5",
};

const EXAM_MATERIAL_MAP: Record<string, { material: string; metodo: string }> = {
  hemograma: { material: "Sangue total (EDTA)", metodo: "Automação hematológica" },
  glicose: { material: "Soro", metodo: "Enzimático" },
  glicemia: { material: "Soro", metodo: "Enzimático" },
  ureia: { material: "Soro", metodo: "Cinético UV" },
  creatinina: { material: "Soro", metodo: "Cinético colorimétrico" },
  sodio: { material: "Soro", metodo: "Eletrodo íon-seletivo" },
  potassio: { material: "Soro", metodo: "Eletrodo íon-seletivo" },
  magnesio: { material: "Soro", metodo: "Colorimétrico" },
  calcio: { material: "Soro", metodo: "Colorimétrico" },
  troponina: { material: "Soro", metodo: "Quimioluminescência" },
  tgo: { material: "Soro", metodo: "Cinético UV (IFCC)" },
  tgp: { material: "Soro", metodo: "Cinético UV (IFCC)" },
  ast: { material: "Soro", metodo: "Cinético UV (IFCC)" },
  alt: { material: "Soro", metodo: "Cinético UV (IFCC)" },
  pcr: { material: "Soro", metodo: "Imunoturbidimetria" },
  vhs: { material: "Sangue total (citrato)", metodo: "Westergren" },
  colesterol: { material: "Soro", metodo: "Enzimático" },
  triglicerides: { material: "Soro", metodo: "Enzimático" },
  hdl: { material: "Soro", metodo: "Direto" },
  ldl: { material: "Soro", metodo: "Friedewald/Direto" },
  bilirrubina: { material: "Soro", metodo: "Colorimétrico" },
  albumina: { material: "Soro", metodo: "Colorimétrico" },
  fosfatase: { material: "Soro", metodo: "Cinético" },
  ggt: { material: "Soro", metodo: "Cinético" },
  amilase: { material: "Soro", metodo: "Cinético" },
  lipase: { material: "Soro", metodo: "Cinético" },
  tsh: { material: "Soro", metodo: "Quimioluminescência" },
  t4: { material: "Soro", metodo: "Quimioluminescência" },
  t3: { material: "Soro", metodo: "Quimioluminescência" },
  ferro: { material: "Soro", metodo: "Colorimétrico" },
  ferritina: { material: "Soro", metodo: "Quimioluminescência" },
  vitamina: { material: "Soro", metodo: "Quimioluminescência" },
  acido_urico: { material: "Soro", metodo: "Enzimático" },
  coagulograma: { material: "Sangue total (citrato)", metodo: "Coagulométrico" },
  tap: { material: "Plasma (citrato)", metodo: "Coagulométrico" },
  inr: { material: "Plasma (citrato)", metodo: "Coagulométrico" },
  ttpa: { material: "Plasma (citrato)", metodo: "Coagulométrico" },
  fibrinogenio: { material: "Plasma (citrato)", metodo: "Coagulométrico" },
  eas: { material: "Urina", metodo: "Físico-químico + Sedimentoscopia" },
  urina: { material: "Urina", metodo: "Físico-químico" },
  urocultura: { material: "Urina", metodo: "Cultura" },
  hemocultura: { material: "Sangue", metodo: "Cultura automatizada" },
  lactato: { material: "Sangue arterial", metodo: "Enzimático" },
  gasometria: { material: "Sangue arterial", metodo: "Potenciometria" },
  bnp: { material: "Sangue total (EDTA)", metodo: "Quimioluminescência" },
  dimero: { material: "Plasma (citrato)", metodo: "Imunoturbidimetria" },
  d_dimero: { material: "Plasma (citrato)", metodo: "Imunoturbidimetria" },
};

function lookupExamInfo(examName: string): { material: string; metodo: string } {
  const normalized = examName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "");
  for (const [key, val] of Object.entries(EXAM_MATERIAL_MAP)) {
    if (normalized.includes(key)) return val;
  }
  return { material: "Sangue/Soro", metodo: "A definir" };
}

async function generatePDF(doc: ClinicalDocument, content: string) {
  const { default: jsPDF } = await import("jspdf");

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginLeft = 20;
  const marginRight = 20;
  const marginTop = 25;
  const marginBottom = 25;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = marginTop;

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - marginBottom) {
      pdf.addPage();
      y = marginTop;
      // Footer line on new page
      drawFooter();
    }
  };

  const drawFooter = () => {
    const pageNum = pdf.getNumberOfPages();
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Página ${pageNum} — Gerado em ${new Date().toLocaleString("pt-BR")} — VoiceHealth`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
    pdf.setTextColor(0, 0, 0);
  };

  // Header bar
  pdf.setFillColor(15, 23, 42); // slate-900
  pdf.rect(0, 0, pageWidth, 18, "F");
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.text("VoiceHealth — Documento Clínico", marginLeft, 12);
  pdf.setTextColor(0, 0, 0);
  y = 28;

  // Title
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  const titleLines = pdf.splitTextToSize(doc.title, contentWidth);
  pdf.text(titleLines, marginLeft, y);
  y += titleLines.length * 6 + 2;

  // Separator
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.5);
  pdf.line(marginLeft, y, pageWidth - marginRight, y);
  y += 6;

  // Badges
  if (doc.suggest_dose || doc.is_controlled) {
    pdf.setFontSize(9);
    if (doc.suggest_dose) {
      pdf.setFillColor(254, 243, 199);
      pdf.roundedRect(marginLeft, y - 3, 55, 6, 1, 1, "F");
      pdf.setTextColor(180, 120, 0);
      pdf.text("⚠ DOSE SUGERIDA — Revisar", marginLeft + 2, y + 1);
      y += 8;
    }
    if (doc.is_controlled) {
      pdf.setFillColor(254, 226, 226);
      pdf.roundedRect(marginLeft, y - 3, 60, 6, 1, 1, "F");
      pdf.setTextColor(180, 0, 0);
      pdf.text("⚠ MEDICAMENTO CONTROLADO", marginLeft + 2, y + 1);
      y += 8;
    }
    pdf.setTextColor(0, 0, 0);
    y += 2;
  }

  // Date
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(120, 120, 120);
  pdf.text(`Data: ${new Date().toLocaleDateString("pt-BR")} — ${new Date().toLocaleTimeString("pt-BR")}`, marginLeft, y);
  pdf.setTextColor(0, 0, 0);
  y += 8;

  // Lab exam table for grouped laboratorial exams
  const isLabExam = doc.type === "exam_request" &&
    doc.details?.exam_category === "laboratorial" &&
    Array.isArray(doc.details?.exam_list) &&
    doc.details.exam_list.length > 1;

  if (isLabExam) {
    const examList = doc.details!.exam_list as string[];
    const colWidths = [8, contentWidth * 0.45, contentWidth * 0.30, contentWidth * 0.25 - 8];
    const colX = [marginLeft, marginLeft + colWidths[0], marginLeft + colWidths[0] + colWidths[1], marginLeft + colWidths[0] + colWidths[1] + colWidths[2]];
    const rowH = 7;

    // Table title
    checkPageBreak(12);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("EXAMES LABORATORIAIS SOLICITADOS", marginLeft, y);
    y += 6;

    // Indication
    if (doc.details?.indication) {
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(80, 80, 80);
      pdf.text(`Indicacao clinica: ${doc.details.indication}`, marginLeft, y);
      pdf.setTextColor(0, 0, 0);
      y += 6;
    }

    // Header row
    checkPageBreak(rowH + 4);
    pdf.setFillColor(15, 23, 42);
    pdf.rect(marginLeft, y - 4, contentWidth, rowH, "F");
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.text("#", colX[0] + 2, y);
    pdf.text("Exame", colX[1] + 2, y);
    pdf.text("Material", colX[2] + 2, y);
    pdf.text("Metodo", colX[3] + 2, y);
    pdf.setTextColor(0, 0, 0);
    y += rowH;

    // Data rows
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    examList.forEach((exam: string, idx: number) => {
      checkPageBreak(rowH);
      const info = lookupExamInfo(exam);

      // Alternating row bg
      if (idx % 2 === 0) {
        pdf.setFillColor(245, 247, 250);
        pdf.rect(marginLeft, y - 4, contentWidth, rowH, "F");
      }

      // Row border
      pdf.setDrawColor(220, 220, 220);
      pdf.line(marginLeft, y + rowH - 4, marginLeft + contentWidth, y + rowH - 4);

      pdf.text(`${idx + 1}`, colX[0] + 2, y);

      // Truncate long exam names
      const examTrunc = pdf.splitTextToSize(exam, colWidths[1] - 4)[0];
      pdf.text(examTrunc, colX[1] + 2, y);
      pdf.text(info.material, colX[2] + 2, y);

      const metodoTrunc = pdf.splitTextToSize(info.metodo, colWidths[3] - 4)[0];
      pdf.text(metodoTrunc, colX[3] + 2, y);
      y += rowH;
    });

    // Table border
    const tableTop = y - (examList.length + 1) * rowH;
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(0.3);
    pdf.rect(marginLeft, tableTop - 4, contentWidth, (examList.length + 1) * rowH);
    pdf.setLineWidth(0.1);

    y += 6;

    // Urgency
    checkPageBreak(8);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("Urgencia: ", marginLeft, y);
    pdf.setFont("helvetica", "normal");
    pdf.text("Conforme contexto clinico", marginLeft + pdf.getTextWidth("Urgencia: "), y);
    y += 10;
  }

  // Render content line by line with markdown-like formatting
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      y += 3;
      continue;
    }

    // Heading ###
    if (trimmed.startsWith("### ")) {
      checkPageBreak(10);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      const text = trimmed.replace(/^###\s*/, "").replace(/\*\*/g, "");
      const wrapped = pdf.splitTextToSize(text, contentWidth);
      pdf.text(wrapped, marginLeft, y);
      y += wrapped.length * 5 + 3;
      continue;
    }

    // Heading ##
    if (trimmed.startsWith("## ")) {
      checkPageBreak(10);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      const text = trimmed.replace(/^##\s*/, "").replace(/\*\*/g, "");
      const wrapped = pdf.splitTextToSize(text, contentWidth);
      pdf.text(wrapped, marginLeft, y);
      y += wrapped.length * 5.5 + 3;
      continue;
    }

    // Heading #
    if (trimmed.startsWith("# ")) {
      checkPageBreak(12);
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      const text = trimmed.replace(/^#\s*/, "").replace(/\*\*/g, "");
      const wrapped = pdf.splitTextToSize(text, contentWidth);
      pdf.text(wrapped, marginLeft, y);
      y += wrapped.length * 6 + 4;
      continue;
    }

    // Alert lines (⚠️)
    if (trimmed.includes("⚠") || trimmed.includes("ALERTA") || trimmed.includes("ATENÇÃO")) {
      checkPageBreak(10);
      pdf.setFillColor(254, 243, 199);
      const alertText = trimmed.replace(/\*\*/g, "");
      const wrapped = pdf.splitTextToSize(alertText, contentWidth - 8);
      const blockH = wrapped.length * 4.5 + 4;
      pdf.roundedRect(marginLeft, y - 3, contentWidth, blockH, 1.5, 1.5, "F");
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(140, 90, 0);
      pdf.text(wrapped, marginLeft + 4, y + 1);
      pdf.setTextColor(0, 0, 0);
      y += blockH + 3;
      continue;
    }

    // Separator ---
    if (/^-{3,}$/.test(trimmed)) {
      checkPageBreak(4);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(marginLeft, y, pageWidth - marginRight, y);
      y += 5;
      continue;
    }

    // Bold lines (entire line bold)
    if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      checkPageBreak(6);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      const text = trimmed.replace(/\*\*/g, "");
      const wrapped = pdf.splitTextToSize(text, contentWidth);
      pdf.text(wrapped, marginLeft, y);
      y += wrapped.length * 4.5 + 2;
      pdf.setFont("helvetica", "normal");
      continue;
    }

    // Bullet points
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      checkPageBreak(6);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const text = trimmed.replace(/^[-•]\s*/, "").replace(/\*\*/g, "");
      const wrapped = pdf.splitTextToSize(text, contentWidth - 8);
      pdf.text("•", marginLeft + 2, y);
      pdf.text(wrapped, marginLeft + 8, y);
      y += wrapped.length * 4.5 + 1.5;
      continue;
    }

    // Numbered items
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      checkPageBreak(6);
      pdf.setFontSize(10);
      const label = `${numMatch[1]}.`;
      const text = numMatch[2].replace(/\*\*/g, "");

      // Check if text after number starts bold
      if (numMatch[2].startsWith("**")) {
        const parts = numMatch[2].split("**").filter(Boolean);
        pdf.setFont("helvetica", "bold");
        pdf.text(label, marginLeft, y);
        const boldPart = parts[0] || "";
        const restPart = parts.slice(1).join("");
        const fullText = boldPart + restPart;
        const wrapped = pdf.splitTextToSize(fullText, contentWidth - 10);
        pdf.text(wrapped, marginLeft + 8, y);
        pdf.setFont("helvetica", "normal");
        y += wrapped.length * 4.5 + 1.5;
      } else {
        pdf.setFont("helvetica", "normal");
        pdf.text(label, marginLeft, y);
        const wrapped = pdf.splitTextToSize(text, contentWidth - 10);
        pdf.text(wrapped, marginLeft + 8, y);
        y += wrapped.length * 4.5 + 1.5;
      }
      continue;
    }

    // Key: Value lines
    if (trimmed.includes(":") && trimmed.indexOf(":") < 40) {
      checkPageBreak(6);
      const colonIdx = trimmed.indexOf(":");
      const key = trimmed.substring(0, colonIdx + 1).replace(/\*\*/g, "");
      const value = trimmed.substring(colonIdx + 1).trim().replace(/\*\*/g, "");

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text(key, marginLeft, y);
      const keyWidth = pdf.getTextWidth(key) + 2;

      pdf.setFont("helvetica", "normal");
      if (value) {
        const availW = contentWidth - keyWidth;
        if (availW > 20) {
          const wrapped = pdf.splitTextToSize(value, availW);
          pdf.text(wrapped, marginLeft + keyWidth, y);
          y += wrapped.length * 4.5 + 1.5;
        } else {
          y += 4.5;
          const wrapped = pdf.splitTextToSize(value, contentWidth - 4);
          pdf.text(wrapped, marginLeft + 4, y);
          y += wrapped.length * 4.5 + 1.5;
        }
      } else {
        y += 5;
      }
      continue;
    }

    // Normal text
    checkPageBreak(6);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const cleanText = trimmed.replace(/\*\*/g, "");
    const wrapped = pdf.splitTextToSize(cleanText, contentWidth);
    pdf.text(wrapped, marginLeft, y);
    y += wrapped.length * 4.5 + 1.5;
  }

  // Signature area
  checkPageBreak(30);
  y += 15;
  pdf.setDrawColor(100, 100, 100);
  pdf.line(marginLeft, y, marginLeft + 70, y);
  y += 5;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80, 80, 80);
  pdf.text("Assinatura / Carimbo do Profissional", marginLeft, y);
  pdf.setTextColor(0, 0, 0);

  // Footer on all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Página ${i} de ${totalPages} — Gerado em ${new Date().toLocaleString("pt-BR")} — VoiceHealth`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
    pdf.setTextColor(0, 0, 0);
  }

  // Download
  const safeTitle = doc.title.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "").replace(/\s+/g, "_").substring(0, 60);
  pdf.save(`${safeTitle}.pdf`);
}

export function ClinicalDocumentCards({ documents, onContinue, onNewPatient }: ClinicalDocumentCardsProps) {
  const [visibleDocs, setVisibleDocs] = useState<Set<string>>(() => new Set(documents.map(d => d.id)));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [docContents, setDocContents] = useState<Record<string, string>>(() =>
    Object.fromEntries(documents.map(d => [d.id, d.content]))
  );

  const handleCopy = async (doc: ClinicalDocument) => {
    try {
      await navigator.clipboard.writeText(docContents[doc.id] || doc.content);
      setCopiedId(doc.id);
      toast.success("Copiado!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const handlePDF = async (doc: ClinicalDocument) => {
    setGeneratingPdf(doc.id);
    try {
      const content = docContents[doc.id] || doc.content;
      await generatePDF(doc, content);
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleDelete = (id: string) => {
    setVisibleDocs(prev => { const next = new Set(prev); next.delete(id); return next; });
    toast.success("Documento removido da visualização");
  };

  const startEdit = (doc: ClinicalDocument) => {
    setEditingId(doc.id);
    setEditContent(docContents[doc.id] || doc.content);
  };

  const saveEdit = (id: string) => {
    setDocContents(prev => ({ ...prev, [id]: editContent }));
    setEditingId(null);
    toast.success("Documento atualizado");
  };

  const cancelEdit = () => { setEditingId(null); setEditContent(""); };

  const visibleDocuments = documents.filter(d => visibleDocs.has(d.id));

  if (visibleDocuments.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-muted-foreground">Todos os documentos foram removidos.</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={onContinue} className="gap-2"><Plus className="w-4 h-4" /> Complementar Atendimento</Button>
          <Button variant="outline" onClick={onNewPatient} className="gap-2"><UserPlus className="w-4 h-4" /> Novo Paciente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{visibleDocuments.length} documento(s) gerado(s)</h2>
        <Button variant="outline" size="sm" onClick={() => setVisibleDocs(new Set(documents.map(d => d.id)))} className="gap-1">
          <RotateCcw className="w-3 h-3" /> Restaurar
        </Button>
      </div>

      {visibleDocuments.map(doc => (
        <Card key={doc.id} className={`${COLOR_MAP[doc.type] || "border-border"} transition-all`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {ICON_MAP[doc.type] || <FileText className="w-5 h-5" />}
                <span>{doc.title}</span>
              </div>
              <div className="flex items-center gap-1">
                {doc.is_controlled && (
                  <Badge variant="destructive" className="text-xs">Controlado</Badge>
                )}
                {doc.suggest_dose && (
                  <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">Dose Sugerida</Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editingId === doc.id ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="min-h-[200px] text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={cancelEdit} className="gap-1">
                    <X className="w-3 h-3" /> Cancelar
                  </Button>
                  <Button size="sm" onClick={() => saveEdit(doc.id)} className="gap-1">
                    <Check className="w-3 h-3" /> Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground bg-background/50 p-3 rounded-lg border max-h-[300px] overflow-y-auto text-sm">
                {docContents[doc.id] || doc.content}
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => startEdit(doc)} className="gap-1" disabled={editingId === doc.id}>
                <Pencil className="w-3 h-3" /> Editar
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleCopy(doc)} className="gap-1">
                {copiedId === doc.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedId === doc.id ? "Copiado" : "Copiar"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePDF(doc)}
                className="gap-1"
                disabled={generatingPdf === doc.id}
              >
                <FileDown className="w-3 h-3" />
                {generatingPdf === doc.id ? "Gerando..." : "PDF"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(doc.id)} className="gap-1 text-destructive hover:text-destructive">
                <Trash2 className="w-3 h-3" /> Excluir
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-3 justify-center pt-2">
        <Button onClick={onContinue} className="gap-2"><Plus className="w-4 h-4" /> Complementar Atendimento</Button>
        <Button variant="outline" onClick={onNewPatient} className="gap-2"><UserPlus className="w-4 h-4" /> Novo Paciente</Button>
      </div>
    </div>
  );
}
