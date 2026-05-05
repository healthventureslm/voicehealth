import jsPDF from "jspdf";

interface ConsultationLite {
  id: string;
  created_at: string;
  completed_at?: string | null;
  status?: string;
  ward?: { name?: string } | null;
  hospital?: { name?: string | null; logo_url?: string | null } | null;
  patient?: {
    full_name?: string;
    social_name?: string | null;
    medical_record?: string | null;
    registration?: string | null;
    matricula?: string | null;
    bed?: string | null;
    cpf?: string | null;
    birth_date?: string | null;
    date_of_birth?: string | null;
    age?: string | null;
    sex?: string | null;
    plan?: string | null;
    admission_at?: string | null;
    attendance_type?: string | null;
  } | null;
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
  professionalRegistration?: string;
  hospitalName?: string;
  hospitalLogoUrl?: string | null;
  documentTitle?: string;
  reportTitle?: string;
  filenamePrefix?: string;
}

type RGB = [number, number, number];
type TextStyle = "normal" | "bold" | "italic" | "bolditalic";
type Run = { text: string; bold: boolean; italic: boolean };
type LoadedImage = { dataUrl: string; mime: string; naturalW: number; naturalH: number };

const FONT = "helvetica";

const COLORS = {
  navy: [0, 0, 102] as RGB,
  black: [0, 0, 0] as RGB,
  text: [17, 17, 17] as RGB,
  gray: [138, 138, 138] as RGB,
  line: [0, 0, 0] as RGB,
  dotted: [120, 120, 120] as RGB,
  meta: [92, 92, 92] as RGB,
  red: [176, 0, 0] as RGB,
  white: [255, 255, 255] as RGB,
};

const PT = {
  pageMargin: 10.5,
  footerHeight: 56,
  body: 8.7,
  small: 7.2,
  meta: 7.5,
  h1: 11,
  h2: 12,
  h3: 8.6,
  lineHeight: 1.34,
  afterBannerGap: 12,
};

async function fetchAsDataUrl(url: string): Promise<{ dataUrl: string; mime: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const blob = await response.blob();
    if (blob.type.includes("svg")) {
      const svgText = await blob.text();
      const dataUrl = await svgToPng(svgText, 360);
      return dataUrl ? { dataUrl, mime: "image/png" } : null;
    }

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: String(reader.result), mime: blob.type || "image/png" });
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function measureDataUrl(dataUrl: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function svgToPng(svgText: string, size: number): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const objectUrl = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }

        const iw = img.naturalWidth || size;
        const ih = img.naturalHeight || size;
        const scale = Math.min(size / iw, size / ih);
        const w = iw * scale;
        const h = ih * scale;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    } catch {
      resolve(null);
    }
  });
}

function parseInline(input: string): Run[] {
  const source = input
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1");

  const runs: Run[] = [];
  let buffer = "";
  let bold = false;
  let italic = false;

  const flush = () => {
    if (buffer) {
      runs.push({ text: buffer, bold, italic });
      buffer = "";
    }
  };

  for (let i = 0; i < source.length; i++) {
    if (source.startsWith("**", i)) {
      flush();
      bold = !bold;
      i++;
    } else if (source[i] === "*" && source[i + 1] !== "*" && source[i - 1] !== "*") {
      flush();
      italic = !italic;
    } else {
      buffer += source[i];
    }
  }

  flush();
  return runs;
}

function styleForRun(run: Run): TextStyle {
  if (run.bold && run.italic) return "bolditalic";
  if (run.bold) return "bold";
  if (run.italic) return "italic";
  return "normal";
}

function safeDateTime(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-BR");
}

function safeDate(value?: string | null) {
  if (!value) return "";
  if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
}

function cleanFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90);
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
    documentTitle = opts.reportTitle ?? "Relatorio clinico",
    filenamePrefix = "atendimento",
  } = opts;

  let logoData: LoadedImage | null = null;
  const logoUrl = hospitalLogoUrl ?? consultation.hospital?.logo_url ?? null;
  if (logoUrl) {
    const fetched = await fetchAsDataUrl(logoUrl);
    const dims = fetched ? await measureDataUrl(fetched.dataUrl) : null;
    if (fetched && dims) {
      logoData = { ...fetched, naturalW: dims.w, naturalH: dims.h };
    }
  }

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = PT.pageMargin;
  const contentW = pageW - margin * 2;
  const footerTop = pageH - PT.footerHeight;
  const p = consultation.patient ?? {};
  const title = documentTitle || "Relatorio clinico";

  let y = margin;

  const setText = (color: RGB) => doc.setTextColor(color[0], color[1], color[2]);
  const setFill = (color: RGB) => doc.setFillColor(color[0], color[1], color[2]);
  const setDraw = (color: RGB) => doc.setDrawColor(color[0], color[1], color[2]);
  const setFont = (style: TextStyle, size: number) => {
    doc.setFont(FONT, style);
    doc.setFontSize(size);
  };

  const usableBottom = () => footerTop - 8;

  const ensureSpace = (needed: number) => {
    if (y + needed <= usableBottom()) return;
    doc.addPage();
    drawPageChrome();
  };

  const textWidth = (text: string, style: TextStyle, size: number) => {
    setFont(style, size);
    return doc.getTextWidth(text);
  };

  const splitLongToken = (token: string, style: TextStyle, size: number, maxW: number) => {
    if (textWidth(token, style, size) <= maxW) return [token];
    const pieces: string[] = [];
    let current = "";
    for (const char of token) {
      const candidate = current + char;
      if (current && textWidth(candidate, style, size) > maxW) {
        pieces.push(current);
        current = char;
      } else {
        current = candidate;
      }
    }
    if (current) pieces.push(current);
    return pieces;
  };

  const renderRuns = (runs: Run[], size = PT.body, indent = 0, maxWidth = contentW - indent) => {
    const lineH = size * PT.lineHeight;
    const xStart = margin + indent;
    const maxX = xStart + maxWidth;
    let x = xStart;

    ensureSpace(lineH);

    for (const run of runs) {
      const style = styleForRun(run);
      const color = run.bold || run.italic ? COLORS.navy : COLORS.text;
      const tokens = run.text.split(/(\s+)/).filter(Boolean);

      for (const token of tokens) {
        const parts = /^\s+$/.test(token)
          ? [token]
          : splitLongToken(token, style, size, maxWidth);

        for (const part of parts) {
          const w = textWidth(part, style, size);
          const isSpace = /^\s+$/.test(part);

          if (!isSpace && x + w > maxX && x > xStart) {
            y += lineH;
            ensureSpace(lineH);
            x = xStart;
          }
          if (x === xStart && isSpace) continue;

          setFont(style, size);
          setText(color);
          doc.text(part, x, y);
          x += w;
        }
      }
    }

    y += lineH;
  };

  const drawWordmark = (x: number, top: number, w: number) => {
    const name = (hospitalName ?? consultation.hospital?.name ?? "Clinica Sao Vicente").toUpperCase();
    const lines = doc.splitTextToSize(name, w - 8).slice(0, 3) as string[];
    setText(COLORS.meta);
    setFont("bold", 12);
    lines.forEach((line, index) => {
      doc.text(line, x + w / 2, top + 22 + index * 13, { align: "center" });
    });
  };

  const drawHeaderRow = (
    label: string,
    value: string | null | undefined,
    x: number,
    rowY: number,
    w: number,
    labelW: number,
    options: { black?: boolean } = {},
  ) => {
    const rowH = 12;
    if (options.black) {
      setFill(COLORS.black);
      doc.rect(x, rowY + 2, w, rowH - 4, "F");
      return;
    }

    setDraw(COLORS.dotted);
    doc.setLineWidth(0.35);
    doc.setLineDashPattern([1, 1.2], 0);
    doc.line(x, rowY + rowH - 2, x + w, rowY + rowH - 2);
    doc.setLineDashPattern([], 0);

    if (label) {
      setText(COLORS.navy);
      setFont("bolditalic", 8.2);
      doc.text(label, x + labelW - 2, rowY + rowH - 4, { align: "right" });
    }

    const safeValue = String(value ?? "");
    if (safeValue) {
      setText(COLORS.black);
      setFont(label === "Nome Social:" ? "normal" : "bold", 8.2);
      const lines = doc.splitTextToSize(safeValue, Math.max(20, w - labelW - 2)) as string[];
      doc.text(lines[0] ?? "", x + labelW + 1, rowY + rowH - 4);
    }
  };

  const drawPatientHeader = () => {
    const headerTop = margin;
    const brandW = 210;
    const brandH = 99;
    const gridX = margin + brandW;
    const gridW = contentW - brandW;
    const colGap = 7;
    const leftW = gridW * 0.59;
    const rightW = gridW - leftW - colGap;

    setDraw([85, 85, 85]);
    doc.setLineWidth(0.55);
    doc.line(gridX, headerTop, gridX, headerTop + brandH);

    if (logoData) {
      const maxW = brandW - 4;
      const maxH = 112;
      const scale = Math.min(maxW / logoData.naturalW, maxH / logoData.naturalH);
      const w = logoData.naturalW * scale;
      const h = logoData.naturalH * scale;
      const x = margin + (brandW - w) / 2;
      const format = logoData.mime.includes("jpeg") || logoData.mime.includes("jpg")
        ? "JPEG"
        : logoData.mime.includes("webp")
          ? "WEBP"
          : "PNG";

      try {
        doc.addImage(logoData.dataUrl, format, x, headerTop - 10, w, h, undefined, "FAST");
      } catch {
        drawWordmark(margin, headerTop, brandW);
      }
    } else {
      drawWordmark(margin, headerTop, brandW);
    }

    const idNumber = p.registration || p.medical_record || "";
    if (idNumber) {
      setText(COLORS.black);
      setFont("normal", 6.7);
      doc.text(idNumber, margin + brandW / 2, headerTop + brandH - 5, { align: "center" });
    }

    const leftRows: [string, string][] = [
      ["Registro Civil:", p.full_name ?? ""],
      ["Nome Social:", p.social_name ?? ""],
      ["Dt Nascimento:", safeDate(p.birth_date ?? p.date_of_birth)],
      ["CPF:", p.cpf ?? ""],
      ["DtHr Admissão:", safeDateTime(p.admission_at ?? consultation.created_at)],
      ["Registro:", p.registration ?? ""],
      ["Convênio/Plano:", p.plan ?? ""],
      ["Setor:", consultation.ward?.name ?? ""],
    ];

    const rightRows: [string, string][] = [
      ["", ""],
      ["Idade:", p.age ?? ""],
      ["Sexo:", p.sex ?? ""],
      [p.bed ? "Leito:" : "Tipo Atend.:", p.bed || p.attendance_type || ""],
      ["Prontuário:", p.medical_record ?? ""],
      ["Matrícula:", p.matricula ?? ""],
    ];

    if (p.bed && p.attendance_type) {
      rightRows.splice(4, 0, ["Tipo Atend.:", p.attendance_type]);
    }

    const rowH = 12;
    const rows = Math.max(leftRows.length, rightRows.length);
    for (let i = 0; i < rows; i++) {
      const rowY = headerTop + i * rowH;
      const [leftLabel, leftValue] = leftRows[i] ?? ["", ""];
      const [rightLabel, rightValue] = rightRows[i] ?? ["", ""];
      drawHeaderRow(leftLabel, leftValue, gridX + 6, rowY, leftW - 6, 84);
      drawHeaderRow(rightLabel, rightValue, gridX + leftW + colGap, rowY, rightW, 68, {
        black: i === 0,
      });
    }

    const bottom = headerTop + Math.max(brandH, rows * rowH) + 2;
    setDraw(COLORS.black);
    doc.setLineWidth(0.75);
    doc.line(margin, bottom, pageW - margin, bottom);
    y = bottom + 2;
  };

  const drawDocumentTitle = () => {
    const h = 16;
    setFill(COLORS.black);
    doc.rect(margin, y, contentW, h, "F");
    setText(COLORS.white);
    setFont("bold", 10.6);
    doc.text(title.toUpperCase(), margin + contentW / 2, y + 11.5, { align: "center" });
    y += h + PT.afterBannerGap;
  };

  const drawPageChrome = () => {
    y = margin;
    drawPatientHeader();
    drawDocumentTitle();
  };

  const drawSectionBanner = (label: string) => {
    const h = 14;
    ensureSpace(h + PT.afterBannerGap);
    setFill(COLORS.gray);
    doc.rect(margin, y, contentW, h, "F");
    setText(COLORS.white);
    setFont("bold", 10.5);
    doc.text(label.toUpperCase(), margin + contentW / 2, y + 10, { align: "center" });
    y += h + PT.afterBannerGap;
  };

  const drawSubsectionBanner = (label: string) => {
    const h = 12.5;
    ensureSpace(h + PT.afterBannerGap);
    setFill(COLORS.navy);
    doc.rect(margin, y, contentW, h, "F");
    setText(COLORS.white);
    setFont("bolditalic", 8.5);
    doc.text(label, margin + contentW / 2, y + 9, { align: "center" });
    y += h + PT.afterBannerGap;
  };

  const drawCheckbox = (x: number, top: number, checked: boolean) => {
    const size = 10.5;
    setDraw(COLORS.black);
    doc.setLineWidth(0.55);
    doc.rect(x, top, size, size, "S");
    if (checked) {
      setText(COLORS.black);
      setFont("bold", 8.8);
      doc.text("X", x + size / 2, top + 8.6, { align: "center" });
    }
  };

  const renderCheckboxItem = (text: string, checked: boolean) => {
    ensureSpace(PT.body * PT.lineHeight);
    drawCheckbox(margin + 2, y - PT.body + 1, checked);
    renderRuns(parseInline(text), PT.body, 17, contentW - 17);
  };

  const renderCheckboxGrid = (items: Array<{ text: string; checked: boolean }>) => {
    if (items.length === 0) return;

    const boxSize = 10.5;
    const gapX = 8;
    const gapY = 3.5;
    const textOffset = boxSize + 4;
    const fs = PT.body;
    const lineH = fs * 1.18;

    setFont("normal", fs);
    const maxTextW = Math.max(...items.map((item) => doc.getTextWidth(item.text)));
    let cols = 4;
    if (maxTextW > contentW / 4 - textOffset - gapX) cols = 3;
    if (maxTextW > contentW / 3 - textOffset - gapX) cols = 2;
    if (maxTextW > contentW / 2 - textOffset - gapX) cols = 1;

    const colW = contentW / cols;
    const rows: Array<Array<{ text: string; checked: boolean; lines: string[]; h: number }>> = [];

    for (let index = 0; index < items.length; index++) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const textW = colW - textOffset - gapX;
      const lines = doc.splitTextToSize(items[index].text, textW) as string[];
      rows[row] ??= [];
      rows[row][col] = {
        ...items[index],
        lines,
        h: Math.max(boxSize + 1, lines.length * lineH),
      };
    }

    y += 1;
    for (const row of rows) {
      const rowH = Math.max(...row.filter(Boolean).map((cell) => cell.h)) + gapY;
      ensureSpace(rowH);

      row.forEach((cell, col) => {
        if (!cell) return;
        const x = margin + col * colW + 2;
        drawCheckbox(x, y - fs + 1, cell.checked);
        setText(COLORS.text);
        setFont("normal", fs);
        cell.lines.forEach((textLine, lineIndex) => {
          doc.text(textLine, x + textOffset, y + lineIndex * lineH);
        });
      });

      y += rowH;
    }
    y += 2;
  };

  const renderBullet = (text: string) => {
    ensureSpace(PT.body * PT.lineHeight);
    setText(COLORS.navy);
    setFont("bold", PT.body);
    doc.text("•", margin + 4, y);
    renderRuns(parseInline(text), PT.body, 16, contentW - 16);
  };

  const renderKeyValueParagraph = (text: string) => {
    const keyValue = /^([^:]{2,80}):\s+(.+)$/.exec(text);
    if (!keyValue) {
      renderRuns(parseInline(text), PT.body);
      y += 1;
      return;
    }

    const label = keyValue[1].trim() + ":";
    const value = keyValue[2].trim();
    renderRuns(
      [
        { text: label + " ", bold: true, italic: true },
        ...parseInline(value),
      ],
      PT.body,
    );
    y += 1;
  };

  const renderTable = (rows: string[][]) => {
    if (!rows.length) return;

    const cols = Math.max(...rows.map((row) => row.length));
    const colW = contentW / cols;
    const padX = 3.5;
    const padY = 3;
    const fs = 7.8;
    const lineH = fs * 1.25;

    y += 2;
    for (let r = 0; r < rows.length; r++) {
      const wrappedCells = Array.from({ length: cols }, (_, c) => {
        const value = rows[r][c] ?? "";
        setFont(r === 0 ? "bold" : "normal", fs);
        return doc.splitTextToSize(value, colW - padX * 2) as string[];
      });

      const rowH = Math.max(15, ...wrappedCells.map((lines) => lines.length * lineH + padY * 2));
      ensureSpace(rowH + 2);

      setDraw(COLORS.black);
      doc.setLineWidth(0.5);
      doc.rect(margin, y, contentW, rowH, "S");
      for (let c = 1; c < cols; c++) {
        doc.line(margin + c * colW, y, margin + c * colW, y + rowH);
      }

      for (let c = 0; c < cols; c++) {
        const lines = wrappedCells[c];
        const cx = margin + c * colW;
        const isHeader = r === 0;
        setText(isHeader ? COLORS.navy : COLORS.text);
        setFont(isHeader ? "bold" : "normal", fs);
        const align = isHeader ? "center" : "left";
        const tx = isHeader ? cx + colW / 2 : cx + padX;
        lines.forEach((line, index) => {
          doc.text(line, tx, y + padY + lineH * (index + 1) - 2, { align });
        });
      }

      y += rowH;
    }
    y += 5;
  };

  const readTable = (lines: string[], start: number) => {
    const table: string[][] = [];
    let index = start;

    while (index < lines.length && /^\s*\|/.test(lines[index])) {
      const line = lines[index].trim();
      const isSeparator = /^\|?[\s:|-]+\|[\s:|.-]*$/.test(line);
      if (!isSeparator) {
        table.push(
          line
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim()),
        );
      }
      index++;
    }

    return { table, next: index };
  };

  const renderMarkdown = (markdown: string) => {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) {
        y += 3;
        i++;
        continue;
      }

      const h1 = /^#\s+(.+)$/.exec(line);
      if (h1) {
        const heading = h1[1].trim();
        if (heading.toUpperCase() !== title.toUpperCase()) {
          ensureSpace(16);
          setText(COLORS.navy);
          setFont("bold", PT.h1);
          doc.text(heading, margin, y);
          y += 15;
        }
        i++;
        continue;
      }

      const h2 = /^##\s+(.+)$/.exec(line);
      if (h2) {
        drawSectionBanner(h2[1].trim());
        i++;
        continue;
      }

      const h3 = /^###\s+(.+)$/.exec(line);
      if (h3) {
        drawSubsectionBanner(h3[1].trim());
        i++;
        continue;
      }

      if (/^\s*([-*])\1{2,}\s*$/.test(line)) {
        ensureSpace(8);
        setDraw(COLORS.dotted);
        doc.setLineWidth(0.45);
        doc.line(margin, y, margin + contentW, y);
        y += 8;
        i++;
        continue;
      }

      if (/^\s*\|/.test(line)) {
        const { table, next } = readTable(lines, i);
        if (table.length) renderTable(table);
        i = next;
        continue;
      }

      if (/^\s*[-*+]\s+/.test(line)) {
        let checkboxGroup: Array<{ text: string; checked: boolean }> = [];
        const flushCheckboxGroup = () => {
          if (checkboxGroup.length === 1) {
            renderCheckboxItem(checkboxGroup[0].text, checkboxGroup[0].checked);
          } else if (checkboxGroup.length > 1) {
            renderCheckboxGrid(checkboxGroup);
          }
          checkboxGroup = [];
        };

        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          const raw = lines[i].replace(/^\s*[-*+]\s+/, "").trim();
          const checkbox = /^\[( |x|X|✓|✔)\]\s+(.+)$/.exec(raw);
          if (checkbox) {
            checkboxGroup.push({ text: checkbox[2], checked: checkbox[1] !== " " });
          } else {
            flushCheckboxGroup();
            renderBullet(raw);
          }
          i++;
        }
        flushCheckboxGroup();
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          const item = /^\s*(\d+)\.\s+(.+)$/.exec(lines[i]);
          if (item) {
            ensureSpace(PT.body * PT.lineHeight);
            setText(COLORS.text);
            setFont("normal", PT.body);
            doc.text(`${item[1]}.`, margin + 2, y);
            renderRuns(parseInline(item[2]), PT.body, 18, contentW - 18);
          }
          i++;
        }
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        const quote: string[] = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        const startY = y - PT.body;
        renderRuns(parseInline(quote.join(" ")), PT.body, 12, contentW - 12);
        setDraw(COLORS.navy);
        doc.setLineWidth(1.3);
        doc.line(margin + 3, startY, margin + 3, y - 4);
        continue;
      }

      const paragraph: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^#{1,3}\s+/.test(lines[i]) &&
        !/^\s*\|/.test(lines[i]) &&
        !/^\s*[-*+]\s+/.test(lines[i]) &&
        !/^\s*\d+\.\s+/.test(lines[i]) &&
        !/^\s*>\s?/.test(lines[i]) &&
        !/^\s*([-*])\1{2,}\s*$/.test(lines[i])
      ) {
        paragraph.push(lines[i].trim());
        i++;
      }

      const text = paragraph.join(" ").trim();
      if (text) renderKeyValueParagraph(text);
    }
  };

  drawPageChrome();
  renderMarkdown(reportContent || "_Sem conteudo informado._");

  if (addenda.length > 0) {
    y += 7;
    drawSectionBanner("Observações posteriores");
    for (const addendum of addenda) {
      ensureSpace(28);
      setText(COLORS.meta);
      setFont("italic", PT.meta);
      doc.text(
        `${addendum.author?.full_name ?? "-"} · ${addendum.author_role_at_time} · ${safeDateTime(addendum.created_at)}`,
        margin,
        y,
      );
      y += 10;
      renderMarkdown(addendum.content);
      y += 4;
    }
  }

  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  const printedAt = new Date().toLocaleString("pt-BR");
  const printedBy = professionalName || "-";
  const dtAfe = safeDateTime(consultation.created_at);

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    setText(COLORS.navy);
    setFont("bolditalic", 7.5);
    doc.text("DtHr Afe:", margin, footerTop + 13);
    setText(COLORS.text);
    setFont("normal", 7.5);
    doc.text(` ${dtAfe}`, margin + 38, footerTop + 13);

    setText(COLORS.meta);
    setFont("normal", 7);
    doc.text(`Impresso por ${printedBy} em ${printedAt}`, margin, footerTop + 24);

    if (page === pageCount && professionalName) {
      const sigX = pageW / 2;
      const sigW = 260;
      setDraw(COLORS.black);
      doc.setLineWidth(0.8);
      doc.line(sigX - sigW / 2, footerTop + 3, sigX + sigW / 2, footerTop + 3);
      setText(COLORS.black);
      setFont("bold", 9.6);
      doc.text(professionalName.toUpperCase(), sigX, footerTop + 16, { align: "center" });
      if (professionalRegistration) {
        setText(COLORS.red);
        setFont("bold", 8.8);
        doc.text(professionalRegistration.toUpperCase(), sigX, footerTop + 27, { align: "center" });
      }
    }

    setText(COLORS.text);
    setFont("normal", 7.5);
    doc.text(`Página ${page} de ${pageCount}`, pageW - margin, footerTop + 24, { align: "right" });
  }

  const patientName = cleanFilename(p.full_name || "paciente");
  const date = new Date(consultation.created_at).toISOString().slice(0, 10);
  const version = reportVersion ? `_v${reportVersion}` : "";
  doc.save(`${cleanFilename(filenamePrefix)}_${patientName}_${date}${version}.pdf`);
}
