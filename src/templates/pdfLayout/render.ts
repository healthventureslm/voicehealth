// Entry point: gera PDF Blob a partir de display_layout JSON + filled_data.
// Usa @react-pdf/renderer.pdf() pra renderizar o tree em PDF binário.

import { pdf } from "@react-pdf/renderer";
import { renderNode } from "./walker";
import type { LayoutNode } from "./types";
import type { Ctx } from "./interpolate";

interface PdfRenderInput {
  layout: LayoutNode;
  /** Dados pra interpolação Mustache — geralmente filled_data + metadata. */
  data: Ctx;
}

export async function renderPdfFromLayout({ layout, data }: PdfRenderInput): Promise<Blob> {
  if (layout.type !== "Document") {
    throw new Error("display_layout deve ter nó raiz do tipo 'Document'");
  }
  const element = renderNode(layout, data);
  if (!element) {
    throw new Error("Render produziu árvore vazia");
  }
  return await pdf(element).toBlob();
}

/**
 * Helper: dispara download de Blob como arquivo .pdf.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
