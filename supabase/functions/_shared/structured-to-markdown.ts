// Renderiza o JSON estruturado preenchido pela IA em markdown legível.
// Usado em DOIS lugares:
//   - Edge functions (generate-report, generate-document): grava no
//     clinical_reports.content na primeira geração.
//   - Front (src/templates/derive-markdown.ts é um espelho disso): rederiva
//     o content no save da edição manual, pra PDF refletir mudanças.
//
// IMPORTANTE: src/templates/derive-markdown.ts é uma cópia LITERAL desta
// lógica. Mudou aqui? Mude lá também. (Compartilhar via path é problemático
// porque Deno e Vite usam resolvers diferentes; duplicação é o trade-off.)
//
// Render rico (vs versão anterior):
//   - Mostra "Não relatado" pra campos null/vazios visíveis (não some)
//   - Classification de scored_scale com label
//   - Narrative renderizada como "_Observação:_ ..." em italic abaixo dos campos
//   - Tabelas com colunas labeladas (não só chave bruta)
//   - Visibilidade respeitada — campo escondido por visibleWhen não aparece

import type { TemplateSchema } from "./template-to-response-schema.ts";

const NARRATIVE_KEY = "_narrative";

export function structuredToMarkdown(
  template: TemplateSchema,
  filled: Record<string, unknown>,
): string {
  const lines: string[] = [];
  lines.push(`# ${template.name}`);
  lines.push("");

  for (const section of template.sections) {
    const sectionValues = (filled[section.id] ?? {}) as Record<string, unknown>;
    if (!isVisible(section.visibleWhen, sectionValues)) continue;

    lines.push(`## ${section.title}`);

    let renderedAnyField = false;
    for (const field of section.fields) {
      if (!isVisible((field as { visibleWhen?: unknown }).visibleWhen, sectionValues)) continue;
      const value = sectionValues[(field as { id: string }).id];
      lines.push(renderFieldMarkdown(field as Record<string, unknown>, value));
      renderedAnyField = true;
    }

    // Narrative da seção
    const narrative = sectionValues[NARRATIVE_KEY];
    if (typeof narrative === "string" && narrative.trim()) {
      if (renderedAnyField) lines.push("");
      lines.push(`_Observação:_ ${narrative.trim()}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderFieldMarkdown(
  field: Record<string, unknown>,
  value: unknown,
): string {
  const label = field.label as string;
  const type = field.type as string;

  // Fields tipo "lista" sempre renderizam estrutura completa, mesmo vazios.
  // É o comportamento documental: o formulário clínico em papel mostra os
  // itens com seus checkboxes regardless de marcação — preserva o "shape"
  // do template e indica o que foi avaliado vs faltou.
  const ALWAYS_RENDER_STRUCTURE = new Set(["multi_checkbox", "tri_state_checklist"]);

  const isEmpty =
    !ALWAYS_RENDER_STRUCTURE.has(type) &&
    (value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0));

  if (isEmpty) {
    if (type === "block_ref" || type === "computed") return "";
    return `- **${label}**: _Não relatado_`;
  }

  if (type === "table" && Array.isArray(value)) {
    const cols = (field.columns as Array<{ id: string; label: string }>) ?? [];
    const rows = value
      .map((row, i) => {
        const r = row as Record<string, unknown>;
        const parts = cols
          .map((col) => {
            const v = r[col.id];
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

  if (type === "scored_scale" && typeof value === "object" && value !== null) {
    const items = (field.items as Array<{ id: string; label: string; options: Array<{ value: number; label: string }> }>) ?? [];
    const classification = (field.classification as Array<{ min: number; max: number; label: string }>) ?? [];
    let total = 0;
    let hasAny = false;
    const itemLines: string[] = [];
    for (const item of items) {
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
    const cls = hasAny ? classification.find((c) => total >= c.min && total <= c.max) : null;
    const summary = hasAny
      ? `score ${total}${cls ? ` — **${cls.label}**` : ""}`
      : "_Não relatado_";
    return `- **${label}**: ${summary}\n${itemLines.join("\n")}`;
  }

  // Tri-state: sempre renderiza estrutura completa, com Sim/Não/N/A ou
  // "Não relatado" se IA não preencheu.
  if (type === "tri_state_checklist") {
    const items = (field.items as Array<{ id: string; label: string }>) ?? [];
    const obj = (typeof value === "object" && value !== null ? value : {}) as Record<string, string>;
    const lines = items.map((item) => {
      const v = obj[item.id];
      const display = v === "SIM" ? "Sim" : v === "NAO" ? "Não" : v === "NA" ? "N/A" : "_Não relatado_";
      return `    - ${item.label}: ${display}`;
    });
    return `- **${label}**:\n${lines.join("\n")}`;
  }

  if (type === "counter_grid" && typeof value === "object" && value !== null) {
    const cats = (field.categories as Array<{ id: string; label: string }>) ?? [];
    const obj = value as Record<string, number>;
    const lines = cats.map((cat) => {
      const v = obj[cat.id];
      return `    - ${cat.label}: ${typeof v === "number" ? v : "_Não relatado_"}`;
    });
    return `- **${label}**:\n${lines.join("\n")}`;
  }

  if (type === "time_window_multi" && Array.isArray(value)) {
    const windows = (field.windows as Array<{ id: string; label: string }>) ?? [];
    const labels = (value as string[])
      .map((id) => windows.find((w) => w.id === id)?.label ?? id)
      .join(", ");
    return `- **${label}**: ${labels}`;
  }

  if (type === "scale" && typeof value === "number") {
    const labels = field.labels as Record<string, string> | undefined;
    const nearest = labels ? labels[String(value)] : undefined;
    return `- **${label}**: ${value}${nearest ? ` (${nearest})` : ""}`;
  }

  if (type === "number_with_unit" && typeof value === "number") {
    return `- **${label}**: ${formatValue(value)} ${field.unit ?? ""}`.trim();
  }

  // Multi-checkbox: renderiza como CHECKLIST com TODAS as opções, marcando
  // selecionadas com ☑ e não-selecionadas com ☐. Mesmo se value=null,
  // renderiza a estrutura completa (igual à PDF em papel).
  if (type === "multi_checkbox") {
    const options = (field.options as Array<{ value: string; label: string }>) ?? [];
    const arr = Array.isArray(value) ? (value as unknown[]).map(String) : [];
    const selected = new Set(arr);
    const lines = options.map((opt) => {
      const mark = selected.has(String(opt.value)) ? "☑" : "☐";
      return `    ${mark} ${opt.label}`;
    });
    return `- **${label}**:\n${lines.join("\n")}`;
  }

  // Outros arrays
  if (Array.isArray(value)) {
    return `- **${label}**: ${(value as unknown[]).join(", ")}`;
  }

  // Radio/select com options → mostra o label, não o value
  if ((type === "radio" || type === "select") && typeof value === "string") {
    const options = field.options as Array<{ value: string; label: string }> | undefined;
    const opt = options?.find((o) => String(o.value) === value);
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

// Avaliador de visibilidade local — duplicado do runtime.ts pra evitar
// dependência cruzada Deno↔front. Lógica idêntica.
function isVisible(rule: unknown, values: Record<string, unknown>): boolean {
  if (!rule) return true;
  const r = rule as Record<string, unknown>;
  if (Array.isArray(r.all)) return (r.all as unknown[]).every((sub) => isVisible(sub, values));
  if (Array.isArray(r.any)) return (r.any as unknown[]).some((sub) => isVisible(sub, values));
  const target = values[r.field as string];
  if (r.equals !== undefined) return deepEqual(target, r.equals);
  if (r.notEquals !== undefined) return !deepEqual(target, r.notEquals);
  if (Array.isArray(r.in)) return r.in.some((v) => deepEqual(v, target));
  if (r.contains !== undefined) {
    if (Array.isArray(target)) return target.some((v) => deepEqual(v, r.contains));
    if (typeof target === "string") return target.includes(String(r.contains));
    return false;
  }
  if (typeof r.notEmpty === "boolean") {
    const empty = target === null || target === undefined || target === "" ||
      (Array.isArray(target) && target.length === 0);
    return r.notEmpty ? !empty : empty;
  }
  return true;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}
