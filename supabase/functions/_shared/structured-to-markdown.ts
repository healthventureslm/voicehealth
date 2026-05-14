// Renderiza o JSON estruturado preenchido pela IA em markdown legível.
// Usado pra:
//   - clinical_reports.content (UI legacy / PDF exporter)
//   - resposta direta da edge function em modo estruturado
//
// Render raso: seções viram H2, fields viram bullets chave:valor. Listas
// (tables) viram bullets numerados com colunas concatenadas. Escalas
// pontuadas mostram o score somado.

import type { TemplateSchema } from "./template-to-response-schema.ts";

export function structuredToMarkdown(
  template: TemplateSchema,
  filled: Record<string, unknown>,
): string {
  const lines: string[] = [];
  lines.push(`# ${template.name}`);
  lines.push("");
  for (const section of template.sections) {
    const data = (filled[section.id] ?? {}) as Record<string, unknown>;
    if (!data || Object.keys(data).length === 0) continue;
    lines.push(`## ${section.title}`);
    for (const field of section.fields) {
      const value = data[field.id];
      if (value === null || value === undefined || value === "") continue;
      lines.push(renderFieldMarkdown(field, value));
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderFieldMarkdown(
  field: { id: string; label: string; type: string; [k: string]: unknown },
  value: unknown,
): string {
  if (field.type === "table" && Array.isArray(value)) {
    const rows = value
      .map((row, i) => {
        const entries = Object.entries(row as Record<string, unknown>)
          .filter(([, v]) => v !== null && v !== undefined && v !== "")
          .map(([k, v]) => `${k}: ${formatValue(v)}`)
          .join(" · ");
        return `  ${i + 1}. ${entries}`;
      })
      .join("\n");
    return `- **${field.label}**:\n${rows}`;
  }

  if (field.type === "scored_scale" && typeof value === "object" && value !== null) {
    const total = Object.values(value as Record<string, number>)
      .filter((v) => typeof v === "number")
      .reduce((a, b) => a + b, 0);
    return `- **${field.label}**: score ${total}`;
  }

  if (Array.isArray(value)) {
    return `- **${field.label}**: ${value.join(", ")}`;
  }

  if (typeof value === "object" && value !== null) {
    const parts = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${formatValue(v)}`)
      .join("; ");
    return `- **${field.label}**: ${parts}`;
  }

  return `- **${field.label}**: ${formatValue(value)}`;
}

function formatValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
}
