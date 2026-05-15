// Converte um TemplateSchema em um responseSchema do Google AI / Gemini.
//
// Gemini aceita um subset do JSON Schema (OpenAPI 3.0). Tipos permitidos:
// STRING, INTEGER, NUMBER, BOOLEAN, ARRAY, OBJECT.
//
// Estratégia:
//   - Schema raiz = OBJECT cujas properties são uma por seção.
//   - Cada seção = OBJECT cujas properties são uma por field.
//   - Campos `computed` são pulados (server computa).
//   - Campos `block_ref` são pulados na v1 (sem suporte ainda).
//   - Campos com `visibleWhen` ficam nullable (a IA preenche null se não aplicar).
//
// Não fazemos descoberta dinâmica do que é "obrigatório" de fato (depende de
// visibilidade); marcamos como obrigatório só os campos no nível mais externo
// que têm `required: true` e SEM `visibleWhen`. O resto é nullable.

// Duplicação local dos tipos pra Edge Functions (Deno). O front usa
// src/templates/types.ts como source of truth; manter alinhado.

type Option = { value: string | number; label: string };

type VisibilityRule =
  | {
      field: string;
      equals?: unknown;
      notEquals?: unknown;
      in?: unknown[];
      contains?: unknown;
      notEmpty?: boolean;
    }
  | { all: VisibilityRule[] }
  | { any: VisibilityRule[] };

type FieldBase = {
  id: string;
  label: string;
  description?: string;
  required?: boolean;
  visibleWhen?: VisibilityRule;
};

type Field =
  | (FieldBase & { type: "text"; placeholder?: string; maxLength?: number })
  | (FieldBase & { type: "textarea"; rows?: number; maxLength?: number })
  | (FieldBase & { type: "number"; min?: number; max?: number; step?: number })
  | (FieldBase & { type: "number_with_unit"; unit: string; min?: number; max?: number; step?: number })
  | (FieldBase & { type: "date"; min?: string; max?: string })
  | (FieldBase & { type: "datetime" })
  | (FieldBase & { type: "boolean" })
  | (FieldBase & { type: "radio"; options: Option[] })
  | (FieldBase & { type: "select"; options: Option[] })
  | (FieldBase & { type: "multi_checkbox"; options: Option[]; min?: number; max?: number })
  | (FieldBase & { type: "scale"; min: number; max: number; step?: number; labels?: Record<string, string> })
  | (FieldBase & {
      type: "scored_scale";
      items: { id: string; label: string; options: { value: number; label: string }[] }[];
      classification?: { min: number; max: number; label: string; color?: string }[];
    })
  | (FieldBase & { type: "table"; columns: Field[]; minRows?: number; maxRows?: number })
  | (FieldBase & { type: "computed"; formula: unknown; unit?: string })
  | (FieldBase & { type: "tri_state_checklist"; items: { id: string; label: string }[] })
  | (FieldBase & { type: "counter_grid"; categories: { id: string; label: string }[] })
  | (FieldBase & { type: "time_window_multi"; windows: { id: string; label: string }[] })
  | (FieldBase & { type: "block_ref"; ref: string });

type SectionNarrative = { enabled: true; hint?: string };

type Section = {
  id: string;
  title: string;
  description?: string;
  sbarRole?: string;
  visibleWhen?: VisibilityRule;
  fields: Field[];
  narrative?: SectionNarrative;
};

const NARRATIVE_KEY = "_narrative";

export type TemplateSchema = {
  id: string;
  name: string;
  description: string;
  version: number;
  layout: "free" | "sbar";
  metadata?: unknown;
  sections: Section[];
};

// Subset de OpenAPI Schema aceito pelo Gemini.
type SchemaProperty = {
  type: "STRING" | "INTEGER" | "NUMBER" | "BOOLEAN" | "ARRAY" | "OBJECT";
  description?: string;
  nullable?: boolean;
  enum?: string[];
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  format?: string;
};

// Cap em ~200 chars por description. Gemini fica chato com strings longas
// em metadados de schema (rejeita com INVALID_ARGUMENT genérico). A
// description é semântica pra IA, mas o LABEL já está no field; encurtar
// não perde sinal forte.
const DESC_CAP = 200;

function describe(field: Field): string {
  const base = field.label;
  const full = field.description ? `${base}. ${field.description}` : base;
  return full.length > DESC_CAP ? full.slice(0, DESC_CAP - 1) + "…" : full;
}

function cap(s: string): string {
  return s.length > DESC_CAP ? s.slice(0, DESC_CAP - 1) + "…" : s;
}

function optionEnumValues(options: Option[]): string[] {
  return options.map((o) => String(o.value));
}

