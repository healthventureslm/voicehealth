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
  /** Registro do conselho — ex: "COREN: 391769 - RJ" ou "CRM 12345/SP". */
  professionalRegistration?: string;
  hospitalName?: string;
  /** URL pública da logo — embed no header (esquerda). */
  hospitalLogoUrl?: string | null;
  /** Título do bloco principal — default "Atendimento clínico". */
  documentTitle?: string;
  /** Título do conteúdo — default "Relatório clínico (vN)". */
  reportTitle?: string;
  /** Prefixo do nome do arquivo — default "atendimento". */
  filenamePrefix?: string;
}

/** Baixa uma URL pública e converte pra data URL pra usar com jsPDF.addImage.
 * Se for SVG, rasteriza pra PNG via canvas (jsPDF não suporta SVG nativamente). */
async function fetchAsDataUrl(url: string): Promise<{ dataUrl: string; mime: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();

    // SVG → rasteriza
    if (blob.type.includes("svg")) {
      const svgText = await blob.text();
      const png = await svgToPng(svgText, 256);
      if (png) return { dataUrl: png, mime: "image/png" };
      return null;
    }

    const reader = new FileReader();
    return await new Promise((resolve, reject) => {
      reader.onload = () => resolve({ dataUrl: reader.result as string, mime: blob.type });
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Mede largura/altura naturais de uma imagem (data URL). */
function measureDataUrl(dataUrl: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** Rasteriza um SVG pra PNG data URL com canvas, em px de largura quadrada. */
function svgToPng(svgText: string, size: number): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const objUrl = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objUrl);
          resolve(null);
          return;
        }
        // mantém proporção original do SVG num quadrado, centralizado
        const w = img.naturalWidth || size;
        const h = img.naturalHeight || size;
        const scale = Math.min(size / w, size / h);
        const dw = w * scale;
        const dh = h * scale;
        const dx = (size - dw) / 2;
        const dy = (size - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        URL.revokeObjectURL(objUrl);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        resolve(null);
      };
      img.src = objUrl;
    } catch {
      resolve(null);
    }
  });
}

// ─── Paleta (inspirada no padrão Rede D'Or institucional) ───────────
const NAVY: [number, number, number]       = [31, 56, 100];    // #1F3864 navy clínico
const CHARCOAL: [number, number, number]   = [26, 26, 31];     // banda título doc
const SAGE: [number, number, number]       = [168, 197, 181];  // accent HV sutil
const TEXT: [number, number, number]       = [33, 37, 41];
const META: [number, number, number]       = [110, 117, 125];
const RULE: [number, number, number]       = [200, 205, 210];
const PANEL_BG: [number, number, number]   = [247, 248, 250];
const SECTION_BG: [number, number, number] = [220, 225, 232];  // banda seção (cinza-azulado)
const HIGHLIGHT_BG: [number, number, number] = [217, 226, 243]; // boxes de escalas (azul claro)

// ─── Tokens de tipografia ────────────────────────────────────────────
const FONT = "helvetica";
const FS_BODY = 10;
const FS_H1 = 15;
const FS_H2 = 12;
const FS_H3 = 10.5;
const FS_META = 8.5;
const LH = 1.4;

// ─── Inline run parsing (bold/italic) ────────────────────────────────
type Run = { text: string; bold: boolean; italic: boolean };

function parseInline(s: string): Run[] {
  // ordem importa: bold antes de italic (** > *)
  // strip código e links primeiro
  s = s.replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  const runs: Run[] = [];
  let i = 0;
  let buf = "";
  let bold = false;
  let italic = false;

  const flush = () => {
    if (buf.length === 0) return;
    runs.push({ text: buf, bold, italic });
    buf = "";
  };

  while (i < s.length) {
    if (s.startsWith("**", i)) {
      flush();
      bold = !bold;
      i += 2;
    } else if (s[i] === "*" && s[i + 1] !== " " && s[i + 1] !== "*") {
      flush();
      italic = !italic;
      i += 1;
    } else {
      buf += s[i];
      i += 1;
    }
  }
  flush();
  return runs;
}

