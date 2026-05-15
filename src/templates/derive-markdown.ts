// Espelho front-side de supabase/functions/_shared/structured-to-markdown.ts.
//
// MUST stay in sync com a versão Deno. A duplicação existe porque
// front (Vite/ESM) e edge function (Deno) usam resolvers diferentes
// pra imports e a função é referenciada nos dois lados:
//   - Edge: gera content na primeira geração da IA.
//   - Front: rederiva content quando o médico edita e salva, pra PDF
//     refletir as mudanças (sem precisar recall ao Gemini).
//
// Render rico:
//   - Mostra "Não relatado" pra campos null/vazios visíveis
//   - Classification de scored_scale com label e cor
//   - Narrative renderizada como "_Observação:_ ..." em italic
//   - Tabelas com colunas labeladas
//   - Visibilidade respeitada

import type { TemplateSchema, Field } from "./types";
import { NARRATIVE_KEY } from "./types";
import { evaluateVisibility } from "./runtime";

export function deriveMarkdown(
  template: TemplateSchema,
  filled: Record<string, Record<string, unknown>>,
): string {
  const lines: string[] = [];
  lines.push(`# ${template.name}`);
  lines.push("");

  for (const section of template.sections) {
    const sectionValues = filled[section.id] ?? {};
    if (!evaluateVisibility(section.visibleWhen, sectionValues)) continue;

    lines.push(`## ${section.title}`);

    let renderedAnyField = false;
    for (const field of section.fields) {
      if (!evaluateVisibility(field.visibleWhen, sectionValues)) continue;
      const value = sectionValues[field.id];
      lines.push(renderFieldMarkdown(field, value));
      renderedAnyField = true;
    }

    const narrative = sectionValues[NARRATIVE_KEY];
    if (typeof narrative === "string" && narrative.trim()) {
      if (renderedAnyField) lines.push("");
      lines.push(`_Observação:_ ${narrative.trim()}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderFieldMarkdown(field: Field, value: unknown): string {
  const label = field.label;
  // Fields tipo "lista" sempre renderizam estrutura completa, mesmo vazios,
  // preservando o "shape" do formulário em papel.
  const alwaysRenderStructure =
    field.type === "multi_checkbox" || field.type === "tri_state_checklist";

  const isEmpty =
    !alwaysRenderStructure &&
    (value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0));

  if (isEmpty) {
    if (field.type === "block_ref" || field.type === "computed") return "";
    return `- **${label}**: _Não relatado_`;
  }

  if (field.type === "table" && Array.isArray(value)) {
    const rows = (value as Record<string, unknown>[])
      .map((row, i) => {
        const parts = field.columns
          .map((col) => {
            const v = row[col.id];
            if (v === null || v === undefined || v === "") return null;
            return `${col.label}: ${formatValue(v)}`;
          })
          .filter(Boolean)
          .join(" · ");
        return `  ${i + 1}. ${parts}`;
      })
      .join("\n");
    return `- **${label}**:\n${rows}`;
  }

  if (field.type === "scored_scale" && typeof value === "object" && value !== null) {
    let total = 0;
    let hasAny = false;
    const itemLines: string[] = [];
    for (const item of field.items) {
      const v = (value as Record<string, number>)[item.id];
      if (typeof v === "number") {
        total += v;
        hasAny = true;
        const opt = item.options.find((o) => o.value === v);
        itemLines.push(`    - ${item.label}: ${opt?.label ?? v} (${v})`);
      } else {
        itemLines.push(`    - ${item.label}: _Não relatado_`);
      }
    }
    const cls = hasAny
      ? field.classification?.find((c) => total >= c.min && total <= c.max)
      : null;
    const summary = hasAny
      ? `score ${total}${cls ? ` — **${cls.label}**` : ""}`
      : "_Não relatado_";
    return `- **${label}**: ${summary}\n${itemLines.join("\n")}`;
  }

  if (field.type === "tri_state_checklist") {
    const obj = (typeof value === "object" && value !== null ? value : {}) as Record<string, string>;
    const lines = field.items.map((item) => {
      const v = obj[item.id];
      const display = v === "SIM"
        ? `[x] **Sim** — ${item.label}`
        : v === "NAO"
          ? `[ ] **Não** — ${item.label}`
          : v === "NA"
            ? `[—] **N/A** — ${item.label}`
            : `${item.label}: _Não relatado_`;
      return `- ${display}`;
    });
    return `**${label}:**\n\n${lines.join("\n")}`;
  }

  if (field.type === "counter_grid" && typeof value === "object" && value !== null) {
    const obj = value as Record<string, number>;
    const lines = field.categories.map((cat) => {
      const v = obj[cat.id];
      return `    - ${cat.label}: ${typeof v === "number" ? v : "_Não relatado_"}`;
    });
    return `- **${label}**:\n${lines.join("\n")}`;
  }

  if (field.type === "time_window_multi" && Array.isArray(value)) {
    const labels = (value as string[])
      .map((id) => field.windows.find((w) => w.id === id)?.label ?? id)
      .join(", ");
    return `- **${label}**: ${labels}`;
  }

  if (field.type === "scale" && typeof value === "number") {
    const nearest = field.labels ? field.labels[String(value)] : undefined;
    return `- **${label}**: ${value}${nearest ? ` (${nearest})` : ""}`;
  }

  if (field.type === "number_with_unit" && typeof value === "number") {
    return `- **${label}**: ${formatValue(value)} ${field.unit}`;
  }

  if (field.type === "multi_checkbox") {
    const arr = Array.isArray(value) ? (value as unknown[]).map(String) : [];
    const selected = new Set(arr);
    const lines = field.options.map((opt) => {
      const mark = selected.has(String(opt.value)) ? "[x]" : "[ ]";
      return `- ${mark} ${opt.label}`;
    });
    return `**${label}:**\n\n${lines.join("\n")}`;
  }

  if (Array.isArray(value)) {
    return `- **${label}**: ${(value as unknown[]).join(", ")}`;
  }

  if ((field.type === "radio" || field.type === "select") && typeof value === "string") {
    const opt = field.options.find((o) => String(o.value) === value);
    return `- **${label}**: ${opt?.label ?? value}`;
  }

  return `- **${label}**: ${formatValue(value)}`;
}

function formatValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }
  return String(v);
}