// Converte UM field em um SchemaProperty. Pode retornar null pra campos
// que não vão ao schema (computed, block_ref).
function fieldToSchema(field: Field, forceNullable: boolean): SchemaProperty | null {
  // Nullable se não-required OU tiver visibilidade condicional OU for forçado.
  const nullable = forceNullable || !!field.visibleWhen || !field.required;

  switch (field.type) {
    case "text":
    case "textarea":
      return { type: "STRING", description: describe(field), nullable };

    case "number":
    case "number_with_unit":
    case "scale":
      return { type: "NUMBER", description: describe(field), nullable };

    case "date":
      // Gemini só aceita "date-time" em format. Usamos STRING simples
      // e instruímos via description que é uma data ISO (YYYY-MM-DD).
      return {
        type: "STRING",
        description: `${describe(field)} — formato YYYY-MM-DD`,
        nullable,
      };

    case "datetime":
      return { type: "STRING", format: "date-time", description: describe(field), nullable };

    case "boolean":
      return { type: "BOOLEAN", description: describe(field), nullable };

    case "radio":
    case "select":
      return {
        type: "STRING",
        enum: optionEnumValues(field.options),
        description: describe(field),
        nullable,
      };

    case "multi_checkbox":
      return {
        type: "ARRAY",
        items: { type: "STRING", enum: optionEnumValues(field.options) },
        description: describe(field),
        nullable,
      };

    case "scored_scale": {
      // Objeto com uma property por item; valor numérico (o valor da opção selecionada).
      const properties: Record<string, SchemaProperty> = {};
      for (const item of field.items) {
        const allowedValues = item.options.map((o) => o.value);
        properties[item.id] = {
          type: "NUMBER",
          description: `${item.label} — valores válidos: ${allowedValues.join(", ")}`,
          nullable: true,
        };
      }
      return {
        type: "OBJECT",
        properties,
        description: describe(field),
        nullable,
      };
    }

    case "table": {
      // Array de objetos. Cada item é um OBJECT com properties pelas columns.
      const itemProperties: Record<string, SchemaProperty> = {};
      const required: string[] = [];
      for (const col of field.columns) {
        const colSchema = fieldToSchema(col, false);
        if (!colSchema) continue;
        itemProperties[col.id] = colSchema;
        if (col.required && !col.visibleWhen) required.push(col.id);
      }
      return {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: itemProperties,
          ...(required.length > 0 ? { required } : {}),
        },
        description: describe(field),
        nullable,
      };
    }

    case "tri_state_checklist": {
      const properties: Record<string, SchemaProperty> = {};
      for (const item of field.items) {
        properties[item.id] = {
          type: "STRING",
          enum: ["SIM", "NAO", "NA"],
          description: item.label,
          nullable: true,
        };
      }
      return {
        type: "OBJECT",
        properties,
        description: describe(field),
        nullable,
      };
    }

    case "counter_grid": {
      const properties: Record<string, SchemaProperty> = {};
      for (const cat of field.categories) {
        properties[cat.id] = {
          type: "NUMBER",
          description: `Quantidade — ${cat.label}`,
          nullable: true,
        };
      }
      return {
        type: "OBJECT",
        properties,
        description: describe(field),
        nullable,
      };
    }

    case "time_window_multi":
      return {
        type: "ARRAY",
        items: {
          type: "STRING",
          enum: field.windows.map((w) => w.id),
        },
        description: describe(field),
        nullable,
      };

    // Computado pelo server — não vai pro responseSchema.
    case "computed":
      return null;

    // Blocos reutilizáveis: ainda não suportados na v1.
    case "block_ref":
      return null;
  }
}

export function templateToResponseSchema(template: TemplateSchema): SchemaProperty {
  const sectionProps: Record<string, SchemaProperty> = {};

  for (const section of template.sections) {
    const fieldProps: Record<string, SchemaProperty> = {};
    const required: string[] = [];

    for (const field of section.fields) {
      const fs = fieldToSchema(field, false);
      if (!fs) continue;
      fieldProps[field.id] = fs;
      if (field.required && !field.visibleWhen) required.push(field.id);
    }

    if (section.narrative?.enabled) {
      const hint = section.narrative.hint
        ? ` Foco: ${section.narrative.hint}`
        : "";
      fieldProps[NARRATIVE_KEY] = {
        type: "STRING",
        description: cap(
          "Texto livre: contexto/doses/raciocínio que não cabem nos campos. Null se vazio." +
            hint,
        ),
        nullable: true,
      };
    }

    sectionProps[section.id] = {
      type: "OBJECT",
      description: cap(section.description ?? section.title),
      properties: fieldProps,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  return {
    type: "OBJECT",
    description: cap(template.description),
    properties: sectionProps,
  };
}

// Gera uma descrição human-readable do schema pra incluir no system prompt.
// Ajuda a IA a entender semântica (escala BRADEN soma; CAM-ICU tem 3 valores).
// Limitamos profundidade pra não explodir tokens.
export function describeSchemaForPrompt(template: TemplateSchema): string {
  const lines: string[] = [];
  lines.push(`Template: ${template.name}`);
  lines.push(template.description);
  lines.push("");
  for (const section of template.sections) {
    lines.push(`## ${section.title}`);
    for (const field of section.fields) {
      lines.push(describeFieldLine(field));
    }
    if (section.narrative?.enabled) {
      lines.push(
        `- ${NARRATIVE_KEY} (textarea livre): observações da seção que não cabem nos campos acima` +
          (section.narrative.hint ? ` — ${section.narrative.hint}` : ""),
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

function describeFieldLine(field: Field): string {
  switch (field.type) {
    case "radio":
    case "select":
      return `- ${field.label} (${field.type}): ${field.options.map((o) => `"${o.value}"`).join(" | ")}`;
    case "multi_checkbox":
      return `- ${field.label} (multi): pode escolher mais de um — ${field.options.map((o) => `"${o.value}"`).join(", ")}`;
    case "number_with_unit":
      return `- ${field.label} (número em ${field.unit})`;
    case "scale":
      return `- ${field.label} (escala ${field.min}–${field.max})`;
    case "scored_scale":
      return `- ${field.label} (escala pontuada com ${field.items.length} itens, score = soma dos valores)`;
    case "table":
      return `- ${field.label} (lista de objetos com colunas: ${field.columns.map((c) => c.id).join(", ")})`;
    case "tri_state_checklist":
      return `- ${field.label} (cada item: SIM | NAO | NA)`;
    case "time_window_multi":
      return `- ${field.label} (selecionar janelas horárias: ${field.windows.map((w) => w.id).join(", ")})`;
    case "computed":
      return `- ${field.label} (computado pelo servidor, NÃO preencher)`;
    case "block_ref":
      return `- ${field.label} (referência a bloco — pular)`;
    default:
      return `- ${field.label} (${field.type})`;
  }
}