export async function exportReportPdf(opts: ExportOpts) {
  const {
    consultation,
    reportContent,
    reportVersion,
    addenda = [],
    professionalName,
    professionalRegistration,
    hospitalName,
    hospitalLogoUrl,
    documentTitle = "Atendimento clínico",
    reportTitle,
    filenamePrefix = "atendimento",
  } = opts;

  // Pré-carrega a logo (se houver) e descobre dimensões naturais pra
  // preservar aspect ratio quando embedar.
  let logoData: { dataUrl: string; mime: string; naturalW: number; naturalH: number } | null = null;
  if (hospitalLogoUrl) {
    const fetched = await fetchAsDataUrl(hospitalLogoUrl);
    if (fetched) {
      const dims = await measureDataUrl(fetched.dataUrl);
      if (dims) {
        logoData = { ...fetched, naturalW: dims.w, naturalH: dims.h };
      }
    }
  }

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  let y = 0;

  // ─── Helpers ───────────────────────────────────────────────────────
  const setColor = (rgb: [number, number, number]) =>
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFill = (rgb: [number, number, number]) =>
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (rgb: [number, number, number]) =>
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 60) {
      doc.addPage();
      y = margin;
    }
  };

  /** Mede a largura de uma run no estilo dela. */
  const measure = (r: Run, fs: number) => {
    doc.setFont(FONT, r.bold ? (r.italic ? "bolditalic" : "bold") : r.italic ? "italic" : "normal");
    doc.setFontSize(fs);
    return doc.getTextWidth(r.text);
  };

  /**
   * Renderiza uma sequência de runs com word-wrap manual.
   * Cada palavra é a unidade mínima — não quebra dentro de palavra.
   */
  const renderRuns = (runs: Run[], fs: number, indent = 0) => {
    const lineH = fs * LH;
    const xStart = margin + indent;
    const maxX = margin + contentW;
    let x = xStart;

    ensureSpace(lineH);
    setColor(TEXT);

    type Token = { run: Run; word: string; w: number };
    const tokens: Token[] = [];
    for (const r of runs) {
      const parts = r.text.split(/(\s+)/);
      for (const p of parts) {
        if (!p) continue;
        const tok: Token = { run: r, word: p, w: 0 };
        tok.w = measure({ ...r, text: p }, fs);
        tokens.push(tok);
      }
    }

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      // quebra de linha se a palavra (não-whitespace) não couber
      if (!/^\s+$/.test(t.word) && x + t.w > maxX && x > xStart) {
        x = xStart;
        y += lineH;
        ensureSpace(lineH);
      }
      // não desenha whitespace inicial de linha
      if (x === xStart && /^\s+$/.test(t.word)) continue;

      // Estilo Rede D'Or: bold inline (geralmente labels tipo "Repouso:")
      // → italic + bold em navy. Italic puro vira italic em navy.
      if (t.run.bold) {
        doc.setFont(FONT, "bolditalic");
        setColor(NAVY);
      } else if (t.run.italic) {
        doc.setFont(FONT, "italic");
        setColor(NAVY);
      } else {
        doc.setFont(FONT, "normal");
        setColor(TEXT);
      }
      doc.setFontSize(fs);
      doc.text(t.word, x, y);
      x += t.w;
    }
    y += lineH;
  };

  /**
   * Header institucional puro — sem branding do app.
   * Esquerda: wordmark do hospital. Direita: strip compacta do paciente.
   * Inspirado no padrão Rede D'Or.
   */
  const drawHeaderBand = () => {
    const headerTop = margin;
    const leftW = contentW * 0.38;
    const rightX = margin + leftW + 16;
    const rightW = contentW - leftW - 16;

    // Esquerda — logo OU wordmark (não os dois — logo já é a marca)
    if (logoData) {
      const maxW = leftW - 4;
      const maxH = 90;
      const scale = Math.min(maxW / logoData.naturalW, maxH / logoData.naturalH);
      const w = logoData.naturalW * scale;
      const h = logoData.naturalH * scale;
      const fmt = logoData.mime.includes("jpeg") || logoData.mime.includes("jpg") ? "JPEG"
        : logoData.mime.includes("webp") ? "WEBP"
        : "PNG";
      try {
        doc.addImage(logoData.dataUrl, fmt, margin, headerTop, w, h, undefined, "FAST");
      } catch {
        // falha → cai no wordmark
        if (hospitalName) drawWordmark(headerTop, leftW);
      }
    } else if (hospitalName) {
      drawWordmark(headerTop, leftW);
    }

    // Direita — strip do paciente (label: valor compacto)
    const p = consultation.patient ?? {};
    const rows: [string, string][] = [
      ["Registro Civil", p.full_name ?? "—"],
      ["Prontuário", p.medical_record ?? "—"],
      ["Leito", p.bed ?? "—"],
      ["Setor", consultation.ward?.name ?? "—"],
      ["Data/Hora", new Date(consultation.created_at).toLocaleString("pt-BR")],
    ];
    let py = headerTop + 6;
    doc.setFontSize(8);
    for (const [label, value] of rows) {
      setColor(META);
      doc.setFont(FONT, "bold");
      doc.text(`${label}:`, rightX, py);
      setColor(TEXT);
      doc.setFont(FONT, "normal");
      const valueWidth = rightW - 70;
      const wrapped = doc.splitTextToSize(value, valueWidth) as string[];
      doc.text(wrapped[0] ?? "", rightX + 64, py);
      py += 11;
    }

    // Linha navy embaixo do header — leva em conta a altura da logo
    const logoBottom = logoData
      ? margin + Math.min(90, logoData.naturalH * Math.min((leftW - 4) / logoData.naturalW, 90 / logoData.naturalH))
      : margin + 50;
    const headerBottom = Math.max(logoBottom + 6, py + 4);
    setDraw(NAVY);
    doc.setLineWidth(1);
    doc.line(margin, headerBottom, pageW - margin, headerBottom);
    y = headerBottom + 10;
  };

  /** Desenha checkbox quadrado com X navy se checked. */
  const drawCheckbox = (cx: number, cy: number, size: number, checked: boolean) => {
    setDraw(NAVY);
    doc.setLineWidth(0.7);
    doc.rect(cx, cy, size, size, "S");
    if (checked) {
      doc.setLineWidth(1.2);
      doc.line(cx + 1, cy + 1, cx + size - 1, cy + size - 1);
      doc.line(cx + size - 1, cy + 1, cx + 1, cy + size - 1);
    }
  };

  const drawWordmark = (top: number, w: number) => {
    setColor(NAVY);
    doc.setFont(FONT, "bold");
    doc.setFontSize(15);
    const wrapped = doc.splitTextToSize(hospitalName!.toUpperCase(), w) as string[];
    let ly = top + 18;
    for (const ln of wrapped.slice(0, 2)) {
      doc.text(ln, margin, ly);
      ly += 17;
    }
  };

  /** Banda full-width pro título da seção — inspirada no Rede D'Or. */
  const drawSectionBanner = (label: string) => {
    const h = 18;
    ensureSpace(h + 6);
    setFill(SECTION_BG);
    doc.rect(margin, y, contentW, h, "F");
    setColor(NAVY);
    doc.setFont(FONT, "bold");
    doc.setFontSize(10);
    doc.text(label.toUpperCase(), margin + contentW / 2, y + 12, { align: "center" });
    y += h + 8;
  };

  // ─── 1. Header band ────────────────────────────────────────────────
  drawHeaderBand();

  // ─── 2. Document title (banda preta full-width estilo Rede D'Or) ──
  {
    const h = 26;
    setFill(CHARCOAL);
    doc.rect(margin, y, contentW, h, "F");
    setColor([255, 255, 255]);
    doc.setFont(FONT, "bold");
    doc.setFontSize(13);
    doc.text(documentTitle.toUpperCase(), margin + contentW / 2, y + 17, { align: "center" });
    y += h + 12;
  }

  // (Painel do paciente foi pra strip do header)
  const p = consultation.patient ?? {};

  // ─── 3. Markdown body (sections já vêm como bandas a partir de ##) ─
  renderMarkdown(reportContent);

  // ─── 5. Addenda ────────────────────────────────────────────────────
  if (addenda.length > 0) {
    y += 12;
    drawSectionBanner("Observações posteriores (adendos)");
    for (const a of addenda) {
      ensureSpace(40);
      setColor(META);
      doc.setFont(FONT, "italic");
      doc.setFontSize(FS_META);
      doc.text(
        `${a.author?.full_name ?? "—"} · ${a.author_role_at_time} · ${new Date(a.created_at).toLocaleString("pt-BR")}`,
        margin,
        y,
      );
      y += 14;
      renderRuns(parseInline(a.content), FS_BODY);
      y += 6;
    }
  }

  // ─── 6. Bloco de assinatura (estilo Rede D'Or — name + COREN) ─────
  if (professionalName) {
    y += 36;
    ensureSpace(70);
    // "Aferido por:" label (esquerda)
    setColor(META);
    doc.setFont(FONT, "bold");
    doc.setFontSize(8);
    doc.text(
      `DtHr Afe: ${new Date(consultation.created_at).toLocaleString("pt-BR")}`,
      margin,
      y,
    );
    doc.text(`Aferido por: ${professionalName}`, pageW - margin, y, { align: "right" });
    y += 24;

    // Linha de assinatura centralizada
    const sigW = 240;
    const sigX = margin + (contentW - sigW) / 2;
    setDraw(TEXT);
    doc.setLineWidth(0.7);
    doc.line(sigX, y, sigX + sigW, y);
    y += 12;
    setColor(NAVY);
    doc.setFont(FONT, "bold");
    doc.setFontSize(10);
    doc.text(professionalName.toUpperCase(), margin + contentW / 2, y, { align: "center" });
    y += 11;
    if (professionalRegistration) {
      setColor(NAVY);
      doc.setFont(FONT, "bold");
      doc.setFontSize(9);
      doc.text(professionalRegistration.toUpperCase(), margin + contentW / 2, y, { align: "center" });
      y += 12;
    }
  }

  // ─── 7. Footer (todas as páginas) — só timestamp, sem branding ────
  const pageCount = (doc as any).internal.getNumberOfPages();
  const printedAt = new Date().toLocaleString("pt-BR");
  const printedBy = professionalName ?? "—";
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setDraw(RULE);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 36, pageW - margin, pageH - 36);

    setColor(META);
    doc.setFont(FONT, "normal");
    doc.setFontSize(7.5);
    doc.text(`Impresso por ${printedBy} em ${printedAt}`, margin, pageH - 22);
    doc.text(`Página ${i} de ${pageCount}`, pageW - margin, pageH - 22, { align: "right" });
  }

  // ─── 8. Save ───────────────────────────────────────────────────────
  const filename = `${filenamePrefix}_${(p.full_name ?? "paciente").replace(/\s+/g, "_")}_${new Date(consultation.created_at).toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);

  // ────────────────────────────────────────────────────────────────────
  //                       MARKDOWN RENDERER
  // ────────────────────────────────────────────────────────────────────
  function renderMarkdown(md: string) {
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Linha vazia → espaçamento
      if (/^\s*$/.test(line)) {
        y += 4;
        i++;
        continue;
      }

      // Horizontal rule: --- ou ***
      if (/^\s*([-*])\1\1+\s*$/.test(line)) {
        y += 4;
        ensureSpace(8);
        setDraw(RULE);
        doc.setLineWidth(0.5);
        doc.line(margin, y, margin + contentW, y);
        y += 10;
        i++;
        continue;
      }

      // Heading 1: # ...  (geralmente é o título do doc; já temos banda no topo,
      // então renderiza sutil — só pula se for igual ao documentTitle)
      const h1 = /^# (.+)/.exec(line);
      if (h1) {
        const t = h1[1].trim();
        if (t.toUpperCase() !== documentTitle.toUpperCase()) {
          y += 4;
          ensureSpace(FS_H1 * LH + 4);
          setColor(NAVY);
          doc.setFont(FONT, "bold");
          doc.setFontSize(FS_H1);
          doc.text(t, margin, y);
          y += FS_H1 + 6;
        }
        i++;
        continue;
      }

      // Heading 2: ## ...  → BANDA cinza full-width (estilo Rede D'Or)
      const h2 = /^## (.+)/.exec(line);
      if (h2) {
        drawSectionBanner(h2[1].trim());
        i++;
        continue;
      }

      // Heading 3: ### ...
      const h3 = /^### (.+)/.exec(line);
      if (h3) {
        y += 3;
        ensureSpace(FS_H3 * LH);
        setColor(NAVY);
        doc.setFont(FONT, "bold");
        doc.setFontSize(FS_H3);
        doc.text(h3[1].trim(), margin, y);
        y += FS_H3 + 4;
        i++;
        continue;
      }

      // Tabela: linha começando com |
      if (/^\s*\|/.test(line)) {
        const tbl: string[][] = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          // pula a linha separadora |---|---|
          if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) {
            const cells = lines[i]
              .trim()
              .replace(/^\|/, "")
              .replace(/\|$/, "")
              .split("|")
              .map((c) => c.trim());
            tbl.push(cells);
          }
          i++;
        }
        if (tbl.length > 0) renderTable(tbl);
        continue;
      }

      // Lista bullet: -, *, ou +  (com suporte a checkbox - [ ] / - [x])
      if (/^\s*[-*+]\s+/.test(line)) {
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          const raw = lines[i].replace(/^\s*[-*+]\s+/, "");
          // checkbox? - [ ] texto / - [x] texto / - [X] texto
          const cbMatch = /^\[( |x|X|✓|✔)\]\s+(.*)$/.exec(raw);
          ensureSpace(FS_BODY * LH);
          if (cbMatch) {
            const checked = cbMatch[1] !== " ";
            const text = cbMatch[2];
            drawCheckbox(margin + 4, y - FS_BODY + 1, FS_BODY - 1, checked);
            renderRuns(parseInline(text), FS_BODY, 18);
          } else {
            setColor(NAVY);
            doc.setFont(FONT, "bold");
            doc.setFontSize(FS_BODY);
            doc.text("•", margin + 4, y);
            renderRuns(parseInline(raw), FS_BODY, 16);
          }
          i++;
        }
        continue;
      }

      // Lista numerada: 1. 2. ...
      if (/^\s*\d+\.\s+/.test(line)) {
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          const m = /^\s*(\d+)\.\s+(.+)/.exec(lines[i])!;
          ensureSpace(FS_BODY * LH);
          setColor(TEXT);
          doc.setFont(FONT, "normal");
          doc.setFontSize(FS_BODY);
          doc.text(`${m[1]}.`, margin + 2, y);
          renderRuns(parseInline(m[2]), FS_BODY, 18);
          i++;
        }
        continue;
      }

      // Blockquote: >
      if (/^\s*>\s?/.test(line)) {
        const quote: string[] = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        const text = quote.join(" ");
        ensureSpace(FS_BODY * LH);
        setDraw(SAGE);
        doc.setLineWidth(2);
        const startY = y - FS_BODY;
        renderRuns(parseInline(text), FS_BODY, 12);
        doc.line(margin + 2, startY, margin + 2, y - 4);
        continue;
      }

      // Parágrafo (acumula linhas até vazia)
      const paragraph: string[] = [];
      while (
        i < lines.length &&
        !/^\s*$/.test(lines[i]) &&
        !/^#{1,3} /.test(lines[i]) &&
        !/^\s*\|/.test(lines[i]) &&
        !/^\s*[-*+]\s+/.test(lines[i]) &&
        !/^\s*\d+\.\s+/.test(lines[i]) &&
        !/^\s*>\s?/.test(lines[i]) &&
        !/^\s*([-*])\1\1+\s*$/.test(lines[i])
      ) {
        paragraph.push(lines[i]);
        i++;
      }
      const text = paragraph.join(" ").trim();
      if (text) {
        renderRuns(parseInline(text), FS_BODY);
        y += 2;
      }
    }
  }

  function renderTable(tbl: string[][]) {
    if (tbl.length === 0) return;
    const cols = Math.max(...tbl.map((r) => r.length));
    const colW = contentW / cols;
    const cellPad = 6;
    const fs = FS_BODY - 0.5;
    const lineH = fs * LH;

    // calcula altura de cada linha (wrap)
    const rowHeights = tbl.map((row) => {
      let max = lineH + cellPad * 2;
      for (let c = 0; c < cols; c++) {
        const cell = row[c] ?? "";
        doc.setFont(FONT, "normal");
        doc.setFontSize(fs);
        const lines = doc.splitTextToSize(cell, colW - cellPad * 2) as string[];
        const h = lines.length * lineH + cellPad * 2;
        if (h > max) max = h;
      }
      return max;
    });

    y += 4;
    for (let r = 0; r < tbl.length; r++) {
      const rh = rowHeights[r];
      ensureSpace(rh);
      const isHeader = r === 0;

      if (isHeader) {
        setFill(NAVY);
        doc.rect(margin, y, contentW, rh, "F");
      } else if (r % 2 === 0) {
        setFill(PANEL_BG);
        doc.rect(margin, y, contentW, rh, "F");
      }

      setDraw(RULE);
      doc.setLineWidth(0.3);
      doc.rect(margin, y, contentW, rh, "S");

      for (let c = 0; c < cols; c++) {
        const cellText = tbl[r][c] ?? "";
        const cx = margin + c * colW;
        // separador vertical
        if (c > 0) {
          doc.line(cx, y, cx, y + rh);
        }
        // texto
        if (isHeader) {
          setColor([255, 255, 255]);
          doc.setFont(FONT, "bold");
        } else {
          setColor(TEXT);
          doc.setFont(FONT, "normal");
        }
        doc.setFontSize(fs);
        const wrapped = doc.splitTextToSize(cellText, colW - cellPad * 2) as string[];
        for (let li = 0; li < wrapped.length; li++) {
          doc.text(wrapped[li], cx + cellPad, y + cellPad + lineH * (li + 1) - 2);
        }
      }
      y += rh;
    }
    y += 6;
  }
}
